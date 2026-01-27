import { getCumulativeFeedForDay, GRAMS_PER_BAG } from "@/constants";
import { db } from "@/db";
import { cycleLogs, cycles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const updateCycleFeed = async (
    cycle: typeof cycles.$inferSelect,
    userId: string,
    forceUpdate = false,
    tx?: any, // Optional transaction client
    reason?: string // Optional reason for the update
) => {
    // console.log(`[updateCycleFeed] Starting for Cycle: ${cycle.id}, Doc: ${cycle.doc}`);

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

    // console.log(`[updateCycleFeed] currentAge: ${currentAge}, existingAge: ${cycle.age}`);

    // 2. CHECKPOINT: Don't update if age hasn't changed (unless forced)
    if (!forceUpdate && currentAge <= cycle.age) {
        // console.log(`[updateCycleFeed] No update needed (currentAge ${currentAge} <= existingAge ${cycle.age})`);
        return null;
    }

    // 3. Calculate Cumulative Feed
    const targetCumulativeGrams = getCumulativeFeedForDay(currentAge);

    // Safety: Ensure we don't calculate negative birds if mortality is high
    const liveBirds = Math.max(0, (cycle.doc || 0) - (cycle.mortality || 0));

    const totalNewGrams = targetCumulativeGrams * liveBirds;
    const totalNewBags = totalNewGrams / GRAMS_PER_BAG;

    const previousIntake = Number(cycle.intake) || 0;
    const consumedAmount = totalNewBags - previousIntake;

    // console.log(`[updateCycleFeed] liveBirds: ${liveBirds}, totalNewBags: ${totalNewBags.toFixed(2)}, consumedAmount: ${consumedAmount.toFixed(2)}`);

    // 4. Update Function (Reusable for both tx and non-tx cases)
    const performUpdate = async (client: any) => {
        try {
            // console.log(`[updateCycleFeed] Performing database update...`);
            // A. Update Cycle State
            await client.update(cycles)
                .set({
                    intake: totalNewBags,
                    age: currentAge,
                    updatedAt: new Date(),
                })
                .where(eq(cycles.id, cycle.id));

            // B. Add Intake Log (Only if there was consumption)
            if (consumedAmount > 0.001) {
                await client.insert(cycleLogs).values({
                    cycleId: cycle.id,
                    userId: userId,
                    type: "NOTE",
                    valueChange: consumedAmount,
                    note: `Daily Consumption: ${consumedAmount.toFixed(2)} bags (Age ${currentAge})`
                });
            }

            // C. Add System Log for forced recalculations
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
            // console.log(`[updateCycleFeed] Database update completed.`);
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