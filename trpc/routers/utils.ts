import { cycleHistory, cycles, farmer, member, user } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export interface OfficerAnalyticsData {
    officerId: string;
    name: string | null;
    email: string | null;
    role: "ADMIN" | "MANAGER" | "OFFICER"; // Based on member table roles
    farmersCount: number;
    activeCycles: number;
    pastCycles: number;
    totalDoc: number;
    totalIntake: number;
    totalMortality: number;
}

export async function fetchOfficerAnalytics(db: any, orgId: string): Promise<OfficerAnalyticsData[]> {
    const farmersStats = db.$with('farmers_stats').as(
        db.select({
            officerId: farmer.officerId,
            count: sql<number>`count(*)`.as('count'),
        })
            .from(farmer)
            .where(eq(farmer.organizationId, orgId))
            .groupBy(farmer.officerId)
    );

    const activeCycleStats = db.$with('active_stats').as(
        db.select({
            officerId: farmer.officerId,
            totalDoc: sql<number>`sum(${cycles.doc})`.as('totalDoc'),
            totalIntake: sql<number>`sum(${cycles.intake})`.as('totalIntake'),
            totalMortality: sql<number>`sum(${cycles.mortality})`.as('totalMortality'),
            count: sql<number>`count(*)`.as('count'),
        })
            .from(cycles)
            .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
            .where(and(eq(cycles.organizationId, orgId), eq(cycles.status, 'active')))
            .groupBy(farmer.officerId)
    );

    const pastCycleStats = db.$with('past_stats').as(
        db.select({
            officerId: farmer.officerId,
            totalDoc: sql<number>`sum(${cycleHistory.doc})`.as('totalDoc'),
            totalIntake: sql<number>`sum(${cycleHistory.finalIntake})`.as('totalIntake'),
            totalMortality: sql<number>`sum(${cycleHistory.mortality})`.as('totalMortality'),
            count: sql<number>`count(*)`.as('count'),
        })
            .from(cycleHistory)
            .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
            .where(eq(cycleHistory.organizationId, orgId))
            .groupBy(farmer.officerId)
    );

    const results = await db
        .with(farmersStats, activeCycleStats, pastCycleStats)
        .select({
            officerId: member.userId,
            name: user.name,
            email: user.email,
            role: member.role,
            farmersCount: sql<number>`COALESCE(${farmersStats.count}, 0)`,
            activeCycles: sql<number>`COALESCE(${activeCycleStats.count}, 0)`,
            pastCycles: sql<number>`COALESCE(${pastCycleStats.count}, 0)`,
            totalDoc: sql<number>`COALESCE(${activeCycleStats.totalDoc}, 0) + COALESCE(${pastCycleStats.totalDoc}, 0)`,
            totalIntake: sql<number>`COALESCE(${activeCycleStats.totalIntake}, 0) + COALESCE(${pastCycleStats.totalIntake}, 0)`,
            totalMortality: sql<number>`COALESCE(${activeCycleStats.totalMortality}, 0) + COALESCE(${pastCycleStats.totalMortality}, 0)`,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .leftJoin(farmersStats, eq(member.userId, farmersStats.officerId))
        .leftJoin(activeCycleStats, eq(member.userId, activeCycleStats.officerId))
        .leftJoin(pastCycleStats, eq(member.userId, pastCycleStats.officerId))
        .where(and(eq(member.organizationId, orgId), eq(member.status, 'ACTIVE')))
        .orderBy(user.name);

    return results as OfficerAnalyticsData[];
}

