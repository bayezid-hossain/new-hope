import "dotenv/config";
import { db } from "@/db";
import { SaleMetricsService } from "@/modules/reports/server/services/sale-metrics-service";

async function main() {
    console.log("Starting historical sale metrics fix...");
    console.log("This uses policy-based price lookup — cycles before 2026-06-05 will use 3220/141, after will use 3325/145.");

    const allHistory = await db.query.cycleHistory.findMany({
        columns: { id: true, endDate: true, organizationId: true, cycleName: true }
    });

    console.log(`Found ${allHistory.length} archived cycles — running all in parallel...`);

    const results = await Promise.allSettled(
        allHistory.map(cycle => SaleMetricsService.recalculateForCycle(undefined, cycle.id))
    );

    const errors = results.filter(r => r.status === "rejected");
    errors.forEach((r) => {
        const cycle = allHistory[results.indexOf(r)];
        console.error(`Error processing cycle ${cycle?.id} (${cycle?.cycleName}):`, (r as PromiseRejectedResult).reason);
    });

    console.log(`\nFix complete! Processed: ${results.length - errors.length}, Errors: ${errors.length}`);
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
