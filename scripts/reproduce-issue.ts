
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { and, eq, inArray, or } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
    console.log("Starting verification script with REFINED FIX logic...");

    try {
        // 1. Setup
        console.log("Fetching existing officer...");
        const officeMember = await db.query.member.findFirst({
            where: eq(schema.member.role, 'OFFICER'),
        });

        if (!officeMember || !officeMember.userId || !officeMember.organizationId) {
            console.error("No officer member found for testing.");
            return;
        }

        const orgId = officeMember.organizationId;
        const officerId = officeMember.userId;
        const oldName = "TEST_FARMER_" + Date.now();
        const newName = "UPDATED_FARMER_" + Date.now();
        const oldLocation = "TEST_LOCATION_" + Date.now();

        // 2. Create Farmer
        console.log(`Creating farmer: ${oldName}`);
        const [farmer] = await db.insert(schema.farmer).values({
            name: oldName,
            organizationId: orgId,
            officerId: officerId,
            location: oldLocation,
            mainStock: 0,
            status: 'active',
        }).returning();

        // 3. Create Cycle
        console.log(`Creating cycle with name: ${oldName}`);
        const [cycle] = await db.insert(schema.cycles).values({
            name: oldName,
            farmerId: farmer.id,
            organizationId: orgId,
            doc: 100,
            status: 'active',
        }).returning();

        // 4. Create Sale Event
        console.log(`Creating sale event with location: ${oldName}`);
        const [saleEvent] = await db.insert(schema.saleEvents).values({
            cycleId: cycle.id,
            location: oldName,
            party: "Test Party",
            houseBirds: 100,
            birdsSold: 50,
            totalMortality: 0,
            totalWeight: "100.00",
            avgWeight: "2.00",
            pricePerKg: "200.00",
            totalAmount: "20000.00",
            feedConsumed: "[]",
            feedStock: "[]",
            createdBy: officerId,
        }).returning();

        console.log("Setup completed. Now performing REFINED CASCADING update...");

        // 5. Perform the Refined Cascading Update
        await db.transaction(async (tx) => {
            // Update Farmer
            await tx.update(schema.farmer)
                .set({ name: newName, updatedAt: new Date() })
                .where(eq(schema.farmer.id, farmer.id));

            // Cascade to Cycles
            await tx.update(schema.cycles)
                .set({ name: newName })
                .where(and(eq(schema.cycles.farmerId, farmer.id), eq(schema.cycles.name, oldName)));

            // Cascade to Sale Events
            const farmerCycles = await tx.select({ id: schema.cycles.id }).from(schema.cycles).where(eq(schema.cycles.farmerId, farmer.id));
            const farmerHistory = await tx.select({ id: schema.cycleHistory.id }).from(schema.cycleHistory).where(eq(schema.cycleHistory.farmerId, farmer.id));

            const cycleIds = farmerCycles.map(c => c.id);
            const historyIds = farmerHistory.map(h => h.id);

            if (cycleIds.length > 0 || historyIds.length > 0) {
                await tx.update(schema.saleEvents)
                    .set({ location: newName })
                    .where(and(
                        eq(schema.saleEvents.location, oldName),
                        or(
                            cycleIds.length > 0 ? inArray(schema.saleEvents.cycleId, cycleIds) : undefined,
                            historyIds.length > 0 ? inArray(schema.saleEvents.historyId, historyIds) : undefined
                        )
                    ));
            }
        });

        console.log("Cascading update performed. Checking for results...");

        // 6. Verify
        const updatedCycle = await db.query.cycles.findFirst({
            where: eq(schema.cycles.id, cycle.id)
        });

        const updatedSaleEvent = await db.query.saleEvents.findFirst({
            where: eq(schema.saleEvents.id, saleEvent.id)
        });

        console.log("\n--- RESULTS ---");
        console.log(`Farmer Name Updated To: ${newName}`);
        console.log(`Cycle Name: ${updatedCycle?.name} (Actual) vs ${newName} (Expected)`);
        console.log(`Sale Location: ${updatedSaleEvent?.location} (Actual) vs ${newName} (Expected)`);

        const success = updatedCycle?.name === newName && updatedSaleEvent?.location === newName;
        if (success) {
            console.log("\nSUCCESS: All fields updated correctly!");
        } else {
            console.log("\nFAILURE: Discrepancy still exists.");
        }

        // Cleanup
        console.log("\nCleaning up test data...");
        if (saleEvent) await db.delete(schema.saleEvents).where(eq(schema.saleEvents.id, saleEvent.id));
        if (cycle) await db.delete(schema.cycles).where(eq(schema.cycles.id, cycle.id));
        if (farmer) await db.delete(schema.farmer).where(eq(schema.farmer.id, farmer.id));
        console.log("Cleanup complete.");

    } catch (error: any) {
        console.error("\nERROR OCCURRED:");
        console.error("Message:", error.message);
        if (error.detail) console.error("Detail:", error.detail);
        console.error("Stack:", error.stack);
    }
}

main();
