import { feedOrders } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, orgProcedure, protectedProcedure } from "../../init";

export const managementFeedOrdersRouter = createTRPCRouter({
    // List all feed orders in the organization (for managers/admins)
    list: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            limit: z.number().min(1).max(100).default(50),
            officerId: z.string().optional(), // Filter by specific officer
        }))
        .query(async ({ ctx, input }) => {

            const orders = await ctx.db.query.feedOrders.findMany({
                where: (feedOrders, { and, eq }) => and(
                    eq(feedOrders.orgId, input.orgId),
                    input.officerId ? eq(feedOrders.officerId, input.officerId) : undefined
                ),
                with: {
                    items: {
                        with: {
                            farmer: true
                        }
                    },
                    officer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            image: true
                        }
                    }
                },
                orderBy: [desc(feedOrders.orderDate), desc(feedOrders.createdAt)],
                limit: input.limit
            });

            return orders;
        }),

    // Get single feed order details
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
                    },
                    officer: {
                        columns: {
                            id: true,
                            name: true,
                            email: true,
                            image: true
                        }
                    }
                }
            });
            return order;
        }),

    // Delete any feed order (manager permission)
    // Delete any feed order (manager permission)
    delete: orgProcedure
        .input(z.object({
            id: z.string(),
            // orgId is already required by orgProcedure's input schema merging
        }))
        .mutation(async ({ ctx, input }) => {
            // Access Check: Must have EDIT permissions
            if (ctx.membership?.accessLevel !== "EDIT") {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You need 'EDIT' access to delete feed orders."
                });
            }

            // Verify the order belongs to this org
            const order = await ctx.db.query.feedOrders.findFirst({
                where: eq(feedOrders.id, input.id)
            });

            if (!order || order.orgId !== input.orgId) {
                throw new Error("Order not found or doesn't belong to this organization");
            }

            // Delete the order (items will be cascade deleted)
            await ctx.db.delete(feedOrders).where(eq(feedOrders.id, input.id));

            return { success: true };
        })
});
