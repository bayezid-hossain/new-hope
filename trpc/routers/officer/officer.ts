import { db } from "@/db";
import { featureRequest } from "@/db/schema";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";
import { officerAiRouter } from "./ai";
import { officerCyclesRouter } from "./cycles";
import { officerFarmersRouter } from "./farmers";
import { officerStockRouter } from "./stock";

export const officerRouter = createTRPCRouter({
    cycles: officerCyclesRouter,
    farmers: officerFarmersRouter,
    stock: officerStockRouter,
    ai: officerAiRouter,
    requestAccess: protectedProcedure
        .input(z.object({ feature: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await db.insert(featureRequest).values({
                userId: ctx.user.id,
                feature: input.feature,
            });
            return { success: true };
        }),
});
