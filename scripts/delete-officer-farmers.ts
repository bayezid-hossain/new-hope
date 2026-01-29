import "dotenv/config";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { farmer, stockLogs } from "../db/schema";

async function main() {
    const officerId = process.argv[2];

    if (!officerId) {
        console.error("❌ Please provide an officer ID as an argument.");
        console.log("Usage: npx tsx scripts/delete-officer-farmers.ts <officerId>");
        process.exit(1);
    }

    console.log(`🚀 Deleting all farmers for officer: ${officerId}...`);

    try {
        // 1. Get all farmer IDs for this officer
        const farmers = await db.select({ id: farmer.id, name: farmer.name })
            .from(farmer)
            .where(eq(farmer.officerId, officerId));

        if (farmers.length === 0) {
            console.log("⚠️ No farmers found for this officer.");
            process.exit(0);
        }

        const farmerIds = farmers.map(f => f.id);
        console.log(`Found ${farmers.length} farmers. Preparing to delete...`);

        // 2. Delete Stock Logs (No Cascade in DB)
        const deletedStockLogs = await db.delete(stockLogs)
            .where(inArray(stockLogs.farmerId, farmerIds))
            .returning({ id: stockLogs.id });

        console.log(`🗑 Deleted ${deletedStockLogs.length} related stock logs.`);

        // 3. Delete Farmers (Cycles & History will cascade)
        const result = await db.delete(farmer)
            .where(eq(farmer.officerId, officerId))
            .returning({ id: farmer.id, name: farmer.name });

        console.log(`✅ Deleted ${result.length} farmers.`);
        if (result.length > 0) {
            console.log("Deleted farmers:", result.map(f => f.name).join(", "));
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Deletion failed:", error);
        process.exit(1);
    }
}

main();
