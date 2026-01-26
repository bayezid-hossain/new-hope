import { farmer } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";
import { officerCyclesRouter } from "./cycles";

export const officerRouter = createTRPCRouter({
    cycles: officerCyclesRouter,

    createFarmer: protectedProcedure
        .input(z.object({
            name: z.string().min(1),
            phone: z.string().min(1),
            mainStock: z.number().min(0),
            orgId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            // Check for existing farmer with same name for THIS officer in THIS org (Case-Insensitive)
            const existing = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.officerId, userId),
                    ilike(farmer.name, input.name.toUpperCase())
                )
            });

            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `A farmer named "${input.name}" is already registered under your account.`
                });
            }

            const [newFarmer] = await ctx.db.insert(farmer).values({
                name: input.name.toUpperCase(),
                organizationId: input.orgId,
                mainStock: input.mainStock,
                officerId: userId,
            }).returning();

            return newFarmer;
        }),

    getMyFarmers: protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
            const userId = ctx.user.id;

            return await ctx.db.query.farmer.findMany({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.officerId, userId)
                ),
                with: {
                    cycles: true
                }
            });
        }),
});
