import "dotenv/config";
import { db } from "@/db";
import { farmer, stockLogs } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

async function main() {
    console.log("Starting backfill of stock log balances...");

    // 1. Fetch all unique farmer IDs
    const allFarmers = await db.select({ id: farmer.id, name: farmer.name }).from(farmer);
    console.log(`Found ${allFarmers.length} farmers to process.`);

    let totalUpdated = 0;

    for (const f of allFarmers) {
        process.stdout.write(`Processing farmer: ${f.name} (${f.id})... `);
        
        // 2. Fetch all logs for this farmer ordered by createdAt
        const logs = await db.select()
            .from(stockLogs)
            .where(eq(stockLogs.farmerId, f.id))
            .orderBy(asc(stockLogs.createdAt), asc(stockLogs.id));

        if (logs.length === 0) {
            console.log("No logs found.");
            continue;
        }

        let runningBalance = 0;
        let farmerUpdated = 0;

        // 3. Calculate and update balanceAfter for each log
        for (const log of logs) {
            const amount = parseFloat(log.amount || "0");
            runningBalance += amount;
            
            await db.update(stockLogs)
                .set({ balanceAfter: runningBalance.toString() })
                .where(eq(stockLogs.id, log.id));
            
            farmerUpdated++;
        }

        console.log(`Updated ${farmerUpdated} logs.`);
        totalUpdated += farmerUpdated;
    }

    console.log("\nBackfill completed!");
    console.log(`Total logs updated: ${totalUpdated}`);
    process.exit(0);
}

main().catch((err) => {
    console.error("Fatal error during backfill:", err);
    process.exit(1);
});
