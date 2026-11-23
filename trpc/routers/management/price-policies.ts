import { member, organization, pricePolicies, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, managementProcedure } from "../../init";

export const managementPricePoliciesRouter = createTRPCRouter({

    // List all price policies for the user's org, sorted newest-first
    // officerId: a user id, "default" (org default only), or omitted (everything)
    list: managementProcedure
        .input(z.object({ officerId: z.string().optional() }))
        .query(async ({ ctx, input }) => {
            const scope =
                input.officerId === "default" ? isNull(pricePolicies.officerId)
                : input.officerId ? eq(pricePolicies.officerId, input.officerId)
                : undefined;
            const rows = await ctx.db
                .select({ policy: pricePolicies, officerName: user.name })
                .from(pricePolicies)
                .leftJoin(user, eq(pricePolicies.officerId, user.id))
                .where(and(eq(pricePolicies.organizationId, input.orgId), scope))
                .orderBy(desc(pricePolicies.effectiveFrom));
            return rows.map((r) => ({ ...r.policy, officerName: r.officerName }));
        }),

    // Create a new price policy
    create: managementProcedure
        .input(z.object({
            officerId: z.string().optional(), // omitted = org default
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

            if (input.officerId) {
                const officerMember = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, input.officerId),
                        eq(member.organizationId, orgId),
                        eq(member.status, "ACTIVE"),
                    ),
                });
                if (!officerMember) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "That officer is not an active member of this organization.",
                    });
                }
            }

            const scopeConflictMessage = input.officerId
                ? "This officer already has a price policy for this exact date and time. Choose a different effective date."
                : "A price policy already exists for this exact date and time. Choose a different effective date.";

            let created;
            try {
                [created] = await ctx.db
                    .insert(pricePolicies)
                    .values({
                        organizationId: orgId,
                        officerId: input.officerId ?? null,
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
                        message: scopeConflictMessage,
                    });
                }
                throw err;
            }

            // Sync org prices with the latest org default policy (officer policies never affect the org row)
            if (!input.officerId) await syncOrgPrices(ctx.db, orgId);

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

            const scopeConflictMessage = existing.officerId
                ? "This officer already has a price policy for this exact date and time. Choose a different effective date."
                : "A price policy already exists for this exact date and time. Choose a different effective date.";

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
                        message: scopeConflictMessage,
                    });
                }
                throw err;
            }

            // Sync org prices with the latest org default policy (officer policies never affect the org row)
            if (!existing.officerId) await syncOrgPrices(ctx.db, orgId);

            return updated;
        }),

    // Delete a price policy
    delete: managementProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            if (ctx.membership?.accessLevel !== "EDIT") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You need edit access to manage price policies.",
                });
            }

            const orgId = input.orgId;

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

            await ctx.db.delete(pricePolicies).where(eq(pricePolicies.id, input.id));

            // Re-sync org prices in case the deleted org default was the latest
            if (!existing.officerId) await syncOrgPrices(ctx.db, orgId);
        }),
});

/**
 * Syncs organization price fields to match the most recent (by effectiveFrom) org default price policy (officerId IS NULL).
 */
async function syncOrgPrices(db: typeof import("@/db").db, orgId: string) {
    const [latest] = await db
        .select()
        .from(pricePolicies)
        .where(and(eq(pricePolicies.organizationId, orgId), isNull(pricePolicies.officerId)))
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
