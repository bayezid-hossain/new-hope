import { farmer, member, saleOrderItems, saleOrders } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, proProcedure } from "../../init";

export const saleOrdersRouter = createTRPCRouter({
    create: proProcedure
        .input(z.object({
            orgId: z.string(),
            orderDate: z.date(),
            branchName: z.string().min(1, "Branch name is required"),
            items: z.array(z.object({
                farmerId: z.string(),
                totalWeight: z.number().positive("Total weight must be greater than 0"),
                totalDoc: z.number().int().positive("DOC count must be greater than 0"),
                avgWeight: z.number().positive("Average weight is required"),
                age: z.number().int().positive("Age is required"),
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
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot create sale orders." });
                }
            }

            const order = await ctx.db.insert(saleOrders).values({
                orgId: input.orgId,
                officerId: ctx.user.id,
                orderDate: input.orderDate,
                branchName: input.branchName || null,
            }).returning();

            const orderId = order[0].id;

            const itemsToInsert = input.items.map(item => ({
                saleOrderId: orderId,
                farmerId: item.farmerId,
                totalWeight: item.totalWeight,
                totalDoc: item.totalDoc,
                avgWeight: item.avgWeight?.toString() || null,
                age: item.age,
            }));

            // Validate Farmers: Ensure they are active (for non-admins)
            if (ctx.user.globalRole !== "ADMIN") {
                const farmers = await ctx.db.query.farmer.findMany({
                    where: and(
                        inArray(farmer.id, input.items.map(i => i.farmerId)),
                        eq(farmer.status, "deleted")
                    )
                });
                if (farmers.length > 0) {
                    throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot create order for deleted farmers: ${farmers.map(f => f.name).join(", ")}` });
                }
            }

            if (itemsToInsert.length > 0) {
                await ctx.db.insert(saleOrderItems).values(itemsToInsert);
            }

            return order[0];
        }),

    list: proProcedure
        .input(z.object({
            orgId: z.string(),
            limit: z.number().min(1).max(100).default(50),
        }))
        .query(async ({ ctx, input }) => {
            const orders = await ctx.db.query.saleOrders.findMany({
                where: and(
                    eq(saleOrders.orgId, input.orgId),
                    eq(saleOrders.officerId, ctx.user.id)
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

    delete: proProcedure
        .input(z.object({
            id: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const order = await ctx.db.query.saleOrders.findFirst({
                where: and(
                    eq(saleOrders.id, input.id),
                    eq(saleOrders.officerId, ctx.user.id)
                )
            });

            if (!order) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Order not found or you don't have permission to delete it" });
            }

            await ctx.db.delete(saleOrders).where(eq(saleOrders.id, input.id));

            return { success: true };
        }),

    deleteAll: proProcedure
        .mutation(async ({ ctx }) => {
            await ctx.db.delete(saleOrders).where(eq(saleOrders.officerId, ctx.user.id));
            return { success: true };
        }),

    update: proProcedure
        .input(z.object({
            id: z.string(),
            orderDate: z.date(),
            branchName: z.string().min(1, "Branch name is required"),
            items: z.array(z.object({
                farmerId: z.string(),
                totalWeight: z.number().positive("Total weight must be greater than 0"),
                totalDoc: z.number().int().positive("DOC count must be greater than 0"),
                avgWeight: z.number().positive("Average weight is required"),
                age: z.number().int().positive("Age is required"),
            })).min(1)
        }))
        .mutation(async ({ ctx, input }) => {
            const order = await ctx.db.query.saleOrders.findFirst({
                where: and(
                    eq(saleOrders.id, input.id),
                    eq(saleOrders.officerId, ctx.user.id)
                )
            });

            if (!order) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Order not found or you don't have permission to edit it" });
            }

            return await ctx.db.transaction(async (tx) => {
                await tx.update(saleOrders)
                    .set({
                        orderDate: input.orderDate,
                        branchName: input.branchName,
                    })
                    .where(eq(saleOrders.id, input.id));

                await tx.delete(saleOrderItems).where(eq(saleOrderItems.saleOrderId, input.id));

                const itemsToInsert = input.items.map(item => ({
                    saleOrderId: input.id,
                    farmerId: item.farmerId,
                    totalWeight: item.totalWeight,
                    totalDoc: item.totalDoc,
                    avgWeight: item.avgWeight?.toString() || null,
                    age: item.age,
                }));

                if (ctx.user.globalRole !== "ADMIN") {
                    const farmers = await tx.query.farmer.findMany({
                        where: and(
                            inArray(farmer.id, input.items.map(i => i.farmerId)),
                            eq(farmer.status, "deleted")
                        )
                    });
                    if (farmers.length > 0) {
                        throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot update order with deleted farmers: ${farmers.map(f => f.name).join(", ")}` });
                    }
                }

                if (itemsToInsert.length > 0) {
                    await tx.insert(saleOrderItems).values(itemsToInsert);
                }

                return { success: true };
            });
        }),
});
