import { cycleLogs, cycles, farmer, farmerVisitReports, standardValues } from "@/db/schema";
import { updateCycleFeed } from "@/modules/cycles/server/services/feed-service";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, gte, ilike, lte, sql } from "drizzle-orm";
import { calcAvgFcr, calcLiveBirds, clampStdDay, sumFeed, validateVisitDate } from "../lib/calc";
import type { ListInput, SaveInput } from "./schemas";

// db and tx are both passed as `any` elsewhere in the codebase (see cycle-service.ts).
type Db = any;

// Officers are limited to their own farmers, management sees the whole org.
export type Scope = { orgId: string; officerId?: string };

const scopeFilter = (scope: Scope) =>
    and(
        eq(farmer.organizationId, scope.orgId),
        scope.officerId ? eq(farmer.officerId, scope.officerId) : undefined,
    );

export async function getStandard(db: Db, age: number) {
    const day = clampStdDay(age);
    const [row] = await db.select().from(standardValues).where(eq(standardValues.day, day)).limit(1);
    if (!row) return null;
    return {
        day: row.day,
        dailyFeedG: row.dailyFeedG as number,
        bodyWeightG: row.bodyWeightG as number,
        fcr: row.fcr === null ? null : Number(row.fcr),
    };
}

async function loadActiveCycle(db: Db, scope: Scope, cycleId: string) {
    const [row] = await db
        .select({ cycle: cycles, farmerName: farmer.name, farmerLocation: farmer.location, farmerStatus: farmer.status })
        .from(cycles)
        .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
        .where(and(eq(cycles.id, cycleId), eq(cycles.organizationId, scope.orgId), scopeFilter(scope)))
        .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
    return row;
}

export async function getPrefill(db: Db, scope: Scope, input: { cycleId: string; date: string }) {
    const { cycle, farmerName, farmerLocation } = await loadActiveCycle(db, scope, input.cycleId);

    const [existing] = await db
        .select()
        .from(farmerVisitReports)
        .where(and(eq(farmerVisitReports.cycleId, cycle.id), eq(farmerVisitReports.visitDate, input.date)))
        .limit(1);

    return {
        cycle: {
            id: cycle.id,
            name: cycle.name,
            status: cycle.status,
            doc: cycle.doc,
            birdsOut: cycle.birdsOut,
            mortality: cycle.mortality,
            strain: cycle.birdType,
            startDate: (cycle.officialInputDate ?? cycle.createdAt) as Date,
            // Age is counted from createdAt (what updateCycleFeed and "Correct age" use), not officialInputDate.
            ageStartDate: cycle.createdAt as Date,
        },
        farmer: { id: cycle.farmerId, name: farmerName, location: farmerLocation },
        existing: existing ?? null,
    };
}

export async function saveReport(
    db: Db,
    scope: Scope,
    user: { id: string; name: string },
    input: SaveInput,
) {
    return await db.transaction(async (tx: Db) => {
        const { cycle, farmerStatus } = await loadActiveCycle(tx, scope, input.cycleId);

        if (cycle.status !== "active") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Reports can only be created for active cycles" });
        }
        if (farmerStatus !== "active") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot create a report for an archived farmer" });
        }

        const cycleStart = (cycle.officialInputDate ?? cycle.createdAt) as Date;
        const dateError = validateVisitDate(input.visitDate, cycleStart, new Date());
        if (dateError) throw new TRPCError({ code: "BAD_REQUEST", message: dateError });

        if (input.totalMortality + cycle.birdsOut > cycle.doc) {
            throw new TRPCError({
                code: "BAD_REQUEST",
                message: `Total mortality (${input.totalMortality}) plus birds out (${cycle.birdsOut}) cannot exceed initial birds (${cycle.doc}).`,
            });
        }

        const std = await getStandard(tx, input.age);
        const liveBirds = calcLiveBirds(cycle.doc, input.totalMortality, cycle.birdsOut);
        const avgFcr = calcAvgFcr({
            runningBags: sumFeed(input.feedLines, "running"),
            avgWeightG: input.avgWeightG,
            liveBirds,
        });

        const values = {
            organizationId: scope.orgId,
            farmerId: cycle.farmerId,
            cycleId: cycle.id,
            createdBy: user.id,
            visitDate: input.visitDate,
            cycleName: cycle.name,
            age: input.age,
            docCount: cycle.doc,
            strain: cycle.birdType,
            todayMortality: input.todayMortality,
            totalMortality: input.totalMortality,
            avgWeightG: input.avgWeightG,
            stdWeightG: std?.bodyWeightG ?? null,
            stdFcr: std?.fcr == null ? null : std.fcr.toFixed(3),
            avgFcr: avgFcr.toFixed(3),
            feedLines: input.feedLines,
            litter: input.litter,
            disease: input.disease,
            medicine: input.medicine,
            suggestions: input.suggestions,
            updatedAt: new Date(),
        };

        const [report] = await tx
            .insert(farmerVisitReports)
            .values(values)
            .onConflictDoUpdate({
                target: [farmerVisitReports.cycleId, farmerVisitReports.visitDate],
                set: { ...values, createdBy: sql`${farmerVisitReports.createdBy}` },
            })
            .returning();

        // Sync cycle mortality only when this is the newest report and no birds have left yet
        // (same restriction as correctMortality).
        const [{ latest }] = await tx
            .select({ latest: sql<string>`max(${farmerVisitReports.visitDate})` })
            .from(farmerVisitReports)
            .where(eq(farmerVisitReports.cycleId, cycle.id));

        let mortalitySynced = false;
        if (input.visitDate >= latest && cycle.birdsOut === 0 && input.totalMortality !== cycle.mortality) {
            const [updated] = await tx
                .update(cycles)
                .set({ mortality: input.totalMortality, updatedAt: new Date() })
                .where(eq(cycles.id, cycle.id))
                .returning();

            await updateCycleFeed(
                updated,
                user.id,
                true,
                tx,
                `Mortality set to ${input.totalMortality} from farmer visit report (${input.visitDate}).`,
            );

            await tx.insert(cycleLogs).values({
                cycleId: cycle.id,
                userId: user.id,
                type: "CORRECTION",
                valueChange: input.totalMortality - cycle.mortality,
                previousValue: cycle.mortality,
                newValue: input.totalMortality,
                note: `Farmer visit report ${input.visitDate} by ${user.name}`,
            });
            mortalitySynced = true;
        }

        return { report, mortalitySynced };
    });
}

export async function listReports(db: Db, scope: Scope, input: ListInput) {
    const dir = input.order === "asc" ? asc : desc;
    const orderBy =
        input.sort === "farmer"
            ? [dir(farmer.name), desc(farmerVisitReports.visitDate), asc(farmerVisitReports.id)]
            : [dir(farmerVisitReports.visitDate), asc(farmer.name), asc(farmerVisitReports.id)];

    const rows = await db
        .select({ report: farmerVisitReports, farmerName: farmer.name, farmerLocation: farmer.location })
        .from(farmerVisitReports)
        .innerJoin(farmer, eq(farmerVisitReports.farmerId, farmer.id))
        .where(
            and(
                eq(farmerVisitReports.organizationId, scope.orgId),
                scope.officerId ? eq(farmer.officerId, scope.officerId) : undefined,
                input.search ? ilike(farmer.name, `%${input.search}%`) : undefined,
                input.dateFrom ? gte(farmerVisitReports.visitDate, input.dateFrom) : undefined,
                input.dateTo ? lte(farmerVisitReports.visitDate, input.dateTo) : undefined,
            ),
        )
        .orderBy(...orderBy)
        .limit(input.pageSize + 1) // one extra row tells us whether another page exists
        .offset((input.cursor - 1) * input.pageSize);

    const hasMore = rows.length > input.pageSize;
    const items = rows.slice(0, input.pageSize).map((r: any) => ({
        ...r.report,
        farmerName: r.farmerName as string,
        farmerLocation: r.farmerLocation as string | null,
    }));
    return { items, nextCursor: hasMore ? input.cursor + 1 : null };
}

async function findScopedReport(db: Db, scope: Scope, id: string) {
    const [row] = await db
        .select({ report: farmerVisitReports, farmerName: farmer.name, farmerLocation: farmer.location })
        .from(farmerVisitReports)
        .innerJoin(farmer, eq(farmerVisitReports.farmerId, farmer.id))
        .where(and(eq(farmerVisitReports.id, id), eq(farmerVisitReports.organizationId, scope.orgId), scopeFilter(scope)))
        .limit(1);
    if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Report not found" });
    return { ...row.report, farmerName: row.farmerName as string, farmerLocation: row.farmerLocation as string | null };
}

export const getReport = findScopedReport;

// Deleting never rolls the cycle's mortality back; the CORRECTION log entry stays valid.
export async function deleteReport(db: Db, scope: Scope, id: string) {
    await findScopedReport(db, scope, id);
    await db.delete(farmerVisitReports).where(eq(farmerVisitReports.id, id));
    return { success: true };
}
