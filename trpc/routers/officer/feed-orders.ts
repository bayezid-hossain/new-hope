import { feedOrderItems, feedOrders } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";

export const feedOrdersRouter = createTRPCRouter({
    create: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            orderDate: z.date(),
            deliveryDate: z.date(),
            items: z.array(z.object({
                farmerId: z.string(),
                feeds: z.array(z.object({
                    type: z.string(),
                    quantity: z.number().min(1)
                }))
            })).min(1)
        }))
        .mutation(async ({ ctx, input }) => {
            const order = await ctx.db.insert(feedOrders).values({
                orgId: input.orgId,
                officerId: ctx.user.id,
                orderDate: input.orderDate,
                deliveryDate: input.deliveryDate
            }).returning();

            const orderId = order[0].id;

            const itemsToInsert = input.items.flatMap(item =>
                item.feeds.map(feed => ({
                    feedOrderId: orderId,
                    farmerId: item.farmerId,
                    feedType: feed.type,
                    quantity: feed.quantity
                }))
            );

            if (itemsToInsert.length > 0) {
                await ctx.db.insert(feedOrderItems).values(itemsToInsert);
            }

            return order[0];
        }),

    list: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            limit: z.number().min(1).max(100).default(50),
            cursor: z.string().nullish(), // For infinite scrolling if needed later (using date or id)
        }))
        .query(async ({ ctx, input }) => {
            const orders = await ctx.db.query.feedOrders.findMany({
                where: and(
                    eq(feedOrders.orgId, input.orgId),
                    eq(feedOrders.officerId, ctx.user.id)
                ),
                with: {
                    items: {
                        with: {
                            farmer: true
                        }
                    }
                },
                orderBy: [desc(feedOrders.orderDate), desc(feedOrders.createdAt)],
                limit: input.limit
            });

            return orders;
        }),

    get: protectedProcedure
        .input(z.object({
            id: z.string()
        }))
        .query(async ({ ctx, input }) => {
            const order = await ctx.db.query.feedOrders.findFirst({
                where: eq(feedOrders.id, input.id),
                with: {
                    items: {
                        with: {
                            farmer: true
                        }
                    }
                }
            });
            return order;
        })
});
