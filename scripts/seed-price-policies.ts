import "dotenv/config";
import { db } from "@/db";
import { organization, pricePolicies } from "@/db/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("Seeding price_policies table...");

    const orgs = await db.query.organization.findMany({ columns: { id: true, name: true } });
    console.log(`Found ${orgs.length} organization(s).`);

    let inserted = 0;
    let skipped = 0;

    for (const org of orgs) {
        const existing = await db.query.pricePolicies.findMany({
            where: eq(pricePolicies.organizationId, org.id),
            columns: { id: true, effectiveFrom: true },
        });

        if (existing.length > 0) {
            console.log(`  [${org.name}] Already has ${existing.length} polic(ies) — skipping.`);
            skipped++;
            continue;
        }

        // Historical policy: all cycles before 2026-06-05 used 3220/41.5/141
        await db.insert(pricePolicies).values({
            organizationId: org.id,
            effectiveFrom: new Date("2000-01-01T00:00:00Z"),
            feedPricePerBag: "3220",
            docPricePerBird: "41.5",
            baseSellPrice: "141",
        });

        // Current policy: from 2026-06-05 onwards use 3325/41.5/145
        await db.insert(pricePolicies).values({
            organizationId: org.id,
            effectiveFrom: new Date("2026-06-05T00:00:00Z"),
            feedPricePerBag: "3325",
            docPricePerBird: "41.5",
            baseSellPrice: "145",
        });

        console.log(`  [${org.name}] Inserted 2 policies (3220/141 from 2000-01-01, 3325/145 from 2026-06-05).`);
        inserted++;
    }

    console.log(`\nDone. Seeded: ${inserted} org(s), skipped: ${skipped} org(s).`);
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
