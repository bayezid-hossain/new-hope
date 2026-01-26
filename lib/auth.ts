import { db } from "@/db"
import * as schema from "@/db/schema"
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
export const auth = betterAuth({
    socialProviders: {

        google: {
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        }
    },
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: {
            ...schema
        }
    }),
    emailAndPassword: {
        enabled: true
    },
    trustedOrigins: [process.env.BETTER_AUTH_URL || "http://localhost:3000", "https://feed-newhope.vercel.app"],
})