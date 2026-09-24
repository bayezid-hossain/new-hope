import "dotenv/config";
import { db } from "@/db";
import { cycles, cycleHistory, saleEvents } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { SaleMetricsService } from "@/modules/reports/server/services/sale-metrics-service";

// One-off backfill: recalculates sale_metrics for every cycle and cycle-history
// row so stored survival rate / EPI / average weight pick up the corrected
// rejected-bird aggregation (previously read from the latest sale only).
//
// Deliberately SEQUENTIAL — one recalculation in flight at a time — to avoid
// hammering the Neon serverless pool with ~900 concurrent recalculations.
// Deliberately NEVER DELETES anything itself. SaleMetricsService.recalculateForCycle
// may delete a cycle's own orphaned metrics row when it has no sales (see below),
// but that's existing, scoped service behavior — this script issues no db.delete.

type Target = { kind: "cycle"; id: string } | { kind: "history"; id: string };

async function hasSales(target: Target): Promise<boolean> {
    const where =
        target.kind === "cycle"
            ? eq(saleEvents.cycleId, target.id)
            : eq(saleEvents.historyId, target.id);

    const [row] = await db.select({ count: count() }).from(saleEvents).where(where);
    return (row?.count ?? 0) > 0;
}

async function main() {
    console.log("Fetching cycles and cycle history...");

    const allCycles = await db.query.cycles.findMany({ columns: { id: true } });
    const allHistory = await db.query.cycleHistory.findMany({ columns: { id: true } });

    const targets: Target[] = [
        ...allCycles.map((c): Target => ({ kind: "cycle", id: c.id })),
        ...allHistory.map((h): Target => ({ kind: "history", id: h.id })),
    ];

    const total = targets.length;
    console.log(`Cycles: ${allCycles.length}, History: ${allHistory.length}, Total: ${total}`);

    let done = 0;
    let skipped = 0;
    let failed = 0;
    const failures: { kind: string; id: string; message: string }[] = [];

    for (let i = 0; i < targets.length; i++) {
        const target = targets[i];

        try {
            // A cycle/history with no sale_events legitimately has no metrics row:
            // SaleMetricsService.recalculateForCycle deletes any existing row for it
            // and returns early (sale-metrics-service.ts ~lines 36-44). That's a
            // successful no-op, not a failure, so we classify it as "skipped" by
            // checking sale_events directly rather than inferring it from an error.
            const willHaveSales = await hasSales(target);

            if (target.kind === "cycle") {
                await SaleMetricsService.recalculateForCycle(target.id, undefined);
            } else {
                await SaleMetricsService.recalculateForCycle(undefined, target.id);
            }

            if (willHaveSales) {
                done++;
            } else {
                skipped++;
            }
        } catch (err) {
            failed++;
            const message = err instanceof Error ? err.message : String(err);
            failures.push({ kind: target.kind, id: target.id, message });
            console.error(`  [failed] ${target.kind} ${target.id}: ${message}`);
        }

        const n = i + 1;
        if (n % 25 === 0 || n === total) {
            console.log(`  ${n}/${total}`);
        }
    }

    console.log("\nDone.");
    console.log(`  done:    ${done}`);
    console.log(`  skipped: ${skipped}`);
    console.log(`  failed:  ${failed}`);

    if (failures.length > 0) {
        console.log("\nFailures:");
        for (const f of failures) {
            console.log(`  ${f.kind} ${f.id}: ${f.message}`);
        }
    }

    process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
