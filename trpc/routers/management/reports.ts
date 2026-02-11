
import { cycleHistory, cycles, farmer, saleEvents, stockLogs } from "@/db/schema";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, managementProcedure, managementProProcedure } from "../../init";

export const managementReportsRouter = createTRPCRouter({
    getSalesSummary: managementProcedure
        .input(z.object({
            // orgId is inherited from managementProcedure
            startDate: z.date().optional(),
            endDate: z.date().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, startDate, endDate } = input;

            // 1. Get relevant farmers first (optional but good for strict org scoping)
            const farmersQuery = await ctx.db.select({ id: farmer.id, name: farmer.name }).from(farmer).where(eq(farmer.organizationId, orgId));
            const farmerMap = new Map(farmersQuery.map(f => [f.id, f.name]));
            const farmerIds = farmersQuery.map(f => f.id);

            if (farmerIds.length === 0) {
                return {
                    metrics: {
                        totalRevenue: 0,
                        totalBirdsSold: 0,
                        totalWeight: 0,
                        avgPricePerKg: 0,
                        totalMortality: 0
                    },
                    recentSales: []
                };
            }

            const whereClause = and(
                startDate ? gte(saleEvents.saleDate, startDate) : undefined,
                endDate ? lte(saleEvents.saleDate, endDate) : undefined
            );

            const salesData = await ctx.db.select({
                id: saleEvents.id,
                saleDate: saleEvents.saleDate,
                birdsSold: saleEvents.birdsSold,
                totalWeight: saleEvents.totalWeight,
                totalAmount: saleEvents.totalAmount,
                totalMortality: saleEvents.totalMortality,
                pricePerKg: saleEvents.pricePerKg,
                location: saleEvents.location, // Fallback
                cycleId: saleEvents.cycleId,
                historyId: saleEvents.historyId,
                // Join fields for filtering and naming
                cycleOrgId: sql<string>`cycles.organization_id`,
                historyOrgId: sql<string>`cycle_history.organization_id`,
                cycleFarmerId: sql<string>`cycles.farmer_id`,
                historyFarmerId: sql<string>`cycle_history.farmer_id`
            })
                .from(saleEvents)
                .leftJoin(sql`cycles`, eq(saleEvents.cycleId, sql`cycles.id`))
                .leftJoin(sql`cycle_history`, eq(saleEvents.historyId, sql`cycle_history.id`))
                .where(whereClause)
                .orderBy(desc(saleEvents.saleDate));

            // In-memory filter for OrgId
            const orgSales = salesData.filter(s =>
                s.cycleOrgId === orgId || s.historyOrgId === orgId
            );

            // Calculate Metrics
            const totalRevenue = orgSales.reduce((acc, s) => acc + parseFloat(s.totalAmount?.toString() || "0"), 0);
            const totalBirdsSold = orgSales.reduce((acc, s) => acc + s.birdsSold, 0);
            const totalWeight = orgSales.reduce((acc, s) => acc + parseFloat(s.totalWeight?.toString() || "0"), 0);
            const totalMortality = orgSales.reduce((acc, s) => acc + s.totalMortality, 0);

            const avgPricePerKg = totalWeight > 0 ? (totalRevenue / totalWeight) : 0;


            // Group by Farmer for the "Expandable Card" view
            // We need to know specific metrics per farmer: Revenue, Birds Sold, Last Sale Date
            const farmerStatsMap = new Map<string, {
                farmerId: string;
                name: string;
                totalRevenue: number;
                birdsSold: number;
                lastSaleDate: Date | null;
            }>();

            // Initialize map with all farmers (so even those with 0 sales show up if we want, or just active ones)
            // The user wants "search by location or farmer name", so listing all active farmers is safest.
            farmersQuery.forEach(f => {
                farmerStatsMap.set(f.id, {
                    farmerId: f.id,
                    name: f.name,
                    totalRevenue: 0,
                    birdsSold: 0,
                    lastSaleDate: null
                });
            });

            // Process sales to aggregate
            orgSales.forEach(s => {
                const farmerId = s.cycleFarmerId || s.historyFarmerId;
                if (farmerId && farmerStatsMap.has(farmerId)) {
                    const stats = farmerStatsMap.get(farmerId)!;
                    stats.totalRevenue += parseFloat(s.totalAmount?.toString() || "0");
                    stats.birdsSold += s.birdsSold;

                    if (!stats.lastSaleDate || s.saleDate > stats.lastSaleDate) {
                        stats.lastSaleDate = s.saleDate;
                    }
                }
                // TODO: Handle sales without clear farmer ID (fallback location?) - For now, these might be missed in per-farmer grouping
                // but included in global metrics.
            });

            const farmerStats = Array.from(farmerStatsMap.values()).sort((a, b) => {
                // Sort by revenue desc, then name
                if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue;
                return a.name.localeCompare(b.name);
            });

            return {
                metrics: {
                    totalRevenue,
                    totalBirdsSold,
                    totalWeight,
                    avgPricePerKg,
                    totalMortality
                },
                farmerStats // New field for the list view
            };
        }),

    getSalesLedger: managementProcedure
        .input(z.object({
            // orgId is inherited
            farmerId: z.string(),
            page: z.number().default(1),
            pageSize: z.number().default(20),
            startDate: z.date().optional(),
            endDate: z.date().optional()
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, farmerId, page, pageSize, startDate, endDate } = input;

            // Build Where Clause for specific farmer's sales
            // Need to join via Cycles/History again to ensure we only get sales for THIS farmer AND Org
            const whereClause = and(
                startDate ? gte(saleEvents.saleDate, startDate) : undefined,
                endDate ? lte(saleEvents.saleDate, endDate) : undefined,
                // We need to filter by farmerId. Since saleEvents doesn't have farmerId directly, 
                // we depend on the joins.
                // However, we can't easily put "OR(cycle.farmerId=X, history.farmerId=X)" in simple drizzle without complex aliases.
                // But we can filter by the fact that `cycles` or `cycle_history` join condition matches.
            );

            // We will fetch and filter in standard way or use the known farmer Link
            const offset = (page - 1) * pageSize;

            const salesData = await ctx.db.select({
                id: saleEvents.id,
                saleDate: saleEvents.saleDate,
                birdsSold: saleEvents.birdsSold,
                totalWeight: saleEvents.totalWeight,
                totalAmount: saleEvents.totalAmount,
                pricePerKg: saleEvents.pricePerKg,
                location: saleEvents.location,
                cycleId: saleEvents.cycleId,
                historyId: saleEvents.historyId,
                cycleFarmerId: sql<string>`cycles.farmer_id`,
                historyFarmerId: sql<string>`cycle_history.farmer_id`
            })
                .from(saleEvents)
                .leftJoin(sql`cycles`, eq(saleEvents.cycleId, sql`cycles.id`))
                .leftJoin(sql`cycle_history`, eq(saleEvents.historyId, sql`cycle_history.id`))
                .where(whereClause)
                .orderBy(desc(saleEvents.saleDate));

            // Filtering for specific Farmer ID
            const farmerSales = salesData.filter(s =>
                s.cycleFarmerId === farmerId || s.historyFarmerId === farmerId
            );

            const totalCount = farmerSales.length;
            const items = farmerSales.slice(offset, offset + pageSize).map(s => ({
                id: s.id,
                date: s.saleDate,
                location: s.location,
                birds: s.birdsSold,
                weight: s.totalWeight,
                amount: s.totalAmount,
                price: s.pricePerKg,
                cycleId: s.cycleId,
                historyId: s.historyId
            }));

            return {
                items,
                total: totalCount,
                totalPages: Math.ceil(totalCount / pageSize)
            };
        }),

    getStockSummary: managementProcedure
        // orgId is inherited
        .query(async ({ ctx, input }) => {

            const farmers = await ctx.db.select({
                id: farmer.id,
                name: farmer.name,
                mainStock: farmer.mainStock,
                updatedAt: farmer.updatedAt,
                status: farmer.status
            })
                .from(farmer)
                .where(and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.status, "active")
                ))
                .orderBy(desc(farmer.mainStock));

            const totalStock = farmers.reduce((acc, f) => acc + f.mainStock, 0);

            return {
                totalStock,
                farmers
            };
        }),

    getStockLedger: managementProcedure
        .input(z.object({
            // orgId is inherited
            page: z.number().default(1),
            pageSize: z.number().default(20),
            farmerId: z.string().optional(),
            startDate: z.date().optional(),
            endDate: z.date().optional()
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, page, pageSize, farmerId, startDate, endDate } = input;

            const offset = (page - 1) * pageSize;

            const whereClause = and(
                eq(farmer.organizationId, orgId), // Filter logs via farmer's org
                farmerId ? eq(stockLogs.farmerId, farmerId) : undefined,
                startDate ? gte(stockLogs.createdAt, startDate) : undefined,
                endDate ? lte(stockLogs.createdAt, endDate) : undefined,
            );

            const logs = await ctx.db.select({
                id: stockLogs.id,
                amount: stockLogs.amount,
                type: stockLogs.type,
                note: stockLogs.note,
                createdAt: stockLogs.createdAt,
                farmerName: farmer.name,
                farmerId: farmer.id
            })
                .from(stockLogs)
                .innerJoin(farmer, eq(stockLogs.farmerId, farmer.id)) // Join to check Org and get name
                .where(whereClause)
                .orderBy(desc(stockLogs.createdAt))
                .limit(pageSize)
                .offset(offset);

            // Type safe count
            // Need to join for count as well
            const [total] = await ctx.db.select({ count: sql<number>`count(*)` })
                .from(stockLogs)
                .innerJoin(farmer, eq(stockLogs.farmerId, farmer.id))
                .where(whereClause);

            return {
                items: logs,
                total: Number(total.count),
                totalPages: Math.ceil(Number(total.count) / pageSize)
            };
        }),
    getMonthlyDocPlacements: managementProProcedure
        .input(z.object({
            // orgId is inherited
            officerId: z.string(),
            month: z.number().min(1).max(12),
            year: z.number().int().min(2000).max(2100)
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, officerId, month, year } = input;

            // Verify the officer belongs to this org (optional but good practice)
            // We can just rely on the join with farmer->orgId, but if an officer has no farmers, we might show empty.
            // That's fine.

            const startDate = new Date(year, month - 1, 1);
            const nextMonth = month === 12 ? 1 : month + 1;
            const nextYear = month === 12 ? year + 1 : year;
            const endDate = new Date(nextYear, nextMonth - 1, 1);

            // Fetch Active Cycles
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
                    eq(farmer.organizationId, orgId),
                    eq(farmer.officerId, officerId),
                    gte(cycles.createdAt, startDate),
                    lte(cycles.createdAt, endDate)
                ));

            // Fetch History Cycles
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
                    eq(farmer.organizationId, orgId),
                    eq(farmer.officerId, officerId),
                    gte(cycleHistory.startDate, startDate),
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
        }),
});
