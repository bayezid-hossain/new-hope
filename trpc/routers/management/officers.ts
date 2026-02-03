import { cycleHistory, cycles, farmer, member } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "../../init";

export const managementOfficersRouter = createTRPCRouter({
    getDetails: orgProcedure
        .input(z.object({ userId: z.string() })) // orgId inherited from orgProcedure input
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
                deletedCycles: 0,
                activeDoc: 0,
                activeIntake: 0,
                activeMortality: 0,
                pastDoc: 0,
                pastIntake: 0,
                pastMortality: 0,
                totalDoc: 0,
                totalIntake: 0,
                totalMortality: 0,
                totalMainStock: 0
            };

            const activeIds = managedFarmers
                .filter(f => f.status === "active")
                .map(f => f.id);

            const allManagedIds = managedFarmers.map(f => f.id);

            if (activeIds.length > 0) {
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
                            inArray(cycles.farmerId, activeIds),
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
                            inArray(cycleHistory.farmerId, allManagedIds),
                            ne(cycleHistory.status, "deleted")
                        )
                    );

                const deletedBatch = await ctx.db.select({
                    count: sql<number>`count(*)`
                })
                    .from(cycleHistory)
                    .where(
                        and(
                            eq(cycleHistory.organizationId, input.orgId),
                            inArray(cycleHistory.farmerId, allManagedIds),
                            eq(cycleHistory.status, "deleted")
                        )
                    );

                stats = {
                    activeCycles: Number(activeBatch[0]?.count || 0),
                    pastCycles: Number(pastBatch[0]?.count || 0),
                    deletedCycles: Number(deletedBatch[0]?.count || 0),
                    activeDoc: Number(activeBatch[0]?.totalDoc || 0),
                    activeIntake: Number(activeBatch[0]?.totalIntake || 0),
                    activeMortality: Number(activeBatch[0]?.totalMortality || 0),
                    pastDoc: Number(pastBatch[0]?.totalDoc || 0),
                    pastIntake: Number(pastBatch[0]?.totalIntake || 0),
                    pastMortality: Number(pastBatch[0]?.totalMortality || 0),
                    totalDoc: Number(activeBatch[0]?.totalDoc || 0),
                    totalIntake: Number(activeBatch[0]?.totalIntake || 0),
                    totalMortality: Number(activeBatch[0]?.totalMortality || 0),
                    totalMainStock: managedFarmers
                        .filter(f => f.status === "active")
                        .reduce((acc, f) => acc + f.mainStock, 0)
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

    getProductionTree: orgProcedure
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
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.status, "active")
                ),
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
});
