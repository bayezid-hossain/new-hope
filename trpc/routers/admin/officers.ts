
import { cycleHistory, cycles, farmer, featureRequest, member, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";

// Middleware for Admin access
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    if (ctx.user.globalRole !== "ADMIN") {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to access admin resources."
        });
    }
    return next();
});

export const adminOfficersRouter = createTRPCRouter({
    getDetails: adminProcedure
        .input(z.object({ orgId: z.string(), userId: z.string() }))
        .query(async ({ ctx, input }) => {
            // 1. Get the member info
            const membership = await ctx.db.query.member.findFirst({
                where: and(
                    eq(member.organizationId, input.orgId),
                    eq(member.userId, input.userId)
                ),
                with: {
                    user: true
                }
            });

            if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Officer not found in this organization." });

            // 2. Get managed farmers
            const managedFarmers = await ctx.db.query.farmer.findMany({
                where: and(
                    eq(farmer.officerId, input.userId),
                    eq(farmer.organizationId, input.orgId)
                ),
                with: {
                    cycles: {
                        where: eq(cycles.status, "active")
                    },
                    history: true
                }
            });

            const farmerIds = managedFarmers.map(f => f.id);

            // 3. Aggregate stats
            let stats = {
                activeCycles: 0,
                pastCycles: 0,
                totalDoc: 0,
                totalIntake: 0,
                totalMortality: 0
            };

            if (farmerIds.length > 0) {
                const activeBatch = await ctx.db.select({
                    totalDoc: sql<number>`sum(${cycles.doc})`,
                    totalIntake: sql<number>`sum(${cycles.intake})`,
                    totalMortality: sql<number>`sum(${cycles.mortality})`,
                    count: sql<number>`count(*)`
                })
                    .from(cycles)
                    .where(
                        and(
                            eq(cycles.organizationId, input.orgId),
                            sql`${cycles.farmerId} IN ${farmerIds}`,
                            eq(cycles.status, "active")
                        )
                    );

                const pastBatch = await ctx.db.select({
                    totalDoc: sql<number>`sum(${cycleHistory.doc})`,
                    totalIntake: sql<number>`sum(${cycleHistory.finalIntake})`,
                    totalMortality: sql<number>`sum(${cycleHistory.mortality})`,
                    count: sql<number>`count(*)`
                })
                    .from(cycleHistory)
                    .where(
                        and(
                            eq(cycleHistory.organizationId, input.orgId),
                            sql`${cycleHistory.farmerId} IN ${farmerIds}`
                        )
                    );

                stats = {
                    activeCycles: Number(activeBatch[0]?.count || 0),
                    pastCycles: Number(pastBatch[0]?.count || 0),
                    totalDoc: Number(activeBatch[0]?.totalDoc || 0) + Number(pastBatch[0]?.totalDoc || 0),
                    totalIntake: Number(activeBatch[0]?.totalIntake || 0) + Number(pastBatch[0]?.totalIntake || 0),
                    totalMortality: Number(activeBatch[0]?.totalMortality || 0) + Number(pastBatch[0]?.totalMortality || 0)
                };
            }

            return {
                officer: membership.user,
                role: membership.role,
                stats,
                farmers: managedFarmers.map(f => ({
                    ...f,
                    activeCyclesCount: f.cycles.length,
                    pastCyclesCount: f.history.length
                }))
            };
        }),

    getProductionTree: adminProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
            // 1. Get all members active in the organization
            const members = await ctx.db.query.member.findMany({
                where: and(
                    eq(member.organizationId, input.orgId),
                    eq(member.status, "ACTIVE")
                ),
                with: {
                    user: true
                }
            });

            // 2. Get all farmers in the organization
            const farmersList = await ctx.db.query.farmer.findMany({
                where: eq(farmer.organizationId, input.orgId),
                with: {
                    cycles: true,
                    history: true
                }
            });

            // 3. Map farmers to officers
            return members.map(m => {
                const managedFarmers = farmersList.filter(f => f.officerId === m.userId);
                return {
                    id: m.id,
                    userId: m.userId,
                    name: m.user.name,
                    email: m.user.email,
                    role: m.role,
                    farmers: managedFarmers.map(f => ({
                        id: f.id,
                        name: f.name,
                        mainStock: f.mainStock,
                        activeCycles: f.cycles.filter(c => c.status === "active"),
                        pastCycles: f.history
                    }))
                };
            });
        }),

    toggleProStatus: adminProcedure
        .input(z.object({
            userId: z.string(),
            isPro: z.boolean()
        }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.transaction(async (tx) => {
                // 1. Update User Pro Status
                await tx.update(user)
                    .set({ isPro: input.isPro })
                    .where(eq(user.id, input.userId));

                // 2. If disabling Pro, reset "APPROVED" feature requests to "REJECTED" 
                // so they can request again if needed.
                if (!input.isPro) {
                    await tx.update(featureRequest)
                        .set({ status: "REJECTED" })
                        .where(and(
                            eq(featureRequest.userId, input.userId),
                            eq(featureRequest.status, "APPROVED")
                        ));
                }
            });

            return { success: true };
        }),
});
