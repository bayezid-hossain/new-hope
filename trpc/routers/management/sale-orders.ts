import { saleOrders } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, managementProProcedure } from "../../init";

export const managementSaleOrdersRouter = createTRPCRouter({
    list: managementProProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(50),
            officerId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const orders = await ctx.db.query.saleOrders.findMany({
                where: and(
                    eq(saleOrders.orgId, input.orgId),
                    input.officerId ? eq(saleOrders.officerId, input.officerId) : undefined
                ),
                with: {
                    items: {
                        with: {
                            farmer: true
                        }
                    }
                },
                orderBy: [desc(saleOrders.orderDate), desc(saleOrders.createdAt)],
                limit: input.limit
            });

            return orders.map(order => ({
                ...order,
                items: order.items.filter(item => {
                    if (ctx.user.globalRole === "ADMIN") return true;
                    return item.farmer?.status !== "deleted";
                })
            }));
        }),
});
