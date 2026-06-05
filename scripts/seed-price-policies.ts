import "dotenv/config";
import { db } from "@/db";
import { pricePolicies } from "@/db/schema";
import { and, eq, lte } from "drizzle-orm";

const HISTORICAL_DATE = new Date("2000-01-01T00:00:00Z");
const CURRENT_POLICY_DATE = new Date("2026-06-01T00:00:00Z"); // uses whatever is already in DB

async function main() {
    console.log("Seeding missing historical price policy...");

    const orgs = await db.query.organization.findMany({ columns: { id: true, name: true } });
    console.log(`Found ${orgs.length} organization(s).`);

    let inserted = 0;
    let skipped = 0;

    for (const org of orgs) {
        // Check specifically if a historical policy (effectiveFrom <= 2000-01-02) exists
        const hasHistorical = await db.query.pricePolicies.findFirst({
            where: and(
                eq(pricePolicies.organizationId, org.id),
                lte(pricePolicies.effectiveFrom, new Date("2000-01-02T00:00:00Z"))
            ),
            columns: { id: true },
        });

        if (hasHistorical) {
            console.log(`  [${org.name}] Historical policy already exists — skipping.`);
            skipped++;
            continue;
        }

        await db.insert(pricePolicies).values({
            organizationId: org.id,
            effectiveFrom: HISTORICAL_DATE,
            feedPricePerBag: "3220",
            docPricePerBird: "41.5",
            baseSellPrice: "141",
        });

        console.log(`  [${org.name}] Inserted historical policy (3220/141 from 2000-01-01).`);
        inserted++;
    }

    console.log(`\nDone. Inserted: ${inserted} org(s), skipped: ${skipped} org(s).`);
    console.log("Now run: npx tsx scripts/fix-historical-sale-metrics.ts");
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
