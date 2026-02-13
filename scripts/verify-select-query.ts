
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import fs from 'fs';
import * as schema from '../db/schema';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
    const result: any = {};

    try {
        // Test the exact pattern used in management router: db.select({ farmer: schema.farmer }).from(schema.farmer)
        const data = await db.select({
            farmer: schema.farmer
        })
            .from(schema.farmer)
            .limit(1);

        if (data.length > 0) {
            const f = data[0].farmer;
            result.farmerRecord = f;
            result.hasLocation = 'location' in f;
            result.hasMobile = 'mobile' in f;
        } else {
            result.message = "No farmers found.";
        }

    } catch (err: any) {
        result.error = err.message || String(err);
    }

    fs.writeFileSync('verification_select_result.json', JSON.stringify(result, null, 2));
    console.log("Done writing verification_select_result.json");
}

main();
