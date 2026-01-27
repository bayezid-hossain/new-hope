import "dotenv/config";
import { db } from "../db";
import { cycleHistory, cycleLogs, cycles, farmer, stockLogs } from "../db/schema";

async function main() {
    console.log("🚀 Starting database reset (Domain Data)...");

    try {
        // Order matters if constraints are strict, but here we do it safely:

        console.log("🗑 Clearing Cycle Logs...");
        await db.delete(cycleLogs);

        console.log("🗑 Clearing Stock Logs...");
        await db.delete(stockLogs);

        console.log("🗑 Clearing Active Cycles...");
        await db.delete(cycles);

        console.log("🗑 Clearing Cycle History...");
        await db.delete(cycleHistory);

        console.log("🗑 Clearing Farmers...");
        await db.delete(farmer);

        console.log("✅ Successfully cleared all domain data.");
        console.log("✨ Account, Users, Sessions, Members, and Organizations remain intact.");

        process.exit(0);
    } catch (error) {
        console.error("❌ Reset failed:", error);
        process.exit(1);
    }
}

main();
