import "dotenv/config";
import { db } from "@/db";
import { standardValues } from "@/db/schema";
import { STANDARD_VALUES } from "@/modules/farmer-visits/lib/standard-values";
import { sql } from "drizzle-orm";

async function main() {
    console.log(`Seeding ${STANDARD_VALUES.length} standard value rows...`);

    for (const row of STANDARD_VALUES) {
        const values = {
            day: row.day,
            dailyFeedG: row.dailyFeedG,
            bodyWeightG: row.bodyWeightG,
            fcr: row.fcr === null ? null : row.fcr.toFixed(3),
        };
        await db.insert(standardValues).values(values).onConflictDoUpdate({
            target: standardValues.day,
            set: {
                dailyFeedG: sql`excluded.daily_feed_g`,
                bodyWeightG: sql`excluded.body_weight_g`,
                fcr: sql`excluded.fcr`,
            },
        });
    }

    console.log("Done.");
    process.exit(0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
