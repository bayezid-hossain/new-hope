import { db } from "@/db";
import { featureRequest } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";
import { officerCyclesRouter } from "./cycles";
import { officerFarmersRouter } from "./farmers";
import { officerStockRouter } from "./stock";

export const officerRouter = createTRPCRouter({
    cycles: officerCyclesRouter,
    farmers: officerFarmersRouter,
    stock: officerStockRouter,
    getMyRequestStatus: protectedProcedure
        .input(z.object({ feature: z.string() }))
        .query(async ({ ctx, input }) => {
            const [request] = await db
                .select()
                .from(featureRequest)
                .where(
                    and(
                        eq(featureRequest.userId, ctx.user.id),
                        eq(featureRequest.feature, input.feature)
                    )
                )
                .orderBy(desc(featureRequest.createdAt))
                .limit(1);

            return request || null;
        }),
    requestAccess: protectedProcedure
        .input(z.object({ feature: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Check if already has a pending request
            const [existing] = await db
                .select()
                .from(featureRequest)
                .where(
                    and(
                        eq(featureRequest.userId, ctx.user.id),
                        eq(featureRequest.feature, input.feature),
                        eq(featureRequest.status, "PENDING")
                    )
                )
                .limit(1);

            if (existing) {
                return { success: true, alreadyExists: true };
            }

            await db.insert(featureRequest).values({
                userId: ctx.user.id,
                feature: input.feature,
            });
            return { success: true };
        }),
});
