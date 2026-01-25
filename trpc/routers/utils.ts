import { cycleHistory, cycles, farmer, member } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

export async function fetchOfficerAnalytics(db: any, orgId: string) {
    const officers = await db.query.member.findMany({
        where: and(
            eq(member.organizationId, orgId),
            eq(member.status, "ACTIVE")
        ),
        with: {
            user: true
        }
    });

    const analytics = await Promise.all(officers.map(async (m: any) => {
        const managedFarmers = await db.query.farmer.findMany({
            where: and(
                eq(farmer.officerId, m.userId),
                eq(farmer.organizationId, orgId)
            )
        });

        const farmerIds = managedFarmers.map((f: any) => f.id);

        if (farmerIds.length === 0) {
            return {
                officerId: m.userId,
                name: m.user.name,
                email: m.user.email,
                role: m.role,
                farmersCount: 0,
                activeCycles: 0,
                pastCycles: 0,
                totalDoc: 0,
                totalIntake: 0,
                totalMortality: 0
            };
        }

        const activeBatch = await db.select({
            totalDoc: sql<number>`sum(${cycles.doc})`,
            totalIntake: sql<number>`sum(${cycles.intake})`,
            totalMortality: sql<number>`sum(${cycles.mortality})`,
            count: sql<number>`count(*)`
        })
            .from(cycles)
            .where(
                and(
                    eq(cycles.organizationId, orgId),
                    sql`${cycles.farmerId} IN ${farmerIds}`,
                    eq(cycles.status, "active")
                )
            );

        const pastBatch = await db.select({
            totalDoc: sql<number>`sum(${cycleHistory.doc})`,
            totalIntake: sql<number>`sum(${cycleHistory.finalIntake})`,
            totalMortality: sql<number>`sum(${cycleHistory.mortality})`,
            count: sql<number>`count(*)`
        })
            .from(cycleHistory)
            .where(
                and(
                    eq(cycleHistory.organizationId, orgId),
                    sql`${cycleHistory.farmerId} IN ${farmerIds}`
                )
            );

        return {
            officerId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            farmersCount: managedFarmers.length,
            activeCycles: Number(activeBatch[0]?.count || 0),
            pastCycles: Number(pastBatch[0]?.count || 0),
            totalDoc: Number(activeBatch[0]?.totalDoc || 0) + Number(pastBatch[0]?.totalDoc || 0),
            totalIntake: Number(activeBatch[0]?.totalIntake || 0) + Number(pastBatch[0]?.totalIntake || 0),
            totalMortality: Number(activeBatch[0]?.totalMortality || 0) + Number(pastBatch[0]?.totalMortality || 0)
        };
    }));

    return analytics;
}
