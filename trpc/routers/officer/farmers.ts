import { cycles, farmer, farmerSecurityMoneyLogs, stockLogs } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";

export const officerFarmersRouter = createTRPCRouter({
    // DASHBOARD: "Warehouse View" / List for Officer
    listWithStock: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            search: z.string().optional(),
            page: z.number().default(1),
            pageSize: z.number().default(10),
            sortBy: z.string().optional(),
            sortOrder: z.enum(["asc", "desc"]).optional(),
            officerId: z.string().optional(), // Allow filtering by specific officer (for Admin actions)
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, search, page, pageSize, officerId } = input;

            const farmersData = await ctx.db.query.farmer.findMany({
                where: and(
                    eq(farmer.organizationId, orgId),
                    // Use provided officerId or fallback to current user
                    eq(farmer.officerId, officerId || ctx.user.id),
                    eq(farmer.status, "active"),
                    search ? ilike(farmer.name, `%${search}%`) : undefined
                ),
                limit: pageSize,
                offset: (page - 1) * pageSize,
                orderBy: [desc(farmer.createdAt)],
                with: {
                    cycles: {
                        where: eq(cycles.status, "active"),
                        orderBy: [desc(cycles.createdAt)]
                    },
                    history: true
                }
            });

            const [total] = await ctx.db.select({ count: sql<number>`count(*)` })
                .from(farmer)
                .where(and(
                    eq(farmer.organizationId, orgId),
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, "active"),
                    search ? ilike(farmer.name, `%${search}%`) : undefined
                ));

            return {
                items: farmersData.map(f => {
                    // 1. Active Consumption: Feed eaten by cycles that are currently OPEN
                    const activeConsumption = f.cycles.reduce((sum, c) => sum + (Number(c.intake) || 0), 0);
                    // 2. Real Available Stock: Book Balance - Active Consumption
                    const remainingStock = f.mainStock - activeConsumption;

                    return {
                        ...f,
                        activeCycles: f.cycles,
                        activeCyclesCount: f.cycles.length,
                        pastCyclesCount: f.history.length,
                        mainStock: f.mainStock,
                        totalConsumed: f.totalConsumed,
                        activeConsumption: activeConsumption,
                        remainingStock: remainingStock,
                        isLowStock: remainingStock < 5
                    };
                }),
                total: Number(total.count),
                totalPages: Math.ceil(Number(total.count) / pageSize)
            };
        }),

    getMany: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            search: z.string().optional(),
            page: z.number().default(1),
            pageSize: z.number().default(20),
            sortBy: z.string().optional(),
            sortOrder: z.enum(["asc", "desc"]).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, search, page, pageSize, sortBy, sortOrder } = input;

            const whereClause = and(
                eq(farmer.organizationId, orgId),
                eq(farmer.officerId, ctx.user.id),
                eq(farmer.status, "active"),
                search ? ilike(farmer.name, `%${search}%`) : undefined
            );

            // Determine sort order
            let orderBy = [desc(farmer.createdAt)];
            if (sortBy === "createdAt") {
                orderBy = [sortOrder === "asc" ? sql`${farmer.createdAt} asc` : desc(farmer.createdAt)];
            } else if (sortBy === "name") {
                orderBy = [sortOrder === "asc" ? sql`${farmer.name} asc` : desc(farmer.name)];
            }

            const data = await ctx.db.query.farmer.findMany({
                where: whereClause,
                limit: pageSize,
                offset: (page - 1) * pageSize,
                orderBy: orderBy,
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                    history: true
                }
            });

            const [total] = await ctx.db.select({ count: sql<number>`count(*)` })
                .from(farmer)
                .where(whereClause);

            return {
                items: data.map(f => ({
                    ...f,
                    activeCyclesCount: f.cycles.length,
                    pastCyclesCount: f.history.length,
                    officerName: "Me"
                })),
                total: Number(total.count),
                totalPages: Math.ceil(Number(total.count) / pageSize)
            };
        }),

    create: protectedProcedure
        .input(z.object({
            name: z.string().min(2).max(100),
            orgId: z.string(),
            initialStock: z.number().min(0).max(1000, "Initial stock cannot exceed 1000 bags")
        }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, "active"),
                    ilike(farmer.name, input.name.toUpperCase())
                )
            });

            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `A farmer named "${input.name}" is already registered under your account.`
                });
            }

            return await ctx.db.transaction(async (tx) => {
                const [newFarmer] = await tx.insert(farmer).values({
                    name: input.name.toUpperCase(),
                    organizationId: input.orgId,
                    officerId: ctx.user.id,
                    mainStock: input.initialStock,
                }).returning();

                if (input.initialStock > 0) {
                    await tx.insert(stockLogs).values({
                        farmerId: newFarmer.id,
                        amount: input.initialStock.toString(),
                        type: "INITIAL",
                        note: "Initial Stock Assignment"
                    });
                }

                // NOTIFICATION: Notify Managers
                try {
                    // We need to import NotificationService dynamically or at top level if not circular
                    // Assuming dynamic import to avoid circular dep risks or just use it if standard
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: input.orgId,
                        title: "New Farmer Created",
                        message: `Officer ${ctx.user.name} created farmer "${newFarmer.name}"`,
                        type: "INFO",
                        link: `/management/farmers/${newFarmer.id}`,
                        metadata: { farmerId: newFarmer.id, actorId: ctx.user.id }
                    });
                } catch (e) {
                    console.error("Failed to send notification for farmer creation", e);
                }

                return newFarmer;
            });
        }),

    updateName: protectedProcedure
        .input(z.object({
            id: z.string(),
            name: z.string().min(2).max(100),
            orgId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, "active"),
                    ilike(farmer.name, input.name.toUpperCase()),
                    ne(farmer.id, input.id) // Exclude self
                )
            });

            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `A farmer named "${input.name}" is already registered.`
                });
            }

            const [updated] = await ctx.db.update(farmer)
                .set({
                    name: input.name.toUpperCase(),
                    updatedAt: new Date()
                })
                .where(eq(farmer.id, input.id))
                .returning();

            // NOTIFICATION: Farmer Renamed
            if (updated) {
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: input.orgId,
                        title: "Farmer Renamed",
                        message: `Officer ${ctx.user.name} renamed a farmer. New name: ${updated.name}`,
                        type: "INFO",
                        link: `/management/farmers/${updated.id}`
                    });
                } catch (e) {
                    console.error("Failed to send farmer renamed notification", e);
                }
            }

            return [updated];
        }),

    createBulk: protectedProcedure
        .input(z.object({
            farmers: z.array(z.object({
                name: z.string().min(2).max(100),
                initialStock: z.number().min(0).default(0)
            })),
            orgId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const { farmers: newFarmers, orgId } = input;

            if (newFarmers.length === 0) return [];

            return await ctx.db.transaction(async (tx) => {
                const results = [];
                const namesToCheck = newFarmers.map(f => f.name.toUpperCase());

                // 1. Find existing farmers to skip
                const existing = await tx.query.farmer.findMany({
                    where: and(
                        eq(farmer.organizationId, orgId),
                        eq(farmer.officerId, ctx.user.id),
                        eq(farmer.status, "active"),
                        inArray(sql`upper(${farmer.name})`, namesToCheck)
                    )
                });

                const existingNames = new Set(existing.map(f => f.name.toUpperCase()));

                // 2. Filter out duplicates
                const toCreate = newFarmers.filter(f => !existingNames.has(f.name.toUpperCase()));

                // Deduplicate input list itself (in case duplications in input)
                const uniqueToCreate = Array.from(new Map(toCreate.map(item => [item.name.toUpperCase(), item])).values());

                if (uniqueToCreate.length === 0) return existing;

                // 3. Insert new farmers in bulk
                const createdFarmers = await tx.insert(farmer).values(uniqueToCreate.map(f => ({
                    name: f.name.toUpperCase(),
                    organizationId: orgId,
                    officerId: ctx.user.id,
                    mainStock: f.initialStock,
                }))).returning();

                results.push(...createdFarmers);

                // 4. Create and insert stock logs in bulk
                const stockLogsToInsert = createdFarmers
                    .map(f => {
                        const original = uniqueToCreate.find(u => u.name.toUpperCase() === f.name.toUpperCase());
                        return {
                            farmerId: f.id,
                            amount: (original?.initialStock || 0).toString(),
                            type: "INITIAL",
                            note: "Initial Stock Assignment"
                        };
                    })
                    .filter(log => parseFloat(log.amount) > 0);

                if (stockLogsToInsert.length > 0) {
                    await tx.insert(stockLogs).values(stockLogsToInsert);
                }

                // 4. NOTIFICATION: Notify Managers
                if (results.length > 0) {
                    try {
                        const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                        await NotificationService.sendToOrgManagers({
                            organizationId: orgId,
                            title: "Bulk Farmers Created",
                            message: `Officer ${ctx.user.name} created ${results.length} new farmers.`,
                            type: "INFO",
                            link: `/management/farmers`,
                            metadata: { count: results.length, actorId: ctx.user.id }
                        });
                    } catch (e) {
                        console.error("Failed to send notification for bulk farmer creation", e);
                    }
                }

                return results;
            });
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string(), orgId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // 1. Check for active cycles
            const activeCycles = await ctx.db.query.cycles.findFirst({
                where: and(eq(cycles.farmerId, input.id), eq(cycles.status, "active"))
            });

            if (activeCycles) {
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: "Cannot delete farmer with active cycles. Please end all cycles first."
                });
            }

            // Fetch farmer to get name
            const currentFarmer = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.id), eq(farmer.officerId, ctx.user.id))
            });
            if (!currentFarmer) throw new TRPCError({ code: "NOT_FOUND" });

            // 2. Perform soft deletion
            // We append a unique shortId (from UUID) to the name to free up the original name for reuse
            const shortId = input.id.slice(0, 4).toUpperCase();
            const archivedName = `${currentFarmer.name}_${shortId}`;

            const [deleted] = await ctx.db.update(farmer)
                .set({
                    status: "deleted",
                    deletedAt: new Date(),
                    name: archivedName,
                    updatedAt: new Date()
                })
                .where(and(eq(farmer.id, input.id), eq(farmer.officerId, ctx.user.id)))
                .returning();

            if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });

            // NOTIFICATION: Farmer Deleted
            try {
                const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                await NotificationService.sendToOrgManagers({
                    organizationId: input.orgId,
                    title: "Farmer Profile Deleted",
                    message: `Officer ${ctx.user.name} deleted farmer profile "${deleted.name}"`,
                    type: "WARNING",
                    link: `/management/farmers`
                });
            } catch (e) {
                console.error("Failed to send farmer deletion notification", e);
            }

            return deleted;
        }),

    getDetails: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            const data = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.id, input.farmerId),
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, "active")
                ),
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                }
            });

            if (!data) throw new TRPCError({ code: "NOT_FOUND" });
            return data;
        }),

    getSecurityMoneyHistory: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db.query.farmerSecurityMoneyLogs.findMany({
                where: eq(farmerSecurityMoneyLogs.farmerId, input.farmerId),
                orderBy: [desc(farmerSecurityMoneyLogs.changedAt)],
                with: {
                    editor: true
                }
            });
        }),

    updateSecurityMoney: protectedProcedure
        .input(z.object({
            id: z.string(),
            amount: z.number().min(0),
            reason: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const currentFarmer = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.id), eq(farmer.officerId, ctx.user.id))
            });

            if (!currentFarmer) throw new TRPCError({ code: "NOT_FOUND" });

            const oldAmount = currentFarmer.securityMoney || "0";
            if (parseFloat(oldAmount) === input.amount) return currentFarmer;

            return await ctx.db.transaction(async (tx) => {
                const [updated] = await tx.update(farmer)
                    .set({
                        securityMoney: input.amount.toString(),
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, input.id))
                    .returning();

                await tx.insert(farmerSecurityMoneyLogs).values({
                    farmerId: input.id,
                    previousAmount: oldAmount,
                    newAmount: input.amount.toString(),
                    changedBy: ctx.user.id,
                    reason: input.reason
                });

                return updated;
            });
        }),
});
