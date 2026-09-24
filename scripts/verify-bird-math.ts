import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../db";

type Row = {
    metrics_id: string;
    label: string;
    farmer_name: string | null;
    doc: number;
    mortality: number;
    rejected: string | number;
    stored_survival: string | number;
};

async function main() {
    const result: any = await db.execute(sql`
        WITH rejected AS (
            SELECT
                e.cycle_id,
                e.history_id,
                SUM(COALESCE(r.birds_rejected, e.birds_rejected)) AS rejected
            FROM sale_events e
            LEFT JOIN sale_reports r ON r.id = e.selected_report_id
            GROUP BY e.cycle_id, e.history_id
        )
        SELECT
            m.id AS metrics_id,
            COALESCE(c.name, h.cycle_name) AS label,
            f.name AS farmer_name,
            COALESCE(c.doc, h.doc) AS doc,
            COALESCE(c.mortality, h.mortality) AS mortality,
            COALESCE(rj.rejected, 0) AS rejected,
            m.survival_rate AS stored_survival
        FROM sale_metrics m
        LEFT JOIN cycles c ON c.id = m.cycle_id
        LEFT JOIN cycle_history h ON h.id = m.history_id
        LEFT JOIN farmer f ON f.id = COALESCE(c.farmer_id, h.farmer_id)
        LEFT JOIN rejected rj
               ON (m.cycle_id IS NOT NULL AND rj.cycle_id = m.cycle_id)
               OR (m.history_id IS NOT NULL AND rj.history_id = m.history_id)
    `);

    const rows: Row[] = Array.isArray(result) ? result : result.rows;
    const fetched = rows.length;

    let checked = 0;
    let failed = 0;
    let skipped = 0;
    let nullSurvival = 0;

    for (const row of rows) {
        const label = row.farmer_name ?? row.label ?? "?";

        const doc = Number(row.doc) || 0;
        if (doc <= 0) {
            skipped++;
            console.log(`SKIPPED (no doc): sale_metrics id=${row.metrics_id}`);
            continue;
        }

        // survival_rate is NOT NULL in the schema today, but guard defensively:
        // Number(null) || 0 would silently render a missing value as an honest
        // 0.00% survival cycle, which is indistinguishable from a real one.
        if (row.stored_survival === null || row.stored_survival === undefined) {
            nullSurvival++;
            console.log(`NULL stored_survival: sale_metrics id=${row.metrics_id} ${label}`);
            continue;
        }

        const mortality = Number(row.mortality) || 0;
        const rejected = Number(row.rejected) || 0;
        const expected = ((doc - mortality - rejected) / doc) * 100;
        const stored = Number(row.stored_survival) || 0;

        checked++;

        if (Math.abs(expected - stored) > 0.01) {
            failed++;
            console.log(
                `MISMATCH  ${row.farmer_name ?? "?"} / ${row.label ?? "?"}  ` +
                `doc=${doc} mortality=${mortality} rejected=${rejected}  ` +
                `stored=${stored.toFixed(2)}%  expected=${expected.toFixed(2)}%  ` +
                `delta=${(stored - expected).toFixed(2)}`
            );
        }
    }

    console.log(
        `\nsurvival rate: fetched=${fetched}, checked=${checked}, ${checked - failed}/${checked} correct, ` +
        `${failed} wrong, ${skipped} skipped (no doc), ${nullSurvival} null survival`
    );

    // Skipped/null rows are a separate, known data-hygiene issue (orphaned
    // sale_metrics rows with no cycle_id/history_id, or a currently-impossible
    // NULL survival_rate) — surfacing them here is a free side effect, but
    // this script's job is only the bird-math invariant, so only an actual
    // mismatch fails the run.
    process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
