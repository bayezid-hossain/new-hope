import { cycleHistory, cycleLogs, cycles, farmer, saleEvents } from "@/db/schema";
import { SaleMetricsService } from "@/modules/reports/server/services/sale-metrics-service";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { deductFeedByType, type FeedNeed } from "./feed-stock-service";

export const endCycleLogic = async (
    tx: any,
    cycleId: string,
    feeds: FeedNeed[],
    userId: string,
    userName: string,
    endDate?: Date,
    endAge?: number
) => {
    const intake = feeds.reduce((s, f) => s + (f.quantity || 0), 0);

    const [activeCycle] = await tx.select().from(cycles).where(eq(cycles.id, cycleId));
    if (!activeCycle) throw new TRPCError({ code: "NOT_FOUND" });

    const farmerData = await tx.query.farmer.findFirst({
        where: and(eq(farmer.id, activeCycle.farmerId), eq(farmer.status, "active"))
    });
    if (!farmerData) throw new TRPCError({ code: "NOT_FOUND", message: "Farmer not found or archived." });

    const [history] = await tx.insert(cycleHistory).values({
        cycleName: activeCycle.name,
        farmerId: activeCycle.farmerId,
        organizationId: activeCycle.organizationId,
        doc: activeCycle.doc,
        birdsSold: activeCycle.birdsSold, // Note: caller must ensure this is up to date if modifying before call
        finalIntake: intake || 0,
        mortality: activeCycle.mortality,
        age: endAge ?? activeCycle.age,
        startDate: activeCycle.createdAt,
        endDate: endDate || new Date(),
        status: "archived",
        birdType: activeCycle.birdType,
        officialInputDate: activeCycle.officialInputDate,
    }).returning();

    await tx.update(cycleLogs)
        .set({ historyId: history.id, cycleId: null })
        .where(eq(cycleLogs.cycleId, activeCycle.id));

    // LINK SALES TO HISTORY (Prevent Orphan Sales)
    await tx.update(saleEvents)
        .set({ historyId: history.id, cycleId: null })
        .where(eq(saleEvents.cycleId, activeCycle.id));

    await tx.insert(cycleLogs).values({
        historyId: history.id,
        userId: userId,
        type: "SYSTEM",
        valueChange: 0,
        note: `Cycle Ended. Total Consumption: ${(intake || 0).toFixed(2)} bags.`
    });

    // Per-type deduction with Unspecified fallback — throws BAD_REQUEST if even that can't cover it
    const { netAmount } = await deductFeedByType(tx, activeCycle.farmerId, feeds, {
        logType: "CYCLE_CONSUMPTION",
        referenceId: history.id,
        note: `Cycle Consumption: Finished "${activeCycle.name}"`,
    });

    if (netAmount !== 0) {
        await tx.update(farmer).set({
            totalConsumed: sql`${farmer.totalConsumed} - ${netAmount}`,
        }).where(eq(farmer.id, activeCycle.farmerId));
    }

    await tx.delete(cycles).where(eq(cycles.id, cycleId));

    // NOTIFICATION: Cycle Ended
    try {
        const { NotificationService } = await import("@/modules/notifications/server/notification-service");
        await NotificationService.sendToOrgManagers({
            organizationId: activeCycle.organizationId,
            title: "Cycle Ended",
            message: `Officer ${userName} ended cycle "${activeCycle.name}" for farmer "${farmerData.name}"`,
            details: `Final Consumption: ${intake || 0} bags`,
            type: "WARNING",
            link: `/management/cycles/${history.id}`,
            metadata: { historyId: history.id, farmerId: activeCycle.farmerId, actorId: userId }
        });
    } catch (e) {
        console.error("Failed to send notification for cycle end", e);
    }

    // 5. Trigger Metric Calculation for the finalized cycle
    // We pass historyId because the cycle is now in history
    await SaleMetricsService.recalculateForCycle(undefined, history.id, tx);

    return { success: true, historyId: history.id };
};
