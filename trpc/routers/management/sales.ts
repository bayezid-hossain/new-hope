import { saleEvents, saleReports } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, managementProcedure } from "../../init";

export const managementSalesRouter = createTRPCRouter({
    getRecentSales: managementProcedure
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
                            createdAt: true,
                            pricePerKg: true,
                            totalWeight: true,
                            totalAmount: true,
                        }
                    }
                }
            });

            // Filter by org: only include sales where the farmer belongs to this org
            const orgId = input.orgId;
            const orgFiltered = events.filter(e => {
                const f = e.cycle?.farmer ?? e.history?.farmer;
                return f?.organizationId === orgId;
            });

            // If searching, filter by farmer name
            if (input.search) {
                const s = input.search.toLowerCase();
                const filtered = orgFiltered.filter(e => {
                    const f = e.cycle?.farmer ?? e.history?.farmer;
                    return f?.name?.toLowerCase().includes(s);
                });
                return filtered.slice(0, input.limit);
            }

            return orgFiltered;
        }),
});
