import { cycleHistory, cycles, farmer, stockLogs } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "../../init";

export const managementFarmersRouter = createTRPCRouter({
    getMany: orgProcedure
        .input(z.object({
            search: z.string().optional(),
            page: z.number().default(1),
            pageSize: z.number().default(50),
            onlyMine: z.boolean().optional().default(false),
            status: z.enum(["active", "deleted", "all"]).default("active"),
            sortBy: z.string().optional(),
            sortOrder: z.enum(["asc", "desc"]).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, onlyMine } = input;
            const orgId = input.orgId;

            const whereClause = and(
                eq(farmer.organizationId, orgId),
                search ? ilike(farmer.name, `%${search}%`) : undefined,
                onlyMine ? eq(farmer.officerId, ctx.user.id) : undefined,
                input.status === "all" ? undefined : eq(farmer.status, input.status)
            );

            const data = await ctx.db.query.farmer.findMany({
                where: whereClause,
                limit: pageSize,
                offset: (page - 1) * pageSize,
                orderBy: [desc(farmer.createdAt)],
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                    history: true,
                    officer: true
                }
            });

            const [total] = await ctx.db.select({ count: sql<number>`count(*)` })
                .from(farmer)
                .where(whereClause);

            return {
                items: data.map(f => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { officer, ...rest } = f;
                    return {
                        ...rest,
                        officerName: officer?.name || "Unknown",
                        activeCyclesCount: f.cycles.length,
                        pastCyclesCount: f.history.length
                    };
                }),
                total: Number(total.count),
                totalPages: Math.ceil(Number(total.count) / pageSize)
            };
        }),

    getOrgFarmers: orgProcedure
        .input(z.object({
            search: z.string().optional(),
            status: z.enum(["active", "deleted", "all"]).default("active"),
        }))
        .query(async ({ ctx, input }) => {
            const search = input.search;

            const data = await ctx.db.query.farmer.findMany({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    input.status === "all" ? undefined : eq(farmer.status, input.status),
                    search ? ilike(farmer.name, `%${search}%`) : undefined
                ),
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                    history: true,
                    officer: true
                },
                orderBy: [desc(farmer.createdAt)]
            });

            return data.map(f => ({
                ...f,
                officerName: f.officer.name,
                activeCyclesCount: f.cycles.length,
                pastCyclesCount: f.history.length
            }));
        }),

    getDetails: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            const data = await ctx.db.query.farmer.findFirst({
                where: eq(farmer.id, input.farmerId),
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                    history: true,
                    officer: true
                }
            });

            if (!data) throw new TRPCError({ code: "NOT_FOUND" });

            // Post-fetch org membership check (just in case they hacked farmerId but provided correct orgId)
            if (data.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Farmer belongs to a different organization" });
            }

            return data;
        }),

    getCycles: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (f.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN" });
            }

            const data = await ctx.db.select({
                cycle: cycles,
                farmerName: farmer.name,
            })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(and(eq(cycles.farmerId, input.farmerId), eq(cycles.status, "active")))
                .orderBy(desc(cycles.createdAt));

            return { items: data.map(d => ({ ...d.cycle, farmerName: d.farmerName })) };
        }),

    getHistory: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (f.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN" });
            }

            const data = await ctx.db.select({
                history: cycleHistory,
                farmerName: farmer.name
            })
                .from(cycleHistory)
                .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
                .where(eq(cycleHistory.farmerId, input.farmerId))
                .orderBy(desc(cycleHistory.endDate));

            return {
                items: data.map(d => ({
                    ...d.history,
                    name: d.history.cycleName,
                    farmerName: d.farmerName,
                    organizationId: d.history.organizationId || "",
                    createdAt: d.history.startDate,
                    updatedAt: d.history.endDate,
                    intake: d.history.finalIntake,
                    status: 'archived'
                }))
            };
        }),

    getStockLogs: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (f.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN" });
            }

            return await ctx.db.select()
                .from(stockLogs)
                .where(eq(stockLogs.farmerId, input.farmerId))
                .orderBy(desc(stockLogs.createdAt));
        }),

    getManagementHub: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            const farmerData = await ctx.db.query.farmer.findFirst({
                where: eq(farmer.id, input.farmerId),
                with: { officer: true }
            });

            if (!farmerData) throw new TRPCError({ code: "NOT_FOUND" });

            // Post-fetch org membership check
            if (farmerData.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Farmer belongs to a different organization" });
            }

            const [activeCyclesData, historyData, stockLogsData] = await Promise.all([
                ctx.db.select().from(cycles).where(and(eq(cycles.farmerId, input.farmerId), eq(cycles.status, "active"))).orderBy(desc(cycles.createdAt)),
                ctx.db.select().from(cycleHistory).where(eq(cycleHistory.farmerId, input.farmerId)).orderBy(desc(cycleHistory.endDate)),
                ctx.db.select().from(stockLogs).where(eq(stockLogs.farmerId, input.farmerId)).orderBy(desc(stockLogs.createdAt)).limit(50)
            ]);

            return {
                farmer: {
                    ...farmerData,
                    officerName: farmerData.officer.name,
                },
                activeCycles: {
                    items: activeCyclesData.map(c => ({ ...c, farmerName: farmerData.name }))
                },
                history: {
                    items: historyData.map(h => ({
                        ...h,
                        name: h.cycleName,
                        farmerName: farmerData.name,
                        organizationId: h.organizationId || "",
                        createdAt: h.startDate,
                        updatedAt: h.endDate,
                        intake: h.finalIntake,
                        status: 'archived' as const
                    }))
                },
                stockLogs: stockLogsData
            };
        }),

    restore: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const archivedFarmer = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.farmerId), eq(farmer.organizationId, input.orgId))
            });

            if (!archivedFarmer) throw new TRPCError({ code: "NOT_FOUND" });
            if (archivedFarmer.status === "active") return { success: true, message: "Farmer is already active" };

            // Logic check: Can we restore? 
            // We need to check if the ORIGINAL name (without suffix) is occupied by an active farmer for this officer
            // Suffix pattern: " (Archived #...)"
            const originalName = archivedFarmer.name.split(" (Archived #")[0];

            const conflict = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.officerId, archivedFarmer.officerId),
                    eq(farmer.status, "active"),
                    eq(farmer.name, originalName)
                )
            });

            if (conflict) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `Cannot restore "${originalName}". There is already another active farmer with this name for the assigned officer. Please rename the active farmer or archived record first.`
                });
            }

            const [updated] = await ctx.db.update(farmer)
                .set({
                    status: "active",
                    name: originalName,
                    deletedAt: null,
                    updatedAt: new Date()
                })
                .where(eq(farmer.id, input.farmerId))
                .returning();

            // NOTIFICATION: Farmer Restored
            try {
                const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                await NotificationService.sendToOrgManagers({
                    organizationId: input.orgId,
                    title: "Farmer Restored",
                    message: `Manager ${ctx.user.name} restored farmer "${updated.name}"`,
                    type: "SUCCESS",
                    link: `/management/farmers/${updated.id}`
                });
            } catch (e) {
                console.error("Failed to send farmer restoration notification", e);
            }

            return updated;
        }),

    delete: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const archivedFarmer = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.farmerId), eq(farmer.organizationId, input.orgId))
            });

            if (!archivedFarmer) throw new TRPCError({ code: "NOT_FOUND" });
            if (archivedFarmer.status === "deleted") throw new TRPCError({ code: "BAD_REQUEST", message: "Farmer is already archived" });

            // 1. Check for active cycles
            const activeCycles = await ctx.db.query.cycles.findFirst({
                where: and(eq(cycles.farmerId, input.farmerId), eq(cycles.status, "active"))
            });

            if (activeCycles) {
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: "Cannot archive farmer with active cycles. Please end all cycles first."
                });
            }

            // 2. Perform soft deletion
            const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
            const suffix = ` (Archived #${timestamp})`;

            const [deleted] = await ctx.db.update(farmer)
                .set({
                    status: "deleted",
                    deletedAt: new Date(),
                    name: sql`${farmer.name} || ${suffix}`,
                    updatedAt: new Date()
                })
                .where(eq(farmer.id, input.farmerId))
                .returning();

            // NOTIFICATION: Farmer Deleted
            try {
                const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                await NotificationService.sendToOrgManagers({
                    organizationId: input.orgId,
                    title: "Farmer Profile Archived",
                    message: `Manager ${ctx.user.name} archived farmer profile "${deleted.name}"`,
                    type: "WARNING",
                    link: `/management/farmers`
                });
            } catch (e) {
                console.error("Failed to send farmer deletion notification", e);
            }

            return deleted;
        }),
});
