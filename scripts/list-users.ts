
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
    console.log("Listing all users...");
    try {
        const users = await db.query.user.findMany();
        console.log("Users found:");
        users.forEach(u => {
            console.log(`- ${u.email} (ID: ${u.id}, Name: ${u.name})`);
        });
    } catch (error: any) {
        console.error("Error:", error.message);
    }
}

main();
