
import { cycleHistory, cycles, farmer } from "@/db/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, officerProcedure } from "../../init";

export const officerReportsRouter = createTRPCRouter({
    getMonthlyDocPlacements: officerProcedure
        .input(z.object({
            month: z.number().min(1).max(12),
            year: z.number().int().min(2000).max(2100)
        }))
        .query(async ({ ctx, input }) => {
            const { month, year } = input;

            // Start and end dates for the month (careful with JS dates vs UTC)
            // We want cycles created in this month.
            // Cycle createdAt or startDate? Usually DOC placement happens at cycle creation (or doc field is set then).
            // Let's use `createdAt` for active cycles and `startDate` for history (or `startDate` for both if available).
            // Schema has `createdAt` for active, and `startDate` for history.

            const startDate = new Date(year, month - 1, 1);
            const nextMonth = month === 12 ? 1 : month + 1;
            const nextYear = month === 12 ? year + 1 : year;
            const endDate = new Date(nextYear, nextMonth - 1, 1);

            // Fetch Active Cycles started in this range
            const activeCycles = await ctx.db.select({
                farmerId: farmer.id,
                farmerName: farmer.name,
                doc: cycles.doc,
                created: cycles.createdAt,
                status: cycles.status,
                cycleName: cycles.name
            })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(and(
                    eq(farmer.officerId, ctx.user.id),
                    gte(cycles.createdAt, startDate),
                    lte(cycles.createdAt, endDate)
                ));

            // Fetch History Cycles started in this range
            const historicalCycles = await ctx.db.select({
                farmerId: farmer.id,
                farmerName: farmer.name,
                doc: cycleHistory.doc,
                created: cycleHistory.startDate,
                status: cycleHistory.status,
                cycleName: cycleHistory.cycleName
            })
                .from(cycleHistory)
                .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
                .where(and(
                    eq(farmer.officerId, ctx.user.id),
                    gte(cycleHistory.startDate, startDate), // History has explicit start_date
                    lte(cycleHistory.startDate, endDate)
                ));

            // Combine and Group
            const allCycles = [...activeCycles, ...historicalCycles];

            const groupedByFarmer: Record<string, {
                farmerName: string;
                totalDoc: number;
                cycles: { name: string; doc: number; date: Date; status: string }[]
            }> = {};

            let totalDocForMonth = 0;

            for (const c of allCycles) {
                if (!groupedByFarmer[c.farmerId]) {
                    groupedByFarmer[c.farmerId] = {
                        farmerName: c.farmerName,
                        totalDoc: 0,
                        cycles: []
                    };
                }

                groupedByFarmer[c.farmerId].totalDoc += c.doc;
                groupedByFarmer[c.farmerId].cycles.push({
                    name: c.cycleName,
                    doc: c.doc,
                    date: c.created,
                    status: c.status
                });

                totalDocForMonth += c.doc;
            }

            // Convert to array
            const farmerStats = Object.values(groupedByFarmer).sort((a, b) => b.totalDoc - a.totalDoc);

            return {
                summary: {
                    totalDoc: totalDocForMonth,
                    farmerCount: farmerStats.length,
                    cycleCount: allCycles.length,
                    month: new Date(year, month - 1).toLocaleString('default', { month: 'long' }),
                    year
                },
                farmers: farmerStats
            };
        })
});
