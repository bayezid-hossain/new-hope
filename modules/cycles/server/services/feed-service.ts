import { getCumulativeFeedForDay, GRAMS_PER_BAG } from "@/constants";
import { db } from "@/db";
import { cycleLogs, cycles } from "@/db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

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
    // NEW LOGIC: "Last Sale Checkpoint"
    // We prioritize the ACTUAL feed consumed from the latest Sale Report (if any exists).
    // Formula: Total = LastSale.feedConsumed + Estimated(LastSaleDate -> Now)

    const database = tx || db;
    const { saleEvents } = await import("@/db/schema");

    // Fetch LATEST sale event for this cycle
    const [lastSale] = await database.select()
        .from(saleEvents)
        .where(eq(saleEvents.cycleId, cycle.id))
        .orderBy(desc(saleEvents.saleDate))
        .limit(1);

    let baseIntakeBags = 0;
    let calculationStartDate = start; // Default to cycle start

    if (lastSale && lastSale.feedConsumed) {
        try {
            const feedData = JSON.parse(lastSale.feedConsumed) as { bags: number }[];
            baseIntakeBags = feedData.reduce((sum, item) => sum + (item.bags || 0), 0);
            calculationStartDate = lastSale.saleDate;

            // //conosle.log(`[updateCycleFeed] Found Last Sale Checkpoint: ${lastSale.saleDate}, Base Intake: ${baseIntakeBags}`);
        } catch (e) {
            console.error("Failed to parse feedConsumed from last sale", e);
        }
    }

    // A. Living Population (Surviving + not yet sold)
    // We only calculate consumption for the period AFTER the last sale (or start date)
    const liveBirds = Math.max(0, (cycle.doc || 0) - (cycle.mortality || 0) - (cycle.birdsSold || 0));

    // Calculate days to estimate
    const calcStart = new Date(calculationStartDate);
    calcStart.setHours(0, 0, 0, 0);
    const diffTimeSinceCheckpoint = now.getTime() - calcStart.getTime();
    const daysSinceCheckpoint = Math.max(0, Math.floor(diffTimeSinceCheckpoint / (1000 * 60 * 60 * 24)));

    // Cumulative Feed Logic (Marginal)
    // We need: Cumulative(CurrentAge) - Cumulative(CheckpointAge)
    const ageAtCheckpoint = Math.max(0, currentAge - daysSinceCheckpoint);
    const cumulativeNow = getCumulativeFeedForDay(currentAge);
    const cumulativeCheckpoint = getCumulativeFeedForDay(ageAtCheckpoint);

    const marginalFeedPerBirdGrams = Math.max(0, cumulativeNow - cumulativeCheckpoint);
    const estimatedLivingGrams = liveBirds * marginalFeedPerBirdGrams;

    // B. Sold Population (Locked Intake) - ONLY for sales happening AFTER the checkpoint
    // If we use a checkpoint, we ignore sales before it (they are baked into the base intake)
    const activeSales = await database.select().from(saleEvents).where(
        and(
            eq(saleEvents.cycleId, cycle.id),
            sql`${saleEvents.saleDate} > ${calculationStartDate.toISOString()}`
        )
    );

    let soldPortionGrams = 0;
    for (const sale of activeSales) {
        const saleDate = sale.saleDate ? new Date(sale.saleDate) : new Date();
        saleDate.setHours(0, 0, 0, 0);

        const diffTime = saleDate.getTime() - calcStart.getTime(); // relative to checkpoint
        const daysToSale = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        const ageAtSale = ageAtCheckpoint + daysToSale;

        const cumulativeAtSale = getCumulativeFeedForDay(ageAtSale);
        const marginalAtSale = Math.max(0, cumulativeAtSale - cumulativeCheckpoint);

        soldPortionGrams += (sale.birdsSold || 0) * marginalAtSale;
    }

    // C. Mortality Population (Locked Intake at death) - ONLY after checkpoint
    const mortalityEvents = await database.select().from(cycleLogs).where(
        and(
            eq(cycleLogs.cycleId, cycle.id),
            eq(cycleLogs.type, "MORTALITY"),
            sql`${cycleLogs.createdAt} > ${calculationStartDate.toISOString()}`
        )
    );

    let deadPortionGrams = 0;
    for (const log of mortalityEvents) {
        const deathDate = log.createdAt ? new Date(log.createdAt) : new Date();
        deathDate.setHours(0, 0, 0, 0);

        const diffTime = deathDate.getTime() - calcStart.getTime();
        const daysToDeath = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
        const ageAtDeath = ageAtCheckpoint + daysToDeath;

        const cumulativeAtDeath = getCumulativeFeedForDay(ageAtDeath);
        const marginalAtDeath = Math.max(0, cumulativeAtDeath - cumulativeCheckpoint);

        deadPortionGrams += (log.valueChange || 0) * marginalAtDeath;
    }

    const totalEstimatedGrams = estimatedLivingGrams + soldPortionGrams + deadPortionGrams;
    const totalEstimatedBags = totalEstimatedGrams / GRAMS_PER_BAG;

    // FINAL FORMULA: Base (Actual) + Estimated (Since Checkpoint)
    const totalNewBags = baseIntakeBags + totalEstimatedBags;

    const previousIntake = Number(cycle.intake) || 0;
    const consumedAmount = totalNewBags - previousIntake;

    // //conosle.log(`[updateCycleFeed] Checkpoint: ${baseIntakeBags.toFixed(2)} + Est: ${totalEstimatedBags.toFixed(2)} = ${totalNewBags.toFixed(2)}`);

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
