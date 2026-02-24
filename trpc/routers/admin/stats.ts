import { cycles, farmer, organization, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../../init";

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    if (ctx.user.globalRole !== "ADMIN") {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to access admin resources."
        });
    }
    return next();
});

export const adminStatsRouter = createTRPCRouter({
    getDashboardStats: adminProcedure.query(async ({ ctx }) => {
        const [orgCount] = await ctx.db.select({ count: count() }).from(organization);
        const [userCount] = await ctx.db.select({ count: count() }).from(user);
        const [farmerCount] = await ctx.db.select({ count: count() })
            .from(farmer)
            .where(eq(farmer.status, "active"));
        const [activeCycles] = await ctx.db.select({ count: count() })
            .from(cycles)
            .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
            .where(and(
                eq(cycles.status, "active"),
                eq(farmer.status, "active")
            ));

        // Calculate Total Active Birds
        const activeCyclesData = await ctx.db.select({ doc: cycles.doc, mortality: cycles.mortality })
            .from(cycles)
            .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
            .where(and(
                eq(cycles.status, "active"),
                eq(farmer.status, "active")
            ));

        const totalActiveBirds = activeCyclesData.reduce((acc, c) => acc + (c.doc - (c.mortality || 0)), 0);

        return {
            orgs: orgCount.count,
            users: userCount.count,
            farmers: farmerCount.count,
            activeCycles: activeCycles.count,
            totalActiveBirds
        };
    }),
});
