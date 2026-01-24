import { getCumulativeFeedForDay, GRAMS_PER_BAG } from "@/constants";
import { db } from "@/db";
import { cycleLogs, cycles } from "@/db/schema";
import { eq } from "drizzle-orm";

export const updateCycleFeed = async (
  cycle: typeof cycles.$inferSelect, 
  userId: string, // NEW: Required for the log entry
  forceUpdate = false 
) => {
    // 1. Calculate Age based on Cycle Creation Date
    const now = new Date();
    const start = new Date(cycle.createdAt);
    now.setHours(0, 0, 0, 0);
    start.setHours(0, 0, 0, 0);
    
    const diffTime = now.getTime() - start.getTime();
    const currentAge = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // 2. CHECKPOINT: Don't update if age hasn't changed (unless forced)
    if (!forceUpdate && currentAge <= cycle.age) {
        return null; 
    }

    // 3. Calculate Cumulative Feed
    const targetCumulativeGrams = getCumulativeFeedForDay(currentAge);
    
    // Safety: Ensure we don't calculate negative birds if mortality is high
    const liveBirds = Math.max(0, (cycle.doc) - cycle.mortality);
    
    const totalNewGrams = targetCumulativeGrams * liveBirds;
    const totalNewBags = totalNewGrams / GRAMS_PER_BAG;

    // --- LOGIC ADDITION START ---
    const previousIntake = Number(cycle.intake) || 0;
    const consumedAmount = totalNewBags - previousIntake;

    // 4. Update DB (Transaction ensures Log + Cycle State stay in sync)
    await db.transaction(async (tx) => {
        // A. Update Cycle State
        await tx.update(cycles)
            .set({
                intake: totalNewBags, // Drizzle handles the number type
                age: currentAge,
                updatedAt: new Date(),
            })
            .where(eq(cycles.id, cycle.id));

        // B. Add Intake Log (Only if there was consumption)
        // We use type "NOTE" to differentiate "Daily Consumption" from manual "Stock Added"
        if (consumedAmount > 0.001) {
            await tx.insert(cycleLogs).values({
                cycleId: cycle.id,
                userId: userId, // The officer/user triggering the sync
                type: "NOTE", 
                valueChange: consumedAmount,
                // previousValue/newValue are optional in schema but good for tracking
                // You might need to add them to schema or remove these lines if schema doesn't support them
                note: `Daily Consumption: ${consumedAmount.toFixed(2)} bags (Age ${currentAge})`
            });
        }
    });
    // --- LOGIC ADDITION END ---

    return {
        cycleName: cycle.name,
        addedBags: consumedAmount,
        newAge: currentAge
    };
};