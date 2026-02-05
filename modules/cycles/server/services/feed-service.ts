import { getCumulativeFeedForDay, GRAMS_PER_BAG } from "@/constants";
import { db } from "@/db";
import { cycleLogs, cycles } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const updateCycleFeed = async (
    cycle: typeof cycles.$inferSelect,
    userId: string,
    forceUpdate = false,
    tx?: any, // Optional transaction client
    reason?: string // Optional reason for the update
) => {
    // //conosle.log(`[updateCycleFeed] Starting for Cycle: ${cycle.id}, Doc: ${cycle.doc}`);

    // 1. Calculate Age based on Cycle Creation Date
    const now = new Date();
    const start = cycle.createdAt ? new Date(cycle.createdAt) : new Date();

    if (isNaN(start.getTime())) {
        // console.error(`[updateCycleFeed] Invalid cycle creation date: ${cycle.createdAt}`);
        return null;
    }

    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);

    const diffTime = now.getTime() - start.getTime();
    const currentAge = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

    // //conosle.log(`[updateCycleFeed] currentAge: ${currentAge}, existingAge: ${cycle.age}`);

    // 2. CHECKPOINT: Don't update if age hasn't changed (unless forced)
    if (!forceUpdate && currentAge <= cycle.age) {
        // //conosle.log(`[updateCycleFeed] No update needed (currentAge ${currentAge} <= existingAge ${cycle.age})`);
        return null;
    }

    // 3. Calculate Feed Requirement
    // FIX: Deterministic "Golden Formula"
    // Total Intake = (Living Population * Cumulative[Today]) + Sum( Sold Birds * Cumulative[AtSale] )

    // A. Living Population (Surviving + not yet sold)
    const liveBirds = Math.max(0, (cycle.doc || 0) - (cycle.mortality || 0) - (cycle.birdsSold || 0));
    const targetCumulativeGrams = getCumulativeFeedForDay(currentAge);
    const livingPortionGrams = liveBirds * targetCumulativeGrams;

    // B. Sold Population (Locked Intake)
    // We fetch sale events to see EXACTLY when birds were sold to lock their intake
    const database = tx || db;
    const { saleEvents } = await import("@/db/schema");
    const activeSales = await database.select().from(saleEvents).where(eq(saleEvents.cycleId, cycle.id));

    let soldPortionGrams = 0;
    for (const sale of activeSales) {
        const saleDate = sale.saleDate ? new Date(sale.saleDate) : new Date();
        saleDate.setHours(0, 0, 0, 0);

        const diffTime = saleDate.getTime() - start.getTime();
        const ageAtSale = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

        const cumulativeAtSale = getCumulativeFeedForDay(ageAtSale);
        soldPortionGrams += (sale.birdsSold || 0) * cumulativeAtSale;
    }

    // C. Mortality Population (Locked Intake at death)
    // We fetch mortality logs to see EXACTLY when birds died to lock their intake
    const mortalityEvents = await database.select().from(cycleLogs).where(
        and(
            eq(cycleLogs.cycleId, cycle.id),
            eq(cycleLogs.type, "MORTALITY")
        )
    );

    let deadPortionGrams = 0;
    for (const log of mortalityEvents) {
        const deathDate = log.createdAt ? new Date(log.createdAt) : new Date();
        deathDate.setHours(0, 0, 0, 0);

        const diffTime = deathDate.getTime() - start.getTime();
        const ageAtDeath = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1);

        const cumulativeAtDeath = getCumulativeFeedForDay(ageAtDeath);
        deadPortionGrams += (log.valueChange || 0) * cumulativeAtDeath;
    }

    const totalNewGrams = livingPortionGrams + soldPortionGrams + deadPortionGrams;
    const totalNewBags = totalNewGrams / GRAMS_PER_BAG;

    const previousIntake = Number(cycle.intake) || 0;
    const consumedAmount = totalNewBags - previousIntake;

    // //conosle.log(`[updateCycleFeed] Formula Result: ${totalNewBags.toFixed(2)} bags (Delta: ${consumedAmount.toFixed(2)})`);

    // 4. Update Function (Reusable for both tx and non-tx cases)
    const performUpdate = async (client: any) => {
        try {
            // //conosle.log(`[updateCycleFeed] Performing database update...`);
            // A. Update Cycle State
            await client.update(cycles)
                .set({
                    intake: totalNewBags,
                    age: currentAge,
                    updatedAt: new Date(),
                })
                .where(eq(cycles.id, cycle.id));

            // B. Add Intake Log (Only if there was consumption)
            // We use a slightly higher threshold to avoid floating point noise logs
            if (consumedAmount > 0.005) {
                await client.insert(cycleLogs).values({
                    cycleId: cycle.id,
                    userId: userId,
                    type: "NOTE",
                    valueChange: consumedAmount,
                    note: forceUpdate
                        ? (reason || `Intake Recalculated: ${totalNewBags.toFixed(2)} bags total.`)
                        : `Daily Consumption: ${consumedAmount.toFixed(2)} bags (Age ${currentAge})`
                });
            }

            // C. Add System Log for forced recalculations/corrections
            if (forceUpdate) {
                await client.insert(cycleLogs).values({
                    cycleId: cycle.id,
                    userId: userId,
                    type: "SYSTEM",
                    valueChange: consumedAmount,
                    previousValue: previousIntake,
                    newValue: totalNewBags,
                    note: reason || "Forced feed intake recalculation due to cycle change."
                });
            }
            // //conosle.log(`[updateCycleFeed] Database update completed.`);
        } catch (err) {
            // console.error(`[updateCycleFeed] Database update failed:`, err);
            throw err;
        }
    };

    if (tx) {
        await performUpdate(tx);
    } else {
        await db.transaction(async (innerTx) => {
            await performUpdate(innerTx);
        });
    }

    return {
        cycleName: cycle.name,
        addedBags: consumedAmount,
        newAge: currentAge
    };
};
