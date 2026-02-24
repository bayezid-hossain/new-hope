import { farmer, stockLogs } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, managementProProcedure } from "../../init";

export const managementStockRouter = createTRPCRouter({
    getAllFarmersStock: managementProProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(20),
            cursor: z.number().default(0),
            officerId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const officerFilter = input.officerId
                ? eq(farmer.officerId, input.officerId)
                : undefined;

            const items = await ctx.db.query.farmer.findMany({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    officerFilter,
                    eq(farmer.status, "active")
                ),
                columns: {
                    id: true,
                    name: true,
                    mainStock: true,
                    updatedAt: true,
                },
                orderBy: desc(farmer.updatedAt),
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

    getImportHistory: managementProProcedure
        .input(z.object({
            limit: z.number().min(1).max(50).default(20),
            cursor: z.number().default(0),
            officerId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const officerFilter = input.officerId
                ? sql`AND farmer_id IN (SELECT id FROM ${farmer} WHERE officer_id = ${input.officerId} AND organization_id = ${input.orgId})`
                : sql`AND farmer_id IN (SELECT id FROM ${farmer} WHERE organization_id = ${input.orgId})`;

            const result: any = await ctx.db.execute(sql`
                SELECT 
                    reference_id as "batchId",
                    MIN(created_at) as "createdAt",
                    COUNT(*) as "count",
                    SUM(CAST(amount AS NUMERIC)) as "totalAmount",
                    MAX(driver_name) as "driverName"
                FROM ${stockLogs}
                WHERE type = 'RESTOCK' 
                AND reference_id IS NOT NULL
                ${officerFilter}
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
});
