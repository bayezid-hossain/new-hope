
import { farmer, member, saleEvents, stockLogs } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";

export const managementReportsRouter = createTRPCRouter({
    getSalesSummary: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            startDate: z.date().optional(),
            endDate: z.date().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, startDate, endDate } = input;

            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership || (membership.role !== "OWNER" && membership.role !== "MANAGER")) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "Only Managers and Owners can view reports" });
                }
            }

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

    getSalesLedger: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            farmerId: z.string(),
            page: z.number().default(1),
            pageSize: z.number().default(20),
            startDate: z.date().optional(),
            endDate: z.date().optional()
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, farmerId, page, pageSize, startDate, endDate } = input;

            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership || (membership.role !== "OWNER" && membership.role !== "MANAGER")) {
                    throw new TRPCError({ code: "FORBIDDEN" });
                }
            }

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
                price: s.pricePerKg
            }));

            return {
                items,
                total: totalCount,
                totalPages: Math.ceil(totalCount / pageSize)
            };
        }),

    getStockSummary: protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, input.orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

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

    getStockLedger: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            page: z.number().default(1),
            pageSize: z.number().default(20),
            farmerId: z.string().optional(),
            startDate: z.date().optional(),
            endDate: z.date().optional()
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, page, pageSize, farmerId, startDate, endDate } = input;

            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

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
});
