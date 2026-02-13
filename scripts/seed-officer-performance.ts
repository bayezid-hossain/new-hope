import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "../db/";
import { cycleHistory, cycleLogs, farmer, member, organization, saleEvents, saleReports, user } from "../db/schema";

/**
 * Seed Script: Create Sample Broiler Performance Data
 * 
 * Creates a full year (12 months) of completed cycles and sales data
 * for the officer: arkantos.tas@gmail.com
 * 
 * This generates realistic broiler performance metrics for testing the
 * auto-generated monthly performance report feature.
 * 
 * Note: Cycles are created with START dates in each month (for Chicks IN),
 * with sale events dated at the end of each cycle (for all other metrics).
 */

async function main() {
    console.log("🌱 Starting seed for officer performance data...\n");

    // 1. Find the officer user
    const [officerUser] = await db.select().from(user).where(eq(user.email, "arkantos.tas@gmail.com"));

    if (!officerUser) {
        console.error("❌ Officer user not found with email: arkantos.tas@gmail.com");
        console.log("Please create this user first or update the email in the script.");
        process.exit(1);
    }

    console.log(`✅ Found officer: ${officerUser.name} (${officerUser.email})`);

    // 2. Find the organization this officer belongs to
    const [membership] = await db.select()
        .from(member)
        .where(and(
            eq(member.userId, officerUser.id),
            eq(member.status, "ACTIVE")
        ));

    if (!membership) {
        console.error("❌ Officer is not a member of any active organization");
        process.exit(1);
    }

    const [org] = await db.select().from(organization).where(eq(organization.id, membership.organizationId));
    console.log(`✅ Organization: ${org.name}\n`);

    // 3. Create or find a set of farmers for this officer
    const farmerNames = [
        "Karim Poultry Farm",
        "Rahman Broiler",
        "Alam Agro",
        "Hossain Farms",
        "Kabir Livestock",
        "Matin Poultry"
    ];

    const farmers = [];
    for (const name of farmerNames) {
        // Check if farmer exists
        let [existingFarmer] = await db.select()
            .from(farmer)
            .where(and(
                eq(farmer.name, name),
                eq(farmer.officerId, officerUser.id),
                eq(farmer.organizationId, org.id)
            ));

        if (!existingFarmer) {
            // Create new farmer
            [existingFarmer] = await db.insert(farmer).values({
                name,
                organizationId: org.id,
                officerId: officerUser.id,
                mainStock: 500, // 500 bags initial stock
                totalConsumed: 0,
                status: "active",
                location: `Location ${name}`,
                mobile: `01700${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`
            }).returning();
            console.log(`✅ Created farmer: ${name}`);
        } else {
            console.log(`✓ Farmer exists: ${name}`);
        }
        farmers.push(existingFarmer);
    }

    console.log("");

    // 4. Generate monthly performance data for 2024
    const monthlyData = [
        { month: 0, name: "January", doc: 37300, sold: 35000, age: 31, avgWeight: 1.62, feedTons: 100, survivalRate: 93.5, price: 130.6, mortality: 2300 },
        { month: 1, name: "February", doc: 38500, sold: 36800, age: 30, avgWeight: 1.58, feedTons: 105, survivalRate: 95.6, price: 128.5, mortality: 1700 },
        { month: 2, name: "March", doc: 39200, sold: 37400, age: 32, avgWeight: 1.65, feedTons: 110, survivalRate: 95.4, price: 132.0, mortality: 1800 },
        { month: 3, name: "April", doc: 36800, sold: 35100, age: 29, avgWeight: 1.55, feedTons: 98, survivalRate: 95.4, price: 127.8, mortality: 1700 },
        { month: 4, name: "May", doc: 40000, sold: 38200, age: 33, avgWeight: 1.68, feedTons: 115, survivalRate: 95.5, price: 133.2, mortality: 1800 },
        { month: 5, name: "June", doc: 38900, sold: 37100, age: 31, avgWeight: 1.61, feedTons: 107, survivalRate: 95.4, price: 129.5, mortality: 1800 },
        { month: 6, name: "July", doc: 37600, sold: 35900, age: 30, avgWeight: 1.60, feedTons: 103, survivalRate: 95.5, price: 131.0, mortality: 1700 },
        { month: 7, name: "August", doc: 39500, sold: 37800, age: 32, avgWeight: 1.64, feedTons: 112, survivalRate: 95.7, price: 130.8, mortality: 1700 },
        { month: 8, name: "September", doc: 38200, sold: 36400, age: 31, avgWeight: 1.59, feedTons: 104, survivalRate: 95.3, price: 128.9, mortality: 1800 },
        { month: 9, name: "October", doc: 39800, sold: 38100, age: 32, avgWeight: 1.66, feedTons: 114, survivalRate: 95.7, price: 132.5, mortality: 1700 },
        { month: 10, name: "November", doc: 37800, sold: 36100, age: 30, avgWeight: 1.58, feedTons: 101, survivalRate: 95.5, price: 129.2, mortality: 1700 },
        { month: 11, name: "December", doc: 38600, sold: 36900, age: 31, avgWeight: 1.63, feedTons: 109, survivalRate: 95.6, price: 131.5, mortality: 1700 },
    ];

    console.log("📊 Creating cycle histories and sales data for 2024...\n");

    // Helper to calculate FCR
    const calculateFCR = (feedTons: number, totalWeightKg: number) => {
        return (feedTons * 1000) / totalWeightKg;
    };

    // Helper to calculate EPI
    const calculateEPI = (survivalRate: number, avgWeight: number, fcr: number, age: number) => {
        return (survivalRate * avgWeight) / (fcr * age) * 100;
    };

    for (let i = 0; i < monthlyData.length; i++) {
        const data = monthlyData[i];
        const randomFarmer = farmers[i % farmers.length]; // Rotate through farmers

        // Create dates for the cycle
        // Start date is set to early in the month (for Chicks IN calculation)
        // Sale/End date is set to end of the month (for all other metrics)
        const startDate = new Date(2024, data.month, 5); // Start on 5th of month (DOC placement)
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + data.age); // End date after age days

        // Calculate totals
        const totalWeight = data.sold * data.avgWeight; // Total weight in kg
        const feedBags = (data.feedTons * 1000) / 50; // Convert tons to bags (50kg each)
        const fcr = calculateFCR(data.feedTons, totalWeight);
        const epi = calculateEPI(data.survivalRate, data.avgWeight, fcr, data.age);

        // Create cycle history
        const [history] = await db.insert(cycleHistory).values({
            cycleName: `${data.name}-2024-${randomFarmer.name}`,
            farmerId: randomFarmer.id,
            organizationId: org.id,
            doc: data.doc,
            birdsSold: data.sold,
            finalIntake: feedBags,
            mortality: data.mortality,
            age: data.age,
            status: "archived",
            startDate,
            endDate,
        }).returning();

        // Create sale event
        const totalAmount = totalWeight * data.price;
        const cashReceived = totalAmount * 0.6; // 60% cash
        const depositReceived = totalAmount * 0.4; // 40% deposit

        const [saleEvent] = await db.insert(saleEvents).values({
            cycleId: null,
            historyId: history.id,
            location: randomFarmer.location || `Farm Location ${i + 1}`,
            party: `Buyer ${String.fromCharCode(65 + (i % 5))}`, // Buyer A, B, C, D, E
            saleDate: endDate,
            houseBirds: data.doc,
            birdsSold: data.sold,
            totalMortality: data.mortality,
            totalWeight: totalWeight.toFixed(2),
            avgWeight: data.avgWeight.toFixed(2),
            pricePerKg: data.price.toFixed(2),
            totalAmount: totalAmount.toFixed(2),
            cashReceived: cashReceived.toFixed(2),
            depositReceived: depositReceived.toFixed(2),
            feedConsumed: JSON.stringify([
                { type: "B1", bags: Math.floor(feedBags * 0.3) },
                { type: "B2", bags: Math.floor(feedBags * 0.4) },
                { type: "B3", bags: Math.floor(feedBags * 0.3) },
            ]),
            feedStock: JSON.stringify([
                { type: "B1", bags: 10 },
                { type: "B2", bags: 15 },
            ]),
            medicineCost: (Math.random() * 5000 + 3000).toFixed(2),
            createdBy: officerUser.id,
            createdAt: endDate,
        }).returning();

        // Create initial sale report
        const [report] = await db.insert(saleReports).values({
            saleEventId: saleEvent.id,
            birdsSold: data.sold,
            totalMortality: data.mortality,
            totalWeight: totalWeight.toFixed(2),
            avgWeight: data.avgWeight.toFixed(2),
            pricePerKg: data.price.toFixed(2),
            totalAmount: totalAmount.toFixed(2),
            cashReceived: cashReceived.toFixed(2),
            depositReceived: depositReceived.toFixed(2),
            medicineCost: (Math.random() * 5000 + 3000).toFixed(2),
            feedConsumed: JSON.stringify([
                { type: "B1", bags: Math.floor(feedBags * 0.3) },
                { type: "B2", bags: Math.floor(feedBags * 0.4) },
                { type: "B3", bags: Math.floor(feedBags * 0.3) },
            ]),
            feedStock: JSON.stringify([
                { type: "B1", bags: 10 },
                { type: "B2", bags: 15 },
            ]),
            createdBy: officerUser.id,
            createdAt: endDate,
        }).returning();

        // Update sale event with selected report
        await db.update(saleEvents)
            .set({ selectedReportId: report.id })
            .where(eq(saleEvents.id, saleEvent.id));

        // Create feed log entry
        await db.insert(cycleLogs).values({
            cycleId: null,
            historyId: history.id,
            userId: officerUser.id,
            type: "FEED",
            valueChange: feedBags,
            newValue: feedBags,
            previousValue: 0,
            note: `Total feed consumed for ${data.name} cycle`,
            createdAt: endDate,
        });

        // Create sales log entry
        await db.insert(cycleLogs).values({
            cycleId: null,
            historyId: history.id,
            userId: officerUser.id,
            type: "SALES",
            valueChange: data.sold,
            newValue: data.sold,
            previousValue: 0,
            note: `Sold ${data.sold} birds at ৳${data.price}/kg`,
            createdAt: endDate,
        });

        console.log(`✅ ${data.name}: ${data.sold.toLocaleString()} birds sold | FCR: ${fcr.toFixed(2)} | EPI: ${Math.round(epi)} | Price: ৳${data.price}/kg`);
    }

    console.log("\n🎉 Seed completed successfully!");
    console.log(`\n📈 Created 12 months of performance data for ${officerUser.name}`);
    console.log(`   - Total cycles: 12`);
    console.log(`   - Total birds sold: ${monthlyData.reduce((sum, d) => sum + d.sold, 0).toLocaleString()}`);
    console.log(`   - Average survival rate: ${(monthlyData.reduce((sum, d) => sum + d.survivalRate, 0) / 12).toFixed(1)}%`);
    console.log(`   - Date range: Jan 2024 - Dec 2024\n`);
}

main()
    .catch((error) => {
        console.error("❌ Seed failed:", error);
        process.exit(1);
    })
    .finally(() => {
        process.exit(0);
    });
