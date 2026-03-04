import { Pool } from "@neondatabase/serverless";
import * as dotenv from 'dotenv';
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import { resolve } from 'path';
import * as schema from "../db/schema";

dotenv.config({ path: resolve(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

const DEMO_OFFICER_PREFIX = "demo_officer_";

async function main() {
    const action = process.argv[2];

    if (action !== 'add' && action !== 'remove') {
        console.error("Please specify 'add' or 'remove'");
        process.exit(1);
    }

    const orgs = await db.query.organization.findMany({ limit: 1 });
    if (orgs.length === 0) {
        console.error("No organizations found in database.");
        process.exit(1);
    }
    const orgId = orgs[0].id;
    console.log(`Using Organization: ${orgs[0].name} (${orgId})`);

    if (action === 'add') {
        console.log("Adding 20 demo officers...");
        const newUsers = [];
        const newMembers = [];

        for (let i = 1; i <= 20; i++) {
            const userId = `${DEMO_OFFICER_PREFIX}${Date.now()}_${i}`;
            const ts = new Date(`${Date.now() + i}`);

            newUsers.push({
                id: userId,
                name: `Demo Officer ${i}`,
                email: `demo.officer.${i}@example.com`,
                emailVerified: true,
                activeMode: "USER" as const,
                globalRole: "USER" as const,
                branchName: `Demo Branch ${Math.ceil(i / 5)}`,
                mobile: `017000000${i.toString().padStart(2, '0')}`
            });

            newMembers.push({
                id: crypto.randomUUID(),
                userId: userId,
                organizationId: orgId,
                role: "OFFICER" as const,
                status: "ACTIVE" as const,
                activeMode: "OFFICER" as const,
                accessLevel: "VIEW" as const
            });
        }

        try {
            await db.insert(schema.user).values(newUsers);
            await db.insert(schema.member).values(newMembers);
            console.log("Successfully added 20 demo officers.");
        } catch (e) {
            console.error("Error inserting demo officers:", e);
        }
    } else if (action === 'remove') {
        console.log("Removing demo officers...");
        try {
            // Find users to delete
            const usersToDelete = await db.query.user.findMany({
                where: (u, { ilike }) => ilike(u.id, `${DEMO_OFFICER_PREFIX}%`)
            });

            const userIds = usersToDelete.map(u => u.id);
            if (userIds.length > 0) {
                await db.delete(schema.user).where(inArray(schema.user.id, userIds));
                console.log(`Successfully removed ${userIds.length} demo officers.`);
            } else {
                console.log("No demo officers found to remove.");
            }
        } catch (e) {
            console.error("Error removing demo officers:", e);
        }
    }

    process.exit(0);
}

main();
