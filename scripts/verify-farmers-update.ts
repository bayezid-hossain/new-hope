
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import fs from 'fs';
import * as schema from '../db/schema';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
    const result: any = { steps: [] };

    try {
        // 1. Find an active farmer
        const farmer = await db.query.farmer.findFirst({
            where: eq(schema.farmer.status, 'active')
        });

        if (!farmer) {
            result.error = "No active farmer found for testing update.";
        } else {
            result.farmerId = farmer.id;
            result.initialState = { location: farmer.location, mobile: farmer.mobile };

            const testLocation = "Test Location " + Date.now();
            const testMobile = "017" + Math.floor(Math.random() * 100000000);

            // 2. Update
            result.steps.push("Attempting update...");
            const [updated] = await db.update(schema.farmer)
                .set({
                    location: testLocation,
                    mobile: testMobile,
                    updatedAt: new Date()
                })
                .where(eq(schema.farmer.id, farmer.id))
                .returning();

            result.updateResult = updated;

            if (updated) {
                result.updateHasLocation = 'location' in updated;
                result.updateHasMobile = 'mobile' in updated;
                result.locationMatch = updated.location === testLocation;
                result.mobileMatch = updated.mobile === testMobile;
            } else {
                result.error = "Update returned nothing/undefined within array.";
            }

            // 3. Verify via query
            const refetched = await db.query.farmer.findFirst({
                where: eq(schema.farmer.id, farmer.id)
            });
            result.refetched = { location: refetched?.location, mobile: refetched?.mobile };

            // 4. Revert
            /*
            await db.update(schema.farmer)
                .set({
                    location: farmer.location,
                    mobile: farmer.mobile
                })
                .where(eq(schema.farmer.id, farmer.id));
            result.steps.push("Reverted changes.");
            */
        }

    } catch (err: any) {
        result.error = err.message || String(err);
        result.stack = err.stack;
    }

    fs.writeFileSync('verification_update_result.json', JSON.stringify(result, null, 2));
    console.log("Done writing verification_update_result.json");
}

main();
