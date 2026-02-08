import "dotenv/config";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { cycleHistory, cycleLogs, cycles, farmer, farmerSecurityMoneyLogs, feedOrderItems, saleEvents, saleReports, stockLogs, user } from "../db/schema";

async function main() {
    const email = process.argv[2];

    if (!email) {
        console.error("❌ Please provide the officer email.");
        console.log("Usage: npx tsx scripts/delete-officer-farmers.ts <officer_email>");
        process.exit(1);
    }

    try {
        // 1. Find the officer by email
        const officer = await db.query.user.findFirst({
            where: eq(user.email, email)
        });

        if (!officer) {
            console.error(`❌ Officer not found with email: ${email}`);
            process.exit(1);
        }

        console.log(`🔍 Found Officer: ${officer.name} (${officer.email})`);

        // 2. Find all farmers managed by this officer
        const managedFarmers = await db.select({ id: farmer.id, name: farmer.name }).from(farmer).where(eq(farmer.officerId, officer.id));

        if (managedFarmers.length === 0) {
            console.log("ℹ️ No farmers found for this officer. Nothing to delete.");
            process.exit(0);
        }

        const farmerIds = managedFarmers.map(f => f.id);
        console.log(`📈 Found ${farmerIds.length} farmers to delete:`);
        managedFarmers.forEach(f => console.log(`   - ${f.name}`));

        // 3. Find all cycles and history records
        const activeCycles = await db.select({ id: cycles.id }).from(cycles).where(inArray(cycles.farmerId, farmerIds));
        const historyRecords = await db.select({ id: cycleHistory.id }).from(cycleHistory).where(inArray(cycleHistory.farmerId, farmerIds));

        const activeCycleIds = activeCycles.map(c => c.id);
        const historyIds = historyRecords.map(h => h.id);

        console.log(`🗑 Deleting data for ${activeCycleIds.length} active cycles and ${historyIds.length} history records...`);

        // 4. Perform Deletion (Order matters due to foreign keys)

        // Delete Sale Reports -> Sale Events
        if (activeCycleIds.length > 0 || historyIds.length > 0) {
            const allSaleEvents = await db.select({ id: saleEvents.id }).from(saleEvents).where(
                or(
                    activeCycleIds.length > 0 ? inArray(saleEvents.cycleId, activeCycleIds) : undefined,
                    historyIds.length > 0 ? inArray(saleEvents.historyId, historyIds) : undefined
                )
            );
            const saleEventIds = allSaleEvents.map(se => se.id);
            if (saleEventIds.length > 0) {
                console.log(`  - Deleting ${saleEventIds.length} sale reports and events...`);
                await db.delete(saleReports).where(inArray(saleReports.saleEventId, saleEventIds));
                await db.delete(saleEvents).where(inArray(saleEvents.id, saleEventIds));
            }
        }

        // Delete Cycle Logs
        if (activeCycleIds.length > 0 || historyIds.length > 0) {
            console.log("  - Deleting cycle logs...");
            await db.delete(cycleLogs).where(
                or(
                    activeCycleIds.length > 0 ? inArray(cycleLogs.cycleId, activeCycleIds) : undefined,
                    historyIds.length > 0 ? inArray(cycleLogs.historyId, historyIds) : undefined
                )
            );
        }

        // Delete Stock Logs for these farmers
        console.log("  - Deleting farmer stock logs...");
        await db.delete(stockLogs).where(inArray(stockLogs.farmerId, farmerIds));

        // Delete Security Money Logs for these farmers
        console.log("  - Deleting security money logs...");
        await db.delete(farmerSecurityMoneyLogs).where(inArray(farmerSecurityMoneyLogs.farmerId, farmerIds));

        // Delete Feed Order Items for these farmers
        console.log("  - Deleting feed order items...");
        await db.delete(feedOrderItems).where(inArray(feedOrderItems.farmerId, farmerIds));

        // Delete Active Cycles
        if (activeCycleIds.length > 0) {
            console.log("  - Deleting active cycles...");
            await db.delete(cycles).where(inArray(cycles.id, activeCycleIds));
        }

        // Delete Cycle History
        if (historyIds.length > 0) {
            console.log("  - Deleting cycle history...");
            await db.delete(cycleHistory).where(inArray(cycleHistory.id, historyIds));
        }

        // 5. DELETE THE FARMERS THEMSELVES
        console.log("  - Deleting farmer records...");
        await db.delete(farmer).where(inArray(farmer.id, farmerIds));

        console.log("✅ Successfully deleted all farmers and their related data for this officer.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Deletion failed:", error);
        process.exit(1);
    }
}

main();
