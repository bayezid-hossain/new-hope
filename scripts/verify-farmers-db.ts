
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
        // 1. Raw SQL check for columns
        const columns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'farmer';
    `;

        const columnNames = columns.map((c: any) => c.column_name);
        result.columns = columnNames;
        result.hasLocation = columnNames.includes('location');
        result.hasMobile = columnNames.includes('mobile');

        // 2. Try to fetch a farmer and see if fields are returned
        const farmer = await db.query.farmer.findFirst();
        if (farmer) {
            result.sampleFarmer = farmer;
            result.hasLocationProp = 'location' in farmer;
            result.hasMobileProp = 'mobile' in farmer;
        } else {
            result.message = "No farmers found to test.";
        }

    } catch (err: any) {
        result.error = err.message || String(err);
    }

    fs.writeFileSync('verification_result.json', JSON.stringify(result, null, 2));
    console.log("Done writing verification_result.json");
}

main();
