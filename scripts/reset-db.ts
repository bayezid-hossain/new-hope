import "dotenv/config";
import { db } from "../db";
import { cycleHistory, cycleLogs, cycles, farmer, stockLogs } from "../db/schema";

async function main() {
    //conosle.log("🚀 Starting database reset (Domain Data)...");

    try {
        // Order matters if constraints are strict, but here we do it safely:

        //conosle.log("🗑 Clearing Cycle Logs...");
        await db.delete(cycleLogs);

        //conosle.log("🗑 Clearing Stock Logs...");
        await db.delete(stockLogs);

        //conosle.log("🗑 Clearing Active Cycles...");
        await db.delete(cycles);

        //conosle.log("🗑 Clearing Cycle History...");
        await db.delete(cycleHistory);

        //conosle.log("🗑 Clearing Farmers...");
        await db.delete(farmer);

        //conosle.log("✅ Successfully cleared all domain data.");
        //conosle.log("✨ Account, Users, Sessions, Members, and Organizations remain intact.");

        process.exit(0);
    } catch (error) {
        console.error("❌ Reset failed:", error);
        process.exit(1);
    }
}

main();
