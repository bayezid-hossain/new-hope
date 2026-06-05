import "dotenv/config";
import { db } from "@/db";
import { saleMetrics } from "@/db/schema";
import { and, isNull } from "drizzle-orm";
import { SaleMetricsService } from "@/modules/reports/server/services/sale-metrics-service";

async function main() {
    console.log("Recalculating sale metrics for ALL cycles (active + ended)...");

    const [allHistory, allActive] = await Promise.all([
        db.query.cycleHistory.findMany({ columns: { id: true, cycleName: true } }),
        db.query.cycles.findMany({ columns: { id: true, name: true } }),
    ]);

    console.log(`Ended cycles: ${allHistory.length}, Active cycles: ${allActive.length}`);

    const [endedResults, activeResults] = await Promise.all([
        Promise.allSettled(
            allHistory.map(c => SaleMetricsService.recalculateForCycle(undefined, c.id))
        ),
        Promise.allSettled(
            allActive.map(c => SaleMetricsService.recalculateForCycle(c.id, undefined))
        ),
    ]);

    const endedErrors = endedResults.filter(r => r.status === "rejected");
    const activeErrors = activeResults.filter(r => r.status === "rejected");

    endedErrors.forEach((r) => {
        const c = allHistory[endedResults.indexOf(r)];
        console.error(`[ended] ${c?.id} (${c?.cycleName}):`, (r as PromiseRejectedResult).reason);
    });
    activeErrors.forEach((r) => {
        const c = allActive[activeResults.indexOf(r)];
        console.error(`[active] ${c?.id} (${c?.name}):`, (r as PromiseRejectedResult).reason);
    });

    // Delete orphaned sale_metrics rows (cycleId and historyId both NULL)
    // These are left over from cycles that were deleted rather than archived
    const deleted = await db.delete(saleMetrics)
        .where(and(isNull(saleMetrics.cycleId), isNull(saleMetrics.historyId)));

    console.log(`\nDone.`);
    console.log(`  Ended  — OK: ${endedResults.length - endedErrors.length}, Errors: ${endedErrors.length}`);
    console.log(`  Active — OK: ${activeResults.length - activeErrors.length}, Errors: ${activeErrors.length}`);
    console.log(`  Orphaned rows deleted: ${(deleted as any).rowCount ?? "unknown"}`);
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
