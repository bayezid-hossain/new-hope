import "dotenv/config";
import { eq, inArray, or } from "drizzle-orm";
import { db } from "../db";
import { cycleHistory, cycleLogs, cycles, farmer, saleEvents, saleReports, stockLogs, user } from "../db/schema";

async function main() {
    const identifier = process.argv[2];

    if (!identifier) {
        console.error("❌ Please provide an officer email or ID.");
        console.log("Usage: npx tsx scripts/delete-officer-cycles.ts <email_or_id>");
        process.exit(1);
    }

    try {
        // 1. Find the officer
        const officer = await db.query.user.findFirst({
            where: or(eq(user.id, identifier), eq(user.email, identifier))
        });

        if (!officer) {
            console.error(`❌ Officer not found: ${identifier}`);
            process.exit(1);
        }

        console.log(`🔍 Found Officer: ${officer.name} (${officer.email})`);

        // 2. Find all farmers managed by this officer
        const managedFarmers = await db.select({ id: farmer.id }).from(farmer).where(eq(farmer.officerId, officer.id));

        if (managedFarmers.length === 0) {
            console.log("ℹ️ No farmers found for this officer. Nothing to delete.");
            process.exit(0);
        }

        const farmerIds = managedFarmers.map(f => f.id);
        console.log(`📈 Found ${farmerIds.length} managed farmers.`);

        // 3. Find all cycles and history records to delete
        const activeCycles = await db.select({ id: cycles.id }).from(cycles).where(inArray(cycles.farmerId, farmerIds));
        const historyRecords = await db.select({ id: cycleHistory.id }).from(cycleHistory).where(inArray(cycleHistory.farmerId, farmerIds));

        const activeCycleIds = activeCycles.map(c => c.id);
        const historyIds = historyRecords.map(h => h.id);

        console.log(`🗑 Deleting data for ${activeCycleIds.length} active cycles and ${historyIds.length} history records...`);

        // 4. Perform Deletion (Order matters for some, but most have cascades)
        // We handle set null cases explicitly to ensure completeness

        // Delete Sale Reports
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

        // Delete Stock Logs for these farmers (to reset their balance history)
        console.log("  - Deleting farmer stock logs...");
        await db.delete(stockLogs).where(inArray(stockLogs.farmerId, farmerIds));

        // Delete the core records
        if (activeCycleIds.length > 0) {
            console.log("  - Deleting active cycles...");
            await db.delete(cycles).where(inArray(cycles.id, activeCycleIds));
        }

        if (historyIds.length > 0) {
            console.log("  - Deleting cycle history...");
            await db.delete(cycleHistory).where(inArray(cycleHistory.id, historyIds));
        }

        // Optional: Reset farmer stock/consumed fields?
        console.log("  - Resetting farmer statistics...");
        await db.update(farmer)
            .set({ mainStock: 0, totalConsumed: 0, updatedAt: new Date() })
            .where(inArray(farmer.id, farmerIds));

        console.log("✅ Successfully cleared all cycle data for the officer's farmers.");
        process.exit(0);

    } catch (error) {
        console.error("❌ Deletion failed:", error);
        process.exit(1);
    }
}

main();
