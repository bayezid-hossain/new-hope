import { pricePolicies } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "../../init";

const policyInput = z.object({
    effectiveFrom: z.string().datetime(),
    feedPricePerBag: z.number().positive(),
    docPricePerBird: z.number().positive(),
    baseSellPrice: z.number().positive(),
});

const conflict = (err: any): never => {
    if (err?.code === "23505") {
        throw new TRPCError({ code: "CONFLICT", message: "You already have prices for this exact date and time. Choose a different effective date." });
    }
    throw err;
};

export const officerPricePoliciesRouter = createTRPCRouter({
    list: orgProcedure.query(({ ctx, input }) =>
        ctx.db.select().from(pricePolicies)
            .where(and(eq(pricePolicies.organizationId, input.orgId), eq(pricePolicies.officerId, ctx.user.id)))
            .orderBy(desc(pricePolicies.effectiveFrom))),

    // Used by the launch reminder: has this officer set prices that apply today?
    status: orgProcedure.query(async ({ ctx, input }) => {
        const [row] = await ctx.db.select({ id: pricePolicies.id }).from(pricePolicies)
            .where(and(
                eq(pricePolicies.organizationId, input.orgId),
                eq(pricePolicies.officerId, ctx.user.id),
                lte(pricePolicies.effectiveFrom, new Date()),
            )).limit(1);
        return { hasOwnPolicy: !!row };
    }),

    create: orgProcedure.input(policyInput).mutation(async ({ ctx, input }) => {
        try {
            const [created] = await ctx.db.insert(pricePolicies).values({
                organizationId: input.orgId,
                officerId: ctx.user.id,
                effectiveFrom: new Date(input.effectiveFrom),
                feedPricePerBag: String(input.feedPricePerBag),
                docPricePerBird: String(input.docPricePerBird),
                baseSellPrice: String(input.baseSellPrice),
            }).returning();
            return created;
        } catch (err) { return conflict(err); }
    }),

    update: orgProcedure.input(policyInput.partial().extend({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const { id, orgId, ...rest } = input;
        const [existing] = await ctx.db.select().from(pricePolicies)
            .where(and(eq(pricePolicies.id, id), eq(pricePolicies.organizationId, orgId), eq(pricePolicies.officerId, ctx.user.id)));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Price policy not found" });
        try {
            const [updated] = await ctx.db.update(pricePolicies).set({
                ...(rest.effectiveFrom ? { effectiveFrom: new Date(rest.effectiveFrom) } : {}),
                ...(rest.feedPricePerBag != null ? { feedPricePerBag: String(rest.feedPricePerBag) } : {}),
                ...(rest.docPricePerBird != null ? { docPricePerBird: String(rest.docPricePerBird) } : {}),
                ...(rest.baseSellPrice != null ? { baseSellPrice: String(rest.baseSellPrice) } : {}),
                updatedAt: new Date(),
            }).where(eq(pricePolicies.id, id)).returning();
            return updated;
        } catch (err) { return conflict(err); }
    }),

    delete: orgProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
        const [existing] = await ctx.db.select().from(pricePolicies)
            .where(and(eq(pricePolicies.id, input.id), eq(pricePolicies.organizationId, input.orgId), eq(pricePolicies.officerId, ctx.user.id)));
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Price policy not found" });
        await ctx.db.delete(pricePolicies).where(eq(pricePolicies.id, input.id));
        return { success: true };
    }),
});
