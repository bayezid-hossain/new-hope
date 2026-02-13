import { farmer, feedOrderItems, feedOrders, member, stockLogs } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { format } from "date-fns";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, proProcedure } from "../../init";

export const feedOrdersRouter = createTRPCRouter({
    create: proProcedure
        .input(z.object({
            orgId: z.string(),
            orderDate: z.date(),
            deliveryDate: z.date(),
            items: z.array(z.object({
                farmerId: z.string(),
                feeds: z.array(z.object({
                    type: z.string(),
                    quantity: z.number().min(0)
                }))
            })).min(1)
        }))
        .mutation(async ({ ctx, input }) => {
            // ACCESS LEVEL CHECK
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, input.orgId)
                    )
                });

                if (!membership) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "You are not a member of this organization." });
                }

                if (membership.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot create feed orders." });
                }
            }

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

    list: proProcedure
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

    get: proProcedure
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
        }),

    delete: proProcedure
        .input(z.object({
            id: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            // Verify ownership before deleting
            const order = await ctx.db.query.feedOrders.findFirst({
                where: and(
                    eq(feedOrders.id, input.id),
                    // Allow deleting if they are the creator (officerId) OR if they are an Admin/Manager with Edit rights
                    // The original code only allowed deletion if officerId matches ctx.user.id.
                    // We stick to that for now, but ALSO enforce View Only restriction.
                    eq(feedOrders.officerId, ctx.user.id)
                )
            });

            if (!order) {
                throw new Error("Order not found or you don't have permission to delete it");
            }

            // ACCESS LEVEL CHECK (Even if they are the creator, if their current status is View Only Manager, deny?)
            // This edge case is rare (Manager created it, then got demoted to View Only).
            // But let's be consistent.
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, order.orgId)
                    )
                });
                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot delete feed orders." });
                }
            }

            // Delete the order (items will be cascade deleted due to schema)
            await ctx.db.delete(feedOrders).where(eq(feedOrders.id, input.id));

            return { success: true };
        }),

    update: proProcedure
        .input(z.object({
            id: z.string(),
            orderDate: z.date(),
            deliveryDate: z.date(),
            items: z.array(z.object({
                farmerId: z.string(),
                feeds: z.array(z.object({
                    type: z.string(),
                    quantity: z.number().min(0)
                }))
            })).min(1)
        }))
        .mutation(async ({ ctx, input }) => {
            // 1. Fetch original order and verify ownership
            const order = await ctx.db.query.feedOrders.findFirst({
                where: and(
                    eq(feedOrders.id, input.id),
                    eq(feedOrders.officerId, ctx.user.id)
                )
            });

            if (!order) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Order not found or you don't have permission to edit it" });
            }

            // 2. Perform updates in a transaction
            return await ctx.db.transaction(async (tx) => {
                // A. Update parent order
                await tx.update(feedOrders)
                    .set({
                        orderDate: input.orderDate,
                        deliveryDate: input.deliveryDate
                    })
                    .where(eq(feedOrders.id, input.id));

                // B. Sync items (simplest approach: delete and re-insert)
                await tx.delete(feedOrderItems).where(eq(feedOrderItems.feedOrderId, input.id));

                const itemsToInsert = input.items.flatMap(item =>
                    item.feeds.map(feed => ({
                        feedOrderId: input.id,
                        farmerId: item.farmerId,
                        feedType: feed.type,
                        quantity: feed.quantity
                    }))
                );

                if (itemsToInsert.length > 0) {
                    await tx.insert(feedOrderItems).values(itemsToInsert);
                }

                return { success: true };
            });
        }),

    confirm: proProcedure
        .input(z.object({
            id: z.string(),
            driverName: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const order = await ctx.db.query.feedOrders.findFirst({
                where: eq(feedOrders.id, input.id),
                with: {
                    items: true
                }
            });

            if (!order) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
            }

            if (order.status === "CONFIRMED") {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Order is already confirmed" });
            }

            // Group quantities by farmer
            const farmerUpdates = new Map<string, number>();
            for (const item of order.items) {
                const current = farmerUpdates.get(item.farmerId) || 0;
                farmerUpdates.set(item.farmerId, current + item.quantity);
            }

            return await ctx.db.transaction(async (tx) => {
                const logsToInsert: any[] = [];

                // Update each farmer's mainStock and prepare logs
                for (const [farmerId, quantity] of farmerUpdates.entries()) {
                    await tx.update(farmer)
                        .set({
                            mainStock: sql`${farmer.mainStock} + ${quantity}`,
                            updatedAt: new Date()
                        })
                        .where(eq(farmer.id, farmerId));

                    logsToInsert.push({
                        farmerId,
                        amount: quantity.toString(),
                        type: "RESTOCK",
                        referenceId: input.id, // Group by Feed Order ID
                        driverName: input.driverName || null,
                        note: `Feed Order Confirmed (${format(new Date(), 'dd/MM/yyyy')})`,
                    });
                }

                if (logsToInsert.length > 0) {
                    await tx.insert(stockLogs).values(logsToInsert);
                }

                // Mark order as confirmed
                await tx.update(feedOrders)
                    .set({
                        status: "CONFIRMED",
                        driverName: input.driverName || null
                    })
                    .where(eq(feedOrders.id, input.id));

                return { success: true };
            });
        }),
});
