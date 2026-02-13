
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import fs from 'fs';
import * as schema from '../db/schema';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
    const result: any = {};

    try {
        // Fetch last 10 logs of ANY type
        const logs = await db.select().from(schema.cycleLogs)
            .orderBy(desc(schema.cycleLogs.createdAt))
            .limit(20);

        result.recentLogs = logs.map(l => ({
            id: l.id,
            type: l.type,
            note: l.note,
            val: l.valueChange,
            created: l.createdAt
        }));

        // Check specifically for consumption notes
        result.consumptionLogs = logs.filter(l => l.note?.includes("Consumption"));

    } catch (err: any) {
        result.error = err.message || String(err);
    }

    fs.writeFileSync('check_logs_result.json', JSON.stringify(result, null, 2));
    console.log("Written to check_logs_result.json");
}

main();
