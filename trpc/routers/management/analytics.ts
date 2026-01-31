import { cycles, farmer, member } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";
import { fetchOfficerAnalytics } from "../utils";

export const managementAnalyticsRouter = createTRPCRouter({
    getOfficerAnalytics: protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, input.orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            return await fetchOfficerAnalytics(ctx.db, input.orgId);
        }),

    getDashboardStats: protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Access Check (Manager/Owner)
            const membership = await ctx.db.query.member.findFirst({
                where: and(
                    eq(member.userId, ctx.user.id),
                    eq(member.organizationId, input.orgId),
                    eq(member.status, "ACTIVE")
                )
            });
            if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

            const [memberCount] = await ctx.db.select({ count: count() })
                .from(member)
                .where(eq(member.organizationId, input.orgId));

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
