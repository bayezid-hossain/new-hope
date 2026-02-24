import { cycles, farmer, member } from "@/db/schema";
import { and, count, eq, sql } from "drizzle-orm";
import { createTRPCRouter, managementProcedure } from "../../init";
import { fetchOfficerAnalytics } from "../utils";

export const managementAnalyticsRouter = createTRPCRouter({
    getOfficerAnalytics: managementProcedure
        // orgId is inherited
        .query(async ({ ctx, input }) => {
            const { orgId } = input;

            return await fetchOfficerAnalytics(ctx.db, input.orgId);
        }),

    getDashboardStats: managementProcedure
        // orgId is inherited
        .query(async ({ ctx, input }) => {
            const { orgId } = input;

            const [memberCount] = await ctx.db.select({ count: count() })
                .from(member)
                .where(and(eq(member.organizationId, input.orgId), eq(member.status, "ACTIVE")));

            const [farmerCount] = await ctx.db.select({ count: count() })
                .from(farmer)
                .where(and(eq(farmer.organizationId, input.orgId), eq(farmer.status, "active")));

            const [activeCycles] = await ctx.db.select({ count: count() })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(and(
                    eq(cycles.organizationId, input.orgId),
                    eq(cycles.status, "active"),
                    eq(farmer.status, "active")
                ));

            return {
                members: memberCount.count,
                farmers: farmerCount.count,
                activeCycles: activeCycles.count
            };
        }),

    getGlobalDashboardStats: managementProcedure
        .query(async ({ ctx, input }) => {
            const { orgId } = input;

            // 1. Get all active farmers
            const activeFarmers = await ctx.db.select({
                id: farmer.id,
                mainStock: farmer.mainStock,
            })
                .from(farmer)
                .where(and(
                    eq(farmer.organizationId, orgId),
                    eq(farmer.status, "active")
                ));

            const totalMainStock = activeFarmers.reduce((sum, f) => sum + (f.mainStock || 0), 0);
            const farmerIds = activeFarmers.map(f => f.id);

            if (farmerIds.length === 0) {
                return {
                    totalBirds: 0,
                    totalBirdsSold: 0,
                    totalFeedStock: 0,
                    activeConsumption: 0,
                    availableStock: 0,
                    lowStockCount: 0,
                    avgMortality: "0",
                    activeCyclesCount: 0,
                    totalFarmers: 0
                };
            }

            // 2. Get all active cycles with birds remaining
            const activeCycles = await ctx.db.select({
                id: cycles.id,
                farmerId: cycles.farmerId,
                doc: cycles.doc,
                mortality: cycles.mortality,
                intake: cycles.intake,
                birdsSold: cycles.birdsSold,
            })
                .from(cycles)
                .where(and(
                    eq(cycles.organizationId, orgId),
                    eq(cycles.status, "active"),
                    sql`${cycles.doc} - ${cycles.mortality} - COALESCE(${cycles.birdsSold}, 0) > 0`,
                    sql`${cycles.farmerId} IN ${farmerIds}`
                ));

            const totalActiveConsumption = activeCycles.reduce((sum, c) => sum + (c.intake || 0), 0);
            const totalBirdsSold = activeCycles.reduce((sum, c) => sum + (c.birdsSold || 0), 0);
            const totalBirds = activeCycles.reduce((sum, c) => sum + (c.doc - c.mortality - (c.birdsSold || 0)), 0);
            const totalDoc = activeCycles.reduce((sum, c) => sum + c.doc, 0);
            const totalMortality = activeCycles.reduce((sum, c) => sum + c.mortality, 0);

            // 3. Calculate Low Stock Count
            const farmerConsumptionMap = new Map<string, number>();
            activeCycles.forEach(c => {
                const current = farmerConsumptionMap.get(c.farmerId) || 0;
                farmerConsumptionMap.set(c.farmerId, current + (c.intake || 0));
            });

            let lowStockCount = 0;
            activeFarmers.forEach(f => {
                const consumption = farmerConsumptionMap.get(f.id) || 0;
                const available = (f.mainStock || 0) - consumption;
                if (available < 3) lowStockCount++;
            });

            const avgMortality = totalDoc > 0
                ? ((totalMortality / totalDoc) * 100).toFixed(2)
                : "0";

            return {
                totalBirds,
                totalBirdsSold,
                totalFeedStock: totalMainStock,
                activeConsumption: totalActiveConsumption,
                availableStock: totalMainStock - totalActiveConsumption,
                lowStockCount,
                avgMortality,
                activeCyclesCount: activeCycles.length,
                totalFarmers: activeFarmers.length
            };
        }),
});
