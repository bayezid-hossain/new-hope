import { cycles, farmer, featureRequest, member } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";
import { officerCyclesRouter } from "./cycles";
import { officerFarmersRouter } from "./farmers";
import { feedOrdersRouter } from "./feed-orders";
import { performanceReportsRouter } from "./performance-reports";
import { officerReportsRouter } from "./reports";
import { officerSalesRouter } from "./sales";
import { officerStockRouter } from "./stock";

export const officerRouter = createTRPCRouter({
    cycles: officerCyclesRouter,
    farmers: officerFarmersRouter,
    feedOrders: feedOrdersRouter,
    stock: officerStockRouter,
    sales: officerSalesRouter,
    reports: officerReportsRouter,
    performanceReports: performanceReportsRouter,

    getDashboardStats: protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
            const { orgId } = input;
            const officerId = ctx.user.id;

            // SECURITY: Verify user is a member of this organization
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, orgId),
                        eq(member.status, "ACTIVE")
                    )
                });
                if (!membership) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization" });
                }
            }

            // 1. Get all active farmers managed by this officer
            const activeFarmers = await ctx.db.select({
                id: farmer.id,
                mainStock: farmer.mainStock,
            })
                .from(farmer)
                .where(and(
                    eq(farmer.organizationId, orgId),
                    eq(farmer.officerId, officerId),
                    eq(farmer.status, "active")
                ));

            const totalMainStock = activeFarmers.reduce((sum, f) => sum + (f.mainStock || 0), 0);
            const farmerIds = activeFarmers.map(f => f.id);

            if (farmerIds.length === 0) {
                return {
                    totalBirds: 0,
                    totalFeedStock: 0,
                    activeConsumption: 0,
                    availableStock: 0,
                    lowStockCount: 0,
                    avgMortality: "0",
                    activeCyclesCount: 0
                };
            }

            // 2. Get all active cycles for these farmers
            const activeCycles = await ctx.db.select({
                id: cycles.id,
                farmerId: cycles.farmerId,
                doc: cycles.doc,
                mortality: cycles.mortality,
                intake: cycles.intake,
            })
                .from(cycles)
                .where(and(
                    eq(cycles.organizationId, orgId),
                    eq(cycles.status, "active"),
                    sql`${cycles.farmerId} IN ${farmerIds}`
                ));

            const totalActiveConsumption = activeCycles.reduce((sum, c) => sum + (c.intake || 0), 0);
            const totalBirds = activeCycles.reduce((sum, c) => sum + (c.doc - c.mortality), 0);
            const totalDoc = activeCycles.reduce((sum, c) => sum + c.doc, 0);
            const totalMortality = activeCycles.reduce((sum, c) => sum + c.mortality, 0);

            // 3. Calculate Low Stock Count (per farmer)
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
                totalFeedStock: totalMainStock,
                activeConsumption: totalActiveConsumption,
                availableStock: totalMainStock - totalActiveConsumption,
                lowStockCount,
                avgMortality,
                activeCyclesCount: activeCycles.length
            };
        }),
    getMyRequestStatus: protectedProcedure
        .input(z.object({ feature: z.literal("PRO_PACK").optional().default("PRO_PACK") }))
        .query(async ({ ctx, input }) => {
            const [request] = await ctx.db
                .select()
                .from(featureRequest)
                .where(
                    and(
                        eq(featureRequest.userId, ctx.user.id),
                        eq(featureRequest.feature, input.feature)
                    )
                )
                .orderBy(desc(featureRequest.createdAt))
                .limit(1);

            return request || null;
        }),
    requestAccess: protectedProcedure
        .input(z.object({ feature: z.literal("PRO_PACK") }))
        .mutation(async ({ ctx, input }) => {
            // Check if already has a pending request
            const [existing] = await ctx.db
                .select()
                .from(featureRequest)
                .where(
                    and(
                        eq(featureRequest.userId, ctx.user.id),
                        eq(featureRequest.feature, "PRO_PACK"),
                        eq(featureRequest.status, "PENDING")
                    )
                )
                .limit(1);

            if (existing) {
                return { success: true, alreadyExists: true };
            }

            await ctx.db.insert(featureRequest).values({
                userId: ctx.user.id,
                feature: "PRO_PACK",
            });
            return { success: true };
        }),
});
