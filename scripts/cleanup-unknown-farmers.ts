import "dotenv/config";
import { inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { docOrderItems, farmer, saleOrderItems } from "../db/schema";

async function main() {
    const isDryRun = process.argv.includes("--dry-run");

    if (isDryRun) {
        console.log("🏃 Running in DRY RUN mode. No data will be deleted.");
    }

    try {
        console.log("🔍 Searching for items linked to 'UNKNOWN' or 'NONE' farmers...");

        // 1. Find IDs of farmers with special names (case-insensitive and trimmed)
        const suspiciousFarmers = await db.select({ id: farmer.id, name: farmer.name })
            .from(farmer)
            .where(or(
                sql`trim(upper(${farmer.name})) = 'UNKNOWN'`,
                sql`trim(upper(${farmer.name})) = 'NONE'`,
                sql`trim(upper(${farmer.name})) = ''`,
                isNull(farmer.name)
            ));

        const suspiciousFarmerIds = suspiciousFarmers.map(f => f.id);

        if (suspiciousFarmerIds.length > 0) {
            console.log(`📍 Found ${suspiciousFarmerIds.length} farmers with suspicious names:`);
            suspiciousFarmers.forEach(f => console.log(`   - "${f.name}" (${f.id})`));
        } else {
            console.log("ℹ️ No farmers with suspicious names found.");
        }

        // 2. Find orphaned IDs (items pointing to non-existent farmers)
        console.log("🔍 Checking for orphaned items (no parent farmer)...");

        const allFarmers = await db.select({ id: farmer.id }).from(farmer);
        const validFarmerIds = new Set(allFarmers.map(f => f.id));

        const allDocItems = await db.select({ id: docOrderItems.id, farmerId: docOrderItems.farmerId }).from(docOrderItems);
        const orphanedDocItems = allDocItems.filter(item => !validFarmerIds.has(item.farmerId));

        const allSaleItems = await db.select({ id: saleOrderItems.id, farmerId: saleOrderItems.farmerId }).from(saleOrderItems);
        const orphanedSaleItems = allSaleItems.filter(item => !validFarmerIds.has(item.farmerId));

        if (orphanedDocItems.length > 0) {
            console.log(`📍 Found ${orphanedDocItems.length} orphaned doc order items.`);
        }
        if (orphanedSaleItems.length > 0) {
            console.log(`📍 Found ${orphanedSaleItems.length} orphaned sale order items.`);
        }

        const itemsBySuspiciousFarmersDoc = await findItemsByFarmerIds(docOrderItems, suspiciousFarmerIds);
        const itemsBySuspiciousFarmersSale = await findItemsByFarmerIds(saleOrderItems, suspiciousFarmerIds);

        const totalToCleanDoc = new Set([...orphanedDocItems.map(i => i.id), ...itemsBySuspiciousFarmersDoc]);
        const totalToCleanSale = new Set([...orphanedSaleItems.map(i => i.id), ...itemsBySuspiciousFarmersSale]);

        console.log(`-----------------------------------------`);
        console.log(`📈 Summary of items to delete:`);
        console.log(`   - Doc Order Items: ${totalToCleanDoc.size}`);
        console.log(`   - Sale Order Items: ${totalToCleanSale.size}`);
        console.log(`-----------------------------------------`);

        if (!isDryRun) {
            if (totalToCleanDoc.size > 0) {
                console.log("🗑 Deleting doc order items...");
                await db.delete(docOrderItems).where(inArray(docOrderItems.id, Array.from(totalToCleanDoc)));
            }
            if (totalToCleanSale.size > 0) {
                console.log("🗑 Deleting sale order items...");
                await db.delete(saleOrderItems).where(inArray(saleOrderItems.id, Array.from(totalToCleanSale)));
            }
            console.log("✅ Cleanup complete.");
        } else {
            console.log("✨ Dry run complete. No data was modified.");
        }

        process.exit(0);
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
        process.exit(1);
    }
}

async function findItemsByFarmerIds(table: any, ids: string[]) {
    if (ids.length === 0) return [];
    const items = await db.select({ id: table.id }).from(table).where(inArray(table.farmerId, ids));
    return items.map(i => i.id);
}

main();
