import { pricePolicies, organization } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, managementProcedure } from "../../init";

export const managementPricePoliciesRouter = createTRPCRouter({

    // List all price policies for the user's org, sorted newest-first
    list: managementProcedure.query(async ({ ctx, input }) => {
        return await ctx.db
            .select()
            .from(pricePolicies)
            .where(eq(pricePolicies.organizationId, input.orgId))
            .orderBy(desc(pricePolicies.effectiveFrom));
    }),

    // Create a new price policy
    create: managementProcedure
        .input(z.object({
            effectiveFrom: z.string().datetime(),
            feedPricePerBag: z.number().positive(),
            docPricePerBird: z.number().positive(),
            baseSellPrice: z.number().positive(),
        }))
        .mutation(async ({ ctx, input }) => {
            if (ctx.membership?.accessLevel !== "EDIT") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You need edit access to manage price policies.",
                });
            }

            const orgId = input.orgId;

            let created;
            try {
                [created] = await ctx.db
                    .insert(pricePolicies)
                    .values({
                        organizationId: orgId,
                        effectiveFrom: new Date(input.effectiveFrom),
                        feedPricePerBag: String(input.feedPricePerBag),
                        docPricePerBird: String(input.docPricePerBird),
                        baseSellPrice: String(input.baseSellPrice),
                    })
                    .returning();
            } catch (err: any) {
                if (err?.code === "23505") {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "A price policy already exists for this exact date and time. Choose a different effective date.",
                    });
                }
                throw err;
            }

            // Sync org prices with the latest policy
            await syncOrgPrices(ctx.db, orgId);

            return created;
        }),

    // Update an existing price policy
    update: managementProcedure
        .input(z.object({
            id: z.string(),
            effectiveFrom: z.string().datetime().optional(),
            feedPricePerBag: z.number().positive().optional(),
            docPricePerBird: z.number().positive().optional(),
            baseSellPrice: z.number().positive().optional(),
        }))
        .mutation(async ({ ctx, input }) => {
            if (ctx.membership?.accessLevel !== "EDIT") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You need edit access to manage price policies.",
                });
            }

            const orgId = input.orgId;

            // Security: verify the policy belongs to the user's org
            const existing = await ctx.db.query.pricePolicies.findFirst({
                where: and(
                    eq(pricePolicies.id, input.id),
                    eq(pricePolicies.organizationId, orgId),
                ),
            });

            if (!existing) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Price policy not found",
                });
            }

            const updateValues: Partial<typeof pricePolicies.$inferInsert> = {
                updatedAt: new Date(),
            };
            if (input.effectiveFrom !== undefined) {
                updateValues.effectiveFrom = new Date(input.effectiveFrom);
            }
            if (input.feedPricePerBag !== undefined) {
                updateValues.feedPricePerBag = String(input.feedPricePerBag);
            }
            if (input.docPricePerBird !== undefined) {
                updateValues.docPricePerBird = String(input.docPricePerBird);
            }
            if (input.baseSellPrice !== undefined) {
                updateValues.baseSellPrice = String(input.baseSellPrice);
            }

            let updated;
            try {
                [updated] = await ctx.db
                    .update(pricePolicies)
                    .set(updateValues)
                    .where(eq(pricePolicies.id, input.id))
                    .returning();
            } catch (err: any) {
                if (err?.code === "23505") {
                    throw new TRPCError({
                        code: "CONFLICT",
                        message: "A price policy already exists for this exact date and time. Choose a different effective date.",
                    });
                }
                throw err;
            }

            // Sync org prices with the latest policy
            await syncOrgPrices(ctx.db, orgId);

            return updated;
        }),
});

/**
 * Syncs organization price fields to match the most recent (by effectiveFrom) price policy.
 */
async function syncOrgPrices(db: typeof import("@/db").db, orgId: string) {
    const [latest] = await db
        .select()
        .from(pricePolicies)
        .where(eq(pricePolicies.organizationId, orgId))
        .orderBy(desc(pricePolicies.effectiveFrom))
        .limit(1);

    if (!latest) return;

    await db
        .update(organization)
        .set({
            feedPricePerBag: latest.feedPricePerBag,
            docPricePerBird: latest.docPricePerBird,
            baseSellPrice: latest.baseSellPrice,
        })
        .where(eq(organization.id, orgId));
}
