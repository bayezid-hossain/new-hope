import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../db";

// NOTE on driver behaviour (do not "simplify" this back into one multi-statement
// db.execute(sql`BEGIN; ...; COMMIT;`) call without re-checking):
//
// db/index.ts builds `db` from drizzle-orm/neon-serverless on top of a
// @neondatabase/serverless `Pool`, which is the WebSocket/node-postgres-compatible
// driver (not the HTTP `neon()` client, which explicitly does not support sessions
// or interactive transactions at all).
//
// A single db.execute(sql`...`) call *happens* to be safe for a multi-statement,
// zero-interpolation string today, because drizzle-orm's NeonPreparedQuery always
// forwards `params` as the query's `values`, and node-postgres's
// Query.requiresPreparation() only switches to the prepared-statement (Parse/Bind/
// Execute) protocol when `values.length > 0` (or a statement `name`/`rows` is set).
// With no `${}` interpolations, params is `[]`, so it falls through to the simple
// query protocol, which *does* support multiple ';'-separated statements in one
// round trip. But that's an internal implementation detail of node-postgres, not a
// documented guarantee - and it silently stops being true the moment anyone adds a
// `${...}` interpolation to the SQL template.
//
// To not depend on that coincidence, this script instead uses drizzle's
// db.transaction(), which - per drizzle-orm/neon-serverless/session.js - checks a
// dedicated client out of the Pool and issues explicit BEGIN / COMMIT / ROLLBACK
// around each statement on that single session. Every ALTER/UPDATE below is its
// own db.execute() call, but all of them share one transaction: if any statement
// throws, drizzle rolls back the whole transaction and none of it lands.

async function main() {
    const before: any = await db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE birds_sold > 0) AS with_sales, COUNT(*) AS total FROM cycles
    `);
    const beforeRows = Array.isArray(before) ? before : before.rows;
    console.log("before:", JSON.stringify(beforeRows));

    await db.transaction(async (tx) => {
        await tx.execute(sql`ALTER TABLE "cycles" RENAME COLUMN "birds_sold" TO "birds_out"`);
        await tx.execute(sql`ALTER TABLE "cycle_history" RENAME COLUMN "birds_sold" TO "birds_out"`);

        await tx.execute(sql`ALTER TABLE "cycles" ADD COLUMN "birds_rejected" integer DEFAULT 0 NOT NULL`);
        await tx.execute(sql`ALTER TABLE "cycle_history" ADD COLUMN "birds_rejected" integer DEFAULT 0 NOT NULL`);
        await tx.execute(sql`ALTER TABLE "sale_metrics" ADD COLUMN "total_birds_rejected" integer DEFAULT 0 NOT NULL`);

        await tx.execute(sql`
            UPDATE "cycles" SET "birds_rejected" = COALESCE((
                SELECT SUM(COALESCE(r."birds_rejected", e."birds_rejected"))
                FROM "sale_events" e
                LEFT JOIN "sale_reports" r ON r."id" = e."selected_report_id"
                WHERE e."cycle_id" = "cycles"."id"
            ), 0)
        `);

        await tx.execute(sql`
            UPDATE "cycle_history" SET "birds_rejected" = COALESCE((
                SELECT SUM(COALESCE(r."birds_rejected", e."birds_rejected"))
                FROM "sale_events" e
                LEFT JOIN "sale_reports" r ON r."id" = e."selected_report_id"
                WHERE e."history_id" = "cycle_history"."id"
            ), 0)
        `);
    });

    const after: any = await db.execute(sql`
        SELECT COUNT(*) FILTER (WHERE birds_out > 0) AS with_sales,
               COUNT(*) FILTER (WHERE birds_rejected > 0) AS with_rejects,
               COUNT(*) AS total
        FROM cycles
    `);
    console.log("after:", JSON.stringify(Array.isArray(after) ? after : after.rows));
    process.exit(0);
}

main().catch((e) => {
    console.error("MIGRATION FAILED:", e.message);
    process.exit(1);
});
