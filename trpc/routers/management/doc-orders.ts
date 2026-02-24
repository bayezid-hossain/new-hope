import { docOrders } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, managementProcedure } from "../../init";

export const managementDocOrdersRouter = createTRPCRouter({
    list: managementProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(50),
            officerId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const orders = await ctx.db.query.docOrders.findMany({
                where: and(
                    eq(docOrders.orgId, input.orgId),
                    input.officerId ? eq(docOrders.officerId, input.officerId) : undefined
                ),
                with: {
                    items: {
                        with: {
                            farmer: true
                        }
                    }
                },
                orderBy: [desc(docOrders.orderDate), desc(docOrders.createdAt)],
                limit: input.limit
            });

            return orders;
        }),
});
