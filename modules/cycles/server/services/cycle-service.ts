import { cycleHistory, cycleLogs, cycles, farmer, saleEvents, stockLogs } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";

export const endCycleLogic = async (
    tx: any,
    cycleId: string,
    intake: number,
    userId: string,
    userName: string
) => {
    const [activeCycle] = await tx.select().from(cycles).where(eq(cycles.id, cycleId));
    if (!activeCycle) throw new TRPCError({ code: "NOT_FOUND" });

    // LOGIC CHECK: Ensure intake does not exceed farmer's stock
    const farmerData = await tx.query.farmer.findFirst({
        where: and(eq(farmer.id, activeCycle.farmerId), eq(farmer.status, "active"))
    });
    if (!farmerData) throw new TRPCError({ code: "NOT_FOUND", message: "Farmer not found or archived." });

    if ((intake || 0) > farmerData.mainStock) {
        throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Cannot consume ${intake} bags. Only ${farmerData.mainStock} bags available in stock.`
        });
    }

    const [history] = await tx.insert(cycleHistory).values({
        cycleName: activeCycle.name,
        farmerId: activeCycle.farmerId,
        organizationId: activeCycle.organizationId,
        doc: activeCycle.doc,
        birdsSold: activeCycle.birdsSold, // Note: caller must ensure this is up to date if modifying before call
        finalIntake: intake || 0,
        mortality: activeCycle.mortality,
        age: activeCycle.age,
        startDate: activeCycle.createdAt,
        endDate: new Date(),
        status: "archived"
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

    await tx.update(farmer).set({
        updatedAt: new Date(),
        mainStock: sql`${farmer.mainStock} - ${intake || 0}`,
        totalConsumed: sql`${farmer.totalConsumed} + ${intake || 0}`
    }).where(eq(farmer.id, activeCycle.farmerId));

    if (intake > 0) {
        await tx.insert(stockLogs).values({
            farmerId: activeCycle.farmerId,
            amount: (-intake).toString(),
            type: "CYCLE_CLOSE",
            referenceId: history.id,
            note: `Cycle "${activeCycle.name}" Ended. Consumed: ${intake} bags.`
        });
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

    return { success: true, historyId: history.id };
};
