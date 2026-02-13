import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { cycleHistory, farmer, stockLogs } from "../db/schema";

async function main() {
    const isDryRun = process.argv.includes("--dry-run");

    if (isDryRun) {
        console.log("🏃 Running in DRY RUN mode. No data will be deleted.");
    }

    try {
        // 1. Find deleted farmers
        const deletedFarmers = await db.select({ id: farmer.id, name: farmer.name })
            .from(farmer)
            .where(eq(farmer.status, "deleted"));

        const farmerIds = deletedFarmers.map(f => f.id);

        if (farmerIds.length > 0) {
            console.log(`🔍 Found ${farmerIds.length} deleted farmers:`);
            deletedFarmers.forEach(f => console.log(`   - ${f.name} (ID: ${f.id})`));

            if (!isDryRun) {
                console.log("🗑 Deleting dependent stock logs...");
                await db.delete(stockLogs).where(inArray(stockLogs.farmerId, farmerIds));

                console.log("🗑 Deleting farmers (cascading to cycles, logs, sales, etc.)...");
                await db.delete(farmer).where(inArray(farmer.id, farmerIds));
            }
        } else {
            console.log("ℹ️ No deleted farmers found.");
        }

        // 2. Find deleted cycle history records
        const deletedHistory = await db.select({ id: cycleHistory.id, name: cycleHistory.cycleName })
            .from(cycleHistory)
            .where(eq(cycleHistory.status, "deleted"));

        const historyIds = deletedHistory.map(h => h.id);

        if (historyIds.length > 0) {
            console.log(`🔍 Found ${historyIds.length} deleted cycle history records:`);
            deletedHistory.forEach(h => console.log(`   - ${h.name} (ID: ${h.id})`));

            if (!isDryRun) {
                console.log("🗑 Deleting deleted cycle history records...");
                await db.delete(cycleHistory).where(inArray(cycleHistory.id, historyIds));
            }
        } else {
            console.log("ℹ️ No deleted cycle history records found.");
        }

        if (isDryRun) {
            console.log("✨ Dry run complete. No data was modified.");
        } else {
            console.log("✅ Cleanup complete.");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
        process.exit(1);
    }
}

main();
