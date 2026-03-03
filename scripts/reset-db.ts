import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../db";
import {
    birdTypes,
    cycleHistory,
    cycleLogs,
    cycles,
    docOrderItems,
    docOrders,
    farmer,
    farmerSecurityMoneyLogs,
    featureRequest,
    feedOrderItems,
    feedOrders,
    notification,
    saleEvents,
    saleMetrics,
    saleOrderItems,
    saleOrders,
    saleReports,
    stockLogs,
} from "../db/schema";

async function main() {
    console.log("🚀 Starting database reset (Domain & Transactional Data)...");

    try {
        // Ensure search_path is set (may be empty after a bad restore)
        await db.execute(sql`SET search_path TO public`);

        // Order matters to respect foreign key constraints:

        console.log("🗑 Clearing Sales Data...");
        await db.delete(saleReports);
        await db.delete(saleEvents);
        await db.delete(saleMetrics);

        console.log("🗑 Clearing Cycle Logs & History...");
        await db.delete(cycleLogs);
        await db.delete(cycles);
        await db.delete(cycleHistory);

        console.log("🗑 Clearing Stock & Security Logs...");
        await db.delete(stockLogs);
        await db.delete(farmerSecurityMoneyLogs);

        console.log("🗑 Clearing Orders (Feed, DOC, Sales)...");
        await db.delete(feedOrderItems);
        await db.delete(feedOrders);
        await db.delete(docOrderItems);
        await db.delete(docOrders);
        await db.delete(saleOrderItems);
        await db.delete(saleOrders);

        console.log("🗑 Clearing Notifications & Requests...");
        await db.delete(notification);
        await db.delete(featureRequest);

        console.log("🗑 Clearing Farmers & Bird Types...");
        await db.delete(farmer);
        await db.delete(birdTypes);

        console.log("✅ Successfully cleared all domain and transactional data.");
        console.log("✨ Account, Users, Sessions, Members, and Organizations remain intact.");

        process.exit(0);
    } catch (error) {
        console.error("❌ Reset failed:", error);
        process.exit(1);
    }
}

main();
