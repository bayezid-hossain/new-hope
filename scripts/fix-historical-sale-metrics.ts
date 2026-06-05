import "dotenv/config";
import { db } from "@/db";
import { SaleMetricsService } from "@/modules/reports/server/services/sale-metrics-service";

async function main() {
    console.log("Starting historical sale metrics fix...");
    console.log("This uses policy-based price lookup — cycles before 2026-06-05 will use 3220/141, after will use 3325/145.");

    const allHistory = await db.query.cycleHistory.findMany({
        columns: { id: true, endDate: true, organizationId: true, cycleName: true }
    });

    console.log(`Found ${allHistory.length} archived cycles to process.`);

    let processed = 0;
    let errors = 0;

    for (const cycle of allHistory) {
        try {
            await SaleMetricsService.recalculateForCycle(undefined, cycle.id);
            processed++;
            if (processed % 10 === 0) {
                console.log(`Processed ${processed}/${allHistory.length} cycles...`);
            }
        } catch (error) {
            console.error(`Error processing cycle ${cycle.id} (${cycle.cycleName}):`, error);
            errors++;
        }
    }

    console.log("Fix complete!");
    console.log(`Successfully processed: ${processed}`);
    console.log(`Errors: ${errors}`);
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
