import { member, saleOrderItems, saleOrders } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, proProcedure } from "../../init";

export const saleOrdersRouter = createTRPCRouter({
    create: proProcedure
        .input(z.object({
            orgId: z.string(),
            orderDate: z.date(),
            branchName: z.string().optional(),
            items: z.array(z.object({
                farmerId: z.string(),
                totalWeight: z.number().min(0),
                totalDoc: z.number().int().min(0),
                avgWeight: z.number().optional(),
                age: z.number().int().min(0).default(0),
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

            if (itemsToInsert.length > 0) {
                await ctx.db.insert(saleOrderItems).values(itemsToInsert);
            }

            return order[0];
        }),

    list: proProcedure
        .input(z.object({
            orgId: z.string(),
            limit: z.number().min(1).max(100).default(50),
            officerId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const targetOfficerId = input.officerId ?? ctx.user.id;
            const orders = await ctx.db.query.saleOrders.findMany({
                where: and(
                    eq(saleOrders.orgId, input.orgId),
                    eq(saleOrders.officerId, targetOfficerId)
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

            return orders;
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
});
