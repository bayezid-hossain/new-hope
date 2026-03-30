import { saleEvents, saleReports } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, managementProProcedure } from "../../init";
import { appendCycleContextToSales } from "../officer/sales";

export const managementSalesRouter = createTRPCRouter({
    getRecentSales: managementProProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(20),
            search: z.string().optional(),
            officerId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const events = await ctx.db.query.saleEvents.findMany({
                where: input.officerId
                    ? eq(saleEvents.createdBy, input.officerId)
                    : undefined, // No officerId = show all sales in org
                orderBy: desc(saleEvents.saleDate),
                limit: input.search ? 200 : input.limit,
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

            // Filter by org: only include sales where the farmer belongs to this org
            const orgId = input.orgId;
            const orgFiltered = events.filter(e => {
                const f = e.cycle?.farmer ?? e.history?.farmer;
                if (!f) return false;
                if (f.organizationId !== orgId) return false;
                if (f.status === "deleted") return false;
                return true;
            });

            return await appendCycleContextToSales(ctx, orgFiltered, input.search, input.limit);
        }),
});
