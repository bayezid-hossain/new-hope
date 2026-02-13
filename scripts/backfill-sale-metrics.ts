import { db } from "@/db";
import { SaleMetricsService } from "@/modules/reports/server/services/sale-metrics-service";

async function main() {
    console.log("Starting backfill of sale metrics...");

    // Fetch all archived cycles
    const allArchivedCycles = await db.query.cycleHistory.findMany();
    console.log(`Found ${allArchivedCycles.length} archived cycles to process.`);

    let processed = 0;
    let errors = 0;

    for (const cycle of allArchivedCycles) {
        try {
            await SaleMetricsService.recalculateForCycle(undefined, cycle.id);
            processed++;
            if (processed % 10 === 0) {
                console.log(`Processed ${processed}/${allArchivedCycles.length} cycles...`);
            }
        } catch (error) {
            console.error(`Error processing cycle history ${cycle.id}:`, error);
            errors++;
        }
    }

    console.log("Backfill completed!");
    console.log(`Successfully processed: ${processed}`);
    console.log(`Errors: ${errors}`);
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal error during backfill:", err);
    process.exit(1);
});
