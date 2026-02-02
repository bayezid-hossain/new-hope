import { cycleHistory, cycles, farmer, member, user } from "@/db/schema";
import { and, eq, ne, sql } from "drizzle-orm";

export interface OfficerAnalyticsData {
    officerId: string;
    name: string | null;
    email: string | null;
    role: "ADMIN" | "MANAGER" | "OFFICER"; // Based on member table roles
    farmersCount: number;
    activeCycles: number;
    pastCycles: number;
    activeDoc: number;
    activeIntake: number;
    activeMortality: number;
    pastDoc: number;
    pastIntake: number;
    pastMortality: number;
    totalDoc: number;
    totalIntake: number;
    totalMortality: number;
    totalMainStock: number;
}

export async function fetchOfficerAnalytics(db: any, orgId: string): Promise<OfficerAnalyticsData[]> {
    const farmersStats = db.$with('farmers_stats').as(
        db.select({
            officerId: farmer.officerId,
            farmersCount: sql<number>`count(*)`.as('farmersCount'),
            totalMainStock: sql<number>`sum(${farmer.mainStock})`.as('totalMainStock'),
        })
            .from(farmer)
            .where(and(eq(farmer.status, "active"), eq(farmer.organizationId, orgId)))
            .groupBy(farmer.officerId)
    );

    const activeCycleStats = db.$with('active_stats').as(
        db.select({
            officerId: farmer.officerId,
            activeTotalDoc: sql<number>`sum(${cycles.doc})`.as('activeTotalDoc'),
            activeTotalIntake: sql<number>`sum(${cycles.intake})`.as('activeTotalIntake'),
            activeTotalMortality: sql<number>`sum(${cycles.mortality})`.as('activeTotalMortality'),
            activeCount: sql<number>`count(*)`.as('activeCount'),
        })
            .from(cycles)
            .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
            .where(and(
                eq(cycles.organizationId, orgId),
                eq(cycles.status, 'active'),
                eq(farmer.status, 'active')
            ))
            .groupBy(farmer.officerId)
    );

    const pastCycleStats = db.$with('past_stats').as(
        db.select({
            officerId: farmer.officerId,
            pastTotalDoc: sql<number>`sum(${cycleHistory.doc})`.as('pastTotalDoc'),
            pastTotalIntake: sql<number>`sum(${cycleHistory.finalIntake})`.as('pastTotalIntake'),
            pastTotalMortality: sql<number>`sum(${cycleHistory.mortality})`.as('pastTotalMortality'),
            pastCount: sql<number>`count(*)`.as('pastCount'),
        })
            .from(cycleHistory)
            .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
            .where(and(
                eq(cycleHistory.organizationId, orgId),
                ne(cycleHistory.status, "deleted")
            ))
            .groupBy(farmer.officerId)
    );

    const results = await db
        .with(farmersStats, activeCycleStats, pastCycleStats)
        .select({
            officerId: member.userId,
            name: user.name,
            email: user.email,
            role: member.role,
            farmersCount: sql<number>`COALESCE(${farmersStats.farmersCount}, 0)`,
            totalMainStock: sql<number>`COALESCE(${farmersStats.totalMainStock}, 0)`,
            activeCycles: sql<number>`COALESCE(${activeCycleStats.activeCount}, 0)`,
            pastCycles: sql<number>`COALESCE(${pastCycleStats.pastCount}, 0)`,
            activeDoc: sql<number>`COALESCE(${activeCycleStats.activeTotalDoc}, 0)`,
            activeIntake: sql<number>`COALESCE(${activeCycleStats.activeTotalIntake}, 0)`,
            activeMortality: sql<number>`COALESCE(${activeCycleStats.activeTotalMortality}, 0)`,
            pastDoc: sql<number>`COALESCE(${pastCycleStats.pastTotalDoc}, 0)`,
            pastIntake: sql<number>`COALESCE(${pastCycleStats.pastTotalIntake}, 0)`,
            pastMortality: sql<number>`COALESCE(${pastCycleStats.pastTotalMortality}, 0)`,
            // Total fields reflect CURRENT load (Active batches of active farmers)
            totalDoc: sql<number>`COALESCE(${activeCycleStats.activeTotalDoc}, 0)`,
            totalIntake: sql<number>`COALESCE(${activeCycleStats.activeTotalIntake}, 0)`,
            totalMortality: sql<number>`COALESCE(${activeCycleStats.activeTotalMortality}, 0)`,
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .leftJoin(farmersStats, eq(member.userId, farmersStats.officerId))
        .leftJoin(activeCycleStats, eq(member.userId, activeCycleStats.officerId))
        .leftJoin(pastCycleStats, eq(member.userId, pastCycleStats.officerId))
        .where(and(eq(member.organizationId, orgId), eq(member.status, 'ACTIVE')))
        .orderBy(user.name);

    return results.map((r: any) => ({
        ...r,
        farmersCount: Number(r.farmersCount || 0),
        activeCycles: Number(r.activeCycles || 0),
        pastCycles: Number(r.pastCycles || 0),
        activeDoc: Number(r.activeDoc || 0),
        activeIntake: Number(r.activeIntake || 0),
        activeMortality: Number(r.activeMortality || 0),
        pastDoc: Number(r.pastDoc || 0),
        pastIntake: Number(r.pastIntake || 0),
        pastMortality: Number(r.pastMortality || 0),
        totalDoc: Number(r.totalDoc || 0),
        totalIntake: Number(r.totalIntake || 0),
        totalMortality: Number(r.totalMortality || 0),
        totalMainStock: Number(r.totalMainStock || 0),
    })) as OfficerAnalyticsData[];
}


