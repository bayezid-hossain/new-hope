
import { cycleHistory, cycles, farmer } from "@/db/schema";
import { and, eq, gte, lte, ne } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, proProcedure } from "../../init";

export const officerReportsRouter = createTRPCRouter({
    getMonthlyDocPlacements: proProcedure
        .input(z.object({
            month: z.number().min(1).max(12),
            year: z.number().int().min(2000).max(2100),
        }))
        .query(async ({ ctx, input }) => {
            const { month, year } = input;

            // Helper to get date ranges safely without JS date overflow
            const prevMonth = month - 1 === 0 ? 12 : month - 1;
            const prevYear = month - 1 === 0 ? year - 1 : year;
            
            const prevMonthDays = new Date(prevYear, prevMonth, 0).getDate();
            const startDate = prevMonthDays === 31 
                ? new Date(prevYear, prevMonth - 1, 31, 0, 0, 0)
                : new Date(year, month - 1, 1, 0, 0, 0);

            const currentMonthDays = new Date(year, month, 0).getDate();
            const endDate = currentMonthDays === 31
                ? new Date(year, month - 1, 30, 23, 59, 59, 999)
                : new Date(year, month, 0, 23, 59, 59, 999);

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
                    ne(farmer.status, "deleted"),
                    ne(cycles.status, "deleted"),
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
                    ne(farmer.status, "deleted"),
                    ne(cycleHistory.status, "deleted"),
                    gte(cycleHistory.startDate, startDate), // History has explicit start_date
                    lte(cycleHistory.startDate, endDate)
                ));

            // Combine and Group
            const allCycles = [...activeCycles, ...historicalCycles];

            const groupedByFarmer: Record<string, {
                farmerId: string;
                farmerName: string;
                totalDoc: number;
                cycles: { name: string; doc: number; date: Date; status: string }[]
            }> = {};

            let totalDocForMonth = 0;

            for (const c of allCycles) {
                if (!groupedByFarmer[c.farmerId]) {
                    groupedByFarmer[c.farmerId] = {
                        farmerId: c.farmerId,
                        farmerName: c.farmerName,
                        totalDoc: 0,
                        cycles: []
                    };
                }

                groupedByFarmer[c.farmerId].totalDoc += c.doc;
                // Shift 31st dates to 1st of next month for display
                const displayDate = new Date(c.created);
                if (displayDate.getDate() === 31) {
                    displayDate.setMonth(displayDate.getMonth() + 1, 1);
                    displayDate.setHours(0, 0, 0, 0);
                }
                groupedByFarmer[c.farmerId].cycles.push({
                    name: c.cycleName,
                    doc: c.doc,
                    date: displayDate,
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
        }),

    getRangeDocPlacements: proProcedure
        .input(z.object({
            startMonth: z.number().min(1).max(12),
            startYear: z.number().int().min(2000).max(2100),
            endMonth: z.number().min(1).max(12),
            endYear: z.number().int().min(2000).max(2100),
        }))
        .query(async ({ ctx, input }) => {
            const { startMonth, startYear, endMonth, endYear } = input;

            const prevStartMonth = startMonth - 1 === 0 ? 12 : startMonth - 1;
            const prevStartYear = startMonth - 1 === 0 ? startYear - 1 : startYear;
            const prevStartMonthDays = new Date(prevStartYear, prevStartMonth, 0).getDate();
            const startDate = prevStartMonthDays === 31 
                ? new Date(prevStartYear, prevStartMonth - 1, 31, 0, 0, 0)
                : new Date(startYear, startMonth - 1, 1, 0, 0, 0);

            const currentEndMonthDays = new Date(endYear, endMonth, 0).getDate();
            const endDate = currentEndMonthDays === 31
                ? new Date(endYear, endMonth - 1, 30, 23, 59, 59, 999)
                : new Date(endYear, endMonth, 0, 23, 59, 59, 999);

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
                    ne(farmer.status, "deleted"),
                    ne(cycles.status, "deleted"),
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
                    ne(farmer.status, "deleted"),
                    ne(cycleHistory.status, "deleted"),
                    gte(cycleHistory.startDate, startDate),
                    lte(cycleHistory.startDate, endDate)
                ));

            const allCycles = [...activeCycles, ...historicalCycles];

            const groupedByFarmer: Record<string, {
                farmerId: string;
                farmerName: string;
                totalDoc: number;
                cycles: { name: string; doc: number; date: Date; status: string }[]
            }> = {};

            let totalDocRange = 0;

            for (const c of allCycles) {
                if (!groupedByFarmer[c.farmerId]) {
                    groupedByFarmer[c.farmerId] = {
                        farmerId: c.farmerId,
                        farmerName: c.farmerName,
                        totalDoc: 0,
                        cycles: []
                    };
                }

                groupedByFarmer[c.farmerId].totalDoc += c.doc;
                // Shift 31st dates to 1st of next month for display
                const displayDate = new Date(c.created);
                if (displayDate.getDate() === 31) {
                    displayDate.setMonth(displayDate.getMonth() + 1, 1);
                    displayDate.setHours(0, 0, 0, 0);
                }
                groupedByFarmer[c.farmerId].cycles.push({
                    name: c.cycleName,
                    doc: c.doc,
                    date: displayDate,
                    status: c.status
                });

                totalDocRange += c.doc;
            }

            const farmerStats = Object.values(groupedByFarmer).sort((a, b) => b.totalDoc - a.totalDoc);

            return {
                summary: {
                    totalDoc: totalDocRange,
                    farmerCount: farmerStats.length,
                    cycleCount: allCycles.length,
                    startMonth: new Date(startYear, startMonth - 1).toLocaleString('default', { month: 'long' }),
                    startYear,
                    endMonth: new Date(endYear, endMonth - 1).toLocaleString('default', { month: 'long' }),
                    endYear
                },
                farmers: farmerStats
            };
        })
});
