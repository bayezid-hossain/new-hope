import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { cycleHistory, farmer } from "../db/schema";

async function main() {
    console.log("🚀 Starting cleanup of deleted farmers' history...");

    try {
        // 1. Get all farmer IDs with 'deleted' status
        const deletedFarmers = await db.select({ id: farmer.id, name: farmer.name })
            .from(farmer)
            .where(eq(farmer.status, "deleted"));

        if (deletedFarmers.length === 0) {
            console.log("✅ No deleted farmers found.");
            process.exit(0);
        }

        const farmerIds = deletedFarmers.map(f => f.id);
        console.log(`🔍 Found ${deletedFarmers.length} deleted farmers. IDs: ${farmerIds.join(", ")}`);

        // 2. Update cycleHistory status to 'deleted' for these farmers
        const result = await db.update(cycleHistory)
            .set({ status: "deleted" })
            .where(inArray(cycleHistory.farmerId, farmerIds))
            .returning({ id: cycleHistory.id });

        console.log(`✅ Successfully marked ${result.length} past cycles as 'deleted'.`);
        process.exit(0);
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
        process.exit(1);
    }
}

main();
