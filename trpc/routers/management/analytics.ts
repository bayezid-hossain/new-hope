import { cycles, farmer, member } from "@/db/schema";
import { and, count, eq } from "drizzle-orm";
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
});
