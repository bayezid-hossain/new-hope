import { farmer, stockLogs } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, managementProcedure } from "../../init";

export const managementStockRouter = createTRPCRouter({
    getAllFarmersStock: managementProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(20),
            cursor: z.number().default(0),
            officerId: z.string().optional(),
            search: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const officerFilter = input.officerId
                ? eq(farmer.officerId, input.officerId)
                : undefined;

            const items = await ctx.db.query.farmer.findMany({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    officerFilter,
                    ctx.user.globalRole !== "ADMIN" ? ne(farmer.status, "deleted") : undefined,
                    input.search ? sql`${farmer.name} ILIKE ${`%${input.search}%`}` : undefined
                ),
                columns: {
                    id: true,
                    name: true,
                    mainStock: true,
                    updatedAt: true,
                },
                orderBy: [asc(farmer.name), asc(farmer.id)],
                limit: input.limit + 1,
                offset: input.cursor,
            });

            let nextCursor: typeof input.cursor | undefined = undefined;
            if (items.length > input.limit) {
                items.pop();
                nextCursor = input.cursor + input.limit;
            }

            return { items, nextCursor };
        }),

    getImportHistory: managementProcedure
        .input(z.object({
            limit: z.number().min(1).max(50).default(20),
            cursor: z.number().default(0),
            officerId: z.string().optional(),
            search: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const officerFilter = input.officerId
                ? sql`AND farmer_id IN (SELECT id FROM ${farmer} WHERE officer_id = ${input.officerId} AND organization_id = ${input.orgId} AND (${ctx.user.globalRole === 'ADMIN' ? sql`TRUE` : sql`status != 'deleted'`}))`
                : sql`AND farmer_id IN (SELECT id FROM ${farmer} WHERE organization_id = ${input.orgId} AND (${ctx.user.globalRole === 'ADMIN' ? sql`TRUE` : sql`status != 'deleted'`}))`;

            const searchPattern = input.search ? `%${input.search}%` : null;
            const searchCondition = searchPattern ? sql`AND (driver_name ILIKE ${searchPattern} OR farmer_id IN (SELECT id FROM ${farmer} WHERE name ILIKE ${searchPattern}))` : sql``;

            const result: any = await ctx.db.execute(sql`
                SELECT 
                    reference_id as "batchId",
                    MIN(created_at) as "importDate",
                    COUNT(DISTINCT farmer_id) as "count",
                    SUM(amount) as "totalAmount",
                    -- Get the driver_name from the first log in each batch that has one
                    MAX(driver_name) as "driverName"
                FROM ${stockLogs}
                WHERE type = 'RESTOCK' 
                AND reference_id IS NOT NULL
                ${officerFilter}
                ${searchCondition}
                GROUP BY reference_id
                ORDER BY MIN(created_at) DESC
                LIMIT ${input.limit + 1} OFFSET ${input.cursor}
            `);

            const rows = Array.isArray(result) ? result : result.rows;

            const formattedBatches = rows.map((b: any) => ({
                batchId: String(b.batchId),
                createdAt: new Date(b.createdAt),
                count: Number(b.count),
                totalAmount: Number(b.totalAmount),
                driverName: b.driverName || null,
            }));

            let nextCursor: typeof input.cursor | undefined = undefined;
            if (formattedBatches.length > input.limit) {
                formattedBatches.pop();
                nextCursor = input.cursor + input.limit;
            }

            return { items: formattedBatches, nextCursor };
        }),

    getHistory: managementProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Check access: farmer must belong to the organization
            const f = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.id, input.farmerId),
                    eq(farmer.organizationId, input.orgId)
                )
            });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            // Visibility Restriction: Non-admins don't see deleted farmers' history
            if (ctx.user.globalRole !== "ADMIN" && f.status === "deleted") {
                throw new TRPCError({ code: "NOT_FOUND" });
            }

            return await ctx.db.select()
                .from(stockLogs)
                .where(eq(stockLogs.farmerId, input.farmerId))
                .orderBy(desc(stockLogs.createdAt));
        }),

    getBatchDetails: managementProcedure
        .input(z.object({ batchId: z.string() }))
        .query(async ({ ctx, input }) => {
            const ms = await ctx.db.select({
                logId: stockLogs.id,
                amount: stockLogs.amount,
                note: stockLogs.note,
                createdAt: stockLogs.createdAt,
                driverName: stockLogs.driverName,
                farmerName: farmer.name,
                farmerId: farmer.id
            })
                .from(stockLogs)
                .innerJoin(farmer, eq(stockLogs.farmerId, farmer.id))
                .where(and(
                    eq(stockLogs.referenceId, input.batchId),
                    eq(farmer.organizationId, input.orgId),
                    ctx.user.globalRole !== "ADMIN" ? ne(farmer.status, "deleted") : undefined
                ))
                .orderBy(desc(stockLogs.createdAt));

            return ms;
        }),

    transferStock: managementProcedure
        .input(z.object({
            sourceFarmerId: z.string(),
            targetFarmerId: z.string(),
            amount: z.number().positive().max(1000, "Max transfer is 1000 bags"),
            note: z.string().max(500).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            if (input.sourceFarmerId === input.targetFarmerId) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot transfer to the same farmer." });
            }

            // Access check: User must have EDIT permissions in the org
            if (ctx.membership?.accessLevel !== "EDIT") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You need 'EDIT' access to transfer stock."
                });
            }

            return await ctx.db.transaction(async (tx) => {
                const sourceFarmer = await tx.query.farmer.findFirst({
                    where: and(
                        eq(farmer.id, input.sourceFarmerId),
                        eq(farmer.organizationId, input.orgId),
                        eq(farmer.status, "active")
                    )
                });

                const targetFarmer = await tx.query.farmer.findFirst({
                    where: and(
                        eq(farmer.id, input.targetFarmerId),
                        eq(farmer.organizationId, input.orgId),
                        eq(farmer.status, "active")
                    )
                });

                if (!sourceFarmer || !targetFarmer) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "One or both farmers not found or archived." });
                }

                if (Number(sourceFarmer.mainStock) < input.amount) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Insufficient funds. Source has ${sourceFarmer.mainStock}, trying to send ${input.amount}.`
                    });
                }

                const transferId = crypto.randomUUID();

                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} - ${input.amount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, input.sourceFarmerId));

                await tx.insert(stockLogs).values({
                    farmerId: input.sourceFarmerId,
                    amount: (-input.amount).toString(),
                    type: "TRANSFER_OUT",
                    referenceId: transferId,
                    note: input.note ? `Transfer to ${targetFarmer.name}: ${input.note}` : `Transferred to ${targetFarmer.name}`,
                });

                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${input.amount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, input.targetFarmerId));

                await tx.insert(stockLogs).values({
                    farmerId: input.targetFarmerId,
                    amount: input.amount.toString(),
                    type: "TRANSFER_IN",
                    referenceId: transferId,
                    note: input.note ? `Received from ${sourceFarmer.name}: ${input.note}` : `Received from ${sourceFarmer.name}`,
                });

                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: input.orgId,
                        title: "Stock Transfer",
                        message: `Manager ${ctx.user.name} transferred ${input.amount} bags from ${sourceFarmer.name} to ${targetFarmer.name}.`,
                        type: "INFO",
                        link: `/management/farmers/${targetFarmer.id}`
                    });
                } catch (e) {
                    console.error("Failed to send transfer notification", e);
                }

                return { success: true };
            });
        }),

    addStock: managementProcedure
        .input(z.object({
            farmerId: z.string(),
            amount: z.number().positive().max(2000, "Max addition is 2000 bags"),
            note: z.string().max(500).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const f = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.id, input.farmerId),
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.status, "active")
                )
            });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            return await ctx.db.transaction(async (tx) => {
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${input.amount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, input.farmerId));

                await tx.insert(stockLogs).values({
                    farmerId: input.farmerId,
                    amount: input.amount.toString(),
                    type: "RESTOCK",
                    note: input.note || "Manual Restock",
                });

                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: input.orgId,
                        title: "Stock Added",
                        message: `Manager ${ctx.user.name} added ${input.amount} bags to ${f.name}.`,
                        type: "SUCCESS",
                        link: `/management/farmers/${f.id}`
                    });
                } catch (e) {
                    console.error("Failed to send stock notification", e);
                }
            });
        }),

    deductStock: managementProcedure
        .input(z.object({
            farmerId: z.string(),
            amount: z.number().positive().max(1000, "Max deduction is 1000 bags"),
            note: z.string().max(500).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const f = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.id, input.farmerId),
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.status, "active")
                )
            });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            return await ctx.db.transaction(async (tx) => {
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} - ${input.amount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, input.farmerId));

                await tx.insert(stockLogs).values({
                    farmerId: input.farmerId,
                    amount: (-input.amount).toString(),
                    type: "CORRECTION",
                    note: input.note || "Manual Deduction",
                });

                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: input.orgId,
                        title: "Stock Deducted",
                        message: `Manager ${ctx.user.name} deducted ${input.amount} bags from ${f.name}.`,
                        type: "WARNING",
                        link: `/management/farmers/${f.id}`
                    });
                } catch (e) {
                    console.error("Failed to send stock notification", e);
                }
            });
        }),
});
