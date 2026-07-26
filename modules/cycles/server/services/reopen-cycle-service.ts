import { cycleHistory, cycleLogs, cycles, farmer, saleEvents, saleMetrics } from "@/db/schema";
import { SaleMetricsService } from "@/modules/reports/server/services/sale-metrics-service";
import { eq, sql } from "drizzle-orm";
import { restoreFeedByReference } from "./feed-stock-service";

/**
 * Reopens an ended cycle from history by:
 * 1. Re-creating an active cycle from the history snapshot
 * 2. Migrating sale events and logs back from historyId → cycleId
 * 3. Restoring farmer feed stock (reversing the deduction made at cycle end)
 * 4. Deleting the history record and its metrics
 * 5. Recalculating feed for the reopened cycle
 */
export const reopenCycleFromHistory = async (
    tx: any,
    historyId: string,
    userId: string,
) => {
    // 1. Get the history record
    const [history] = await tx.select().from(cycleHistory).where(eq(cycleHistory.id, historyId));
    if (!history) throw new Error("History record not found");

    // 2. Re-create the active cycle
    const [newCycle] = await tx.insert(cycles).values({
        name: history.cycleName,
        farmerId: history.farmerId,
        organizationId: history.organizationId,
        doc: history.doc,
        birdsSold: history.birdsSold,
        intake: history.finalIntake,
        mortality: history.mortality,
        age: history.age,
        status: "active",
        birdType: history.birdType,
        createdAt: history.startDate,
        updatedAt: new Date(),
    }).returning();

    // 3. Migrate logs: historyId → cycleId
    await tx.update(cycleLogs)
        .set({ cycleId: newCycle.id, historyId: null })
        .where(eq(cycleLogs.historyId, historyId));

    // 4. Migrate sale events: historyId → cycleId
    await tx.update(saleEvents)
        .set({ cycleId: newCycle.id, historyId: null })
        .where(eq(saleEvents.historyId, historyId));

    // 5. Restore farmer stock — mirror the exact original per-type consumption rows (typed +
    // any Unspecified-fallback pieces), rather than one lump untyped amount.
    const { netAmount } = await restoreFeedByReference(
        tx,
        historyId,
        "CYCLE_CONSUMPTION",
        `Adjustment: Restored feed after reopening "${history.cycleName}"`
    );
    if (netAmount !== 0) {
        await tx.update(farmer).set({
            totalConsumed: sql`${farmer.totalConsumed} - ${netAmount}`,
        }).where(eq(farmer.id, history.farmerId));
    }

    // 6. Log the reopen event
    await tx.insert(cycleLogs).values({
        cycleId: newCycle.id,
        userId: userId,
        type: "SYSTEM",
        valueChange: 0,
        note: `Cycle Reopened from archived history (sale adjustment resulted in remaining birds).`
    });

    // 7. Delete metrics for the old history record
    await tx.delete(saleMetrics).where(eq(saleMetrics.historyId, historyId));

    // 8. Delete the history record (cascade will not affect anything since we migrated everything)
    await tx.delete(cycleHistory).where(eq(cycleHistory.id, historyId));

    // 9. Recalculate metrics for the reopened cycle
    await SaleMetricsService.recalculateForCycle(newCycle.id, undefined, tx);

    return { cycleId: newCycle.id };
};
