import { cycleHistory, cycles, farmer, saleEvents, saleReports } from "@/db/schema";
import { and, desc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, managementProProcedure } from "../../init";
import { appendCycleContextToSales } from "../officer/sales";

export const managementSalesRouter = createTRPCRouter({
    getRecentSales: managementProProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(20),
            cursor: z.object({ saleDate: z.date(), id: z.string() }).nullish(),
            search: z.string().optional(),
            officerId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const search = input.search?.trim();

            const conditions: any[] = [
                eq(farmer.organizationId, input.orgId),
                ne(farmer.status, "deleted"),
            ];

            if (input.officerId) {
                conditions.push(eq(saleEvents.createdBy, input.officerId));
            }

            if (input.cursor) {
                conditions.push(
                    sql`(${saleEvents.saleDate}, ${saleEvents.id}) < (${input.cursor.saleDate}, ${input.cursor.id})`
                );
            }

            if (search) {
                const pattern = `%${search}%`;
                conditions.push(
                    or(
                        ilike(farmer.name, pattern),
                        ilike(saleEvents.party, pattern),
                        ilike(saleEvents.location, pattern)
                    )!
                );
            }

            // Step 1: pick the page's ids in SQL (filters + cursor + order live here).
            // One extra row tells us whether another page exists.
            const pageRows = await ctx.db
                .select({ id: saleEvents.id, saleDate: saleEvents.saleDate })
                .from(saleEvents)
                .leftJoin(cycles, eq(saleEvents.cycleId, cycles.id))
                .leftJoin(cycleHistory, eq(saleEvents.historyId, cycleHistory.id))
                .innerJoin(
                    farmer,
                    eq(farmer.id, sql`coalesce(${cycles.farmerId}, ${cycleHistory.farmerId})`)
                )
                .where(and(...conditions))
                .orderBy(desc(saleEvents.saleDate), desc(saleEvents.id))
                .limit(input.limit + 1);

            const hasMore = pageRows.length > input.limit;
            const pageSlice = pageRows.slice(0, input.limit);

            if (pageSlice.length === 0) {
                return { items: [], nextCursor: null };
            }

            const pageIds = pageSlice.map(r => r.id);

            // Step 2: hydrate the page with its relations.
            const events = await ctx.db.query.saleEvents.findMany({
                where: inArray(saleEvents.id, pageIds),
                orderBy: [desc(saleEvents.saleDate), desc(saleEvents.id)],
                with: {
                    cycle: { with: { farmer: true } },
                    history: { with: { farmer: true } },
                    reports: {
                        with: { createdByUser: { columns: { name: true } } },
                        orderBy: desc(saleReports.createdAt),
                        columns: {
                            id: true,
                            birdsSold: true,
                            birdsRejected: true,
                            totalWeight: true,
                            pricePerKg: true,
                            totalAmount: true,
                            avgWeight: true,
                            totalMortality: true,
                            cashReceived: true,
                            depositReceived: true,
                            medicineCost: true,
                            adjustmentNote: true,
                            party: true,
                            feedConsumed: true,
                            feedStock: true,
                            feedPriceUsed: true,
                            docPriceUsed: true,
                            recoveryPrice: true,
                            age: true,
                            createdAt: true,
                            officialInputDate: true,
                            saleDate: true,
                        }
                    }
                }
            });

            const items = await appendCycleContextToSales(ctx, events);
            const last = pageSlice[pageSlice.length - 1];

            return {
                items,
                nextCursor: hasMore ? { saleDate: last.saleDate, id: last.id } : null,
            };
        }),
});
