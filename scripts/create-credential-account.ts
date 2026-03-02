
import { neon } from '@neondatabase/serverless';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../db/schema';

dotenv.config();

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function main() {
    const refEmail = "me.bayezid@gmail.com";
    const targetEmail = "mashiurrahmantutul@gmail.com";

    console.log(`Starting credential creation for ${targetEmail} using ${refEmail} as reference...`);

    try {
        // 1. Get Reference User and Account
        const refUser = await db.query.user.findFirst({
            where: eq(schema.user.email, refEmail),
        });

        if (!refUser) {
            console.error(`Reference user ${refEmail} not found.`);
            return;
        }

        const refAccount = await db.query.account.findFirst({
            where: and(
                eq(schema.account.userId, refUser.id),
                eq(schema.account.providerId, "credential")
            ),
        });

        if (!refAccount || !refAccount.password) {
            console.error(`Reference user ${refEmail} does not have a credential password.`);
            return;
        }

        const passwordHash = refAccount.password;

        // 2. Get Target User
        const targetUser = await db.query.user.findFirst({
            where: eq(schema.user.email, targetEmail),
        });

        if (!targetUser) {
            console.error(`Target user ${targetEmail} not found.`);
            return;
        }

        // 3. Check for existing credential account for target user
        const existingTargetAccount = await db.query.account.findFirst({
            where: and(
                eq(schema.account.userId, targetUser.id),
                eq(schema.account.providerId, "credential")
            ),
        });

        if (existingTargetAccount) {
            console.log(`Target user ${targetEmail} already has a credential account. Updating password...`);
            await db.update(schema.account)
                .set({ password: passwordHash, updatedAt: new Date() })
                .where(eq(schema.account.id, existingTargetAccount.id));
            console.log("Password updated successfully.");
        } else {
            console.log(`Creating credential account for ${targetEmail}...`);
            await db.insert(schema.account).values({
                id: crypto.randomUUID(),
                accountId: targetUser.email,
                providerId: "credential",
                userId: targetUser.id,
                password: passwordHash,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
            console.log("Credential account created successfully.");
        }

    } catch (error: any) {
        console.error("An error occurred:", error.message);
        if (error.stack) console.error(error.stack);
    }
}

main();
