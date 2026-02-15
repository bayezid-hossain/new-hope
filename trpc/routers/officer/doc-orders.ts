import { birdTypes, cycleLogs, cycles, docOrderItems, docOrders, member } from "@/db/schema";
import { updateCycleFeed } from "@/modules/cycles/server/services/feed-service";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, proProcedure } from "../../init";

export const docOrdersRouter = createTRPCRouter({
    create: proProcedure
        .input(z.object({
            orgId: z.string(),
            orderDate: z.date(),
            branchName: z.string().optional(),
            items: z.array(z.object({
                farmerId: z.string(),
                birdType: z.string(),
                docCount: z.number().int().positive(),
                isContract: z.boolean().default(false)
            })).min(1)
        }))
        .mutation(async ({ ctx, input }) => {
            // Access Check
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
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot create doc orders." });
                }
            }

            // DATE VALIDATION: Max 40 days old, no future dates
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            const fortyDaysAgo = new Date();
            fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
            fortyDaysAgo.setHours(0, 0, 0, 0);


            if (input.orderDate < fortyDaysAgo) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Dates older than 40 days are not allowed" });
            }

            const [order] = await ctx.db.insert(docOrders).values({
                orgId: input.orgId,
                officerId: ctx.user.id,
                orderDate: input.orderDate,
                branchName: input.branchName
            }).returning();

            const itemsToInsert = input.items.map(item => ({
                docOrderId: order.id,
                farmerId: item.farmerId,
                birdType: item.birdType,
                docCount: item.docCount,
                isContract: item.isContract
            }));

            if (itemsToInsert.length > 0) {
                await ctx.db.insert(docOrderItems).values(itemsToInsert);
            }

            return order;
        }),

    list: proProcedure
        .input(z.object({
            orgId: z.string(),
            limit: z.number().min(1).max(100).default(50),
        }))
        .query(async ({ ctx, input }) => {
            const orders = await ctx.db.query.docOrders.findMany({
                where: and(
                    eq(docOrders.orgId, input.orgId),
                    eq(docOrders.officerId, ctx.user.id)
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

    delete: proProcedure
        .input(z.object({
            id: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const order = await ctx.db.query.docOrders.findFirst({
                where: and(
                    eq(docOrders.id, input.id),
                    eq(docOrders.officerId, ctx.user.id)
                )
            });

            if (!order) {
                throw new Error("Order not found or you don't have permission to delete it");
            }

            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, order.orgId)
                    )
                });
                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot delete doc orders." });
                }
            }

            await ctx.db.delete(docOrders).where(eq(docOrders.id, input.id));

            return { success: true };
        }),

    update: proProcedure
        .input(z.object({
            id: z.string(),
            orderDate: z.date(),
            branchName: z.string().optional(),
            items: z.array(z.object({
                farmerId: z.string(),
                birdType: z.string(),
                docCount: z.number().int().positive(),
                isContract: z.boolean().default(false)
            })).min(1)
        }))
        .mutation(async ({ ctx, input }) => {
            const order = await ctx.db.query.docOrders.findFirst({
                where: and(
                    eq(docOrders.id, input.id),
                    eq(docOrders.officerId, ctx.user.id)
                )
            });

            if (!order) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Order not found or you don't have permission to edit it" });
            }

            return await ctx.db.transaction(async (tx) => {
                await tx.update(docOrders)
                    .set({
                        orderDate: input.orderDate,
                        branchName: input.branchName
                    })
                    .where(eq(docOrders.id, input.id));

                await tx.delete(docOrderItems).where(eq(docOrderItems.docOrderId, input.id));

                const itemsToInsert = input.items.map(item => ({
                    docOrderId: input.id,
                    farmerId: item.farmerId,
                    birdType: item.birdType,
                    docCount: item.docCount,
                    isContract: item.isContract
                }));

                if (itemsToInsert.length > 0) {
                    await tx.insert(docOrderItems).values(itemsToInsert);
                }

                return { success: true };
            });
        }),

    // BIRD TYPE MANAGEMENT
    getBirdTypes: proProcedure
        .query(async ({ ctx }) => {
            const types = await ctx.db.select().from(birdTypes).orderBy(desc(birdTypes.createdAt));
            return types;
        }),

    createBirdType: proProcedure
        .input(z.object({
            name: z.string().min(1)
        }))
        .mutation(async ({ ctx, input }) => {
            // Check existence
            const existing = await ctx.db.query.birdTypes.findFirst({
                where: eq(birdTypes.name, input.name)
            });

            if (existing) return existing;

            const [newType] = await ctx.db.insert(birdTypes).values({
                name: input.name
            }).returning();

            return newType;
        }),

    // CONFIRM LOGIC
    confirm: proProcedure
        .input(z.object({
            id: z.string(),
            cycleDates: z.record(z.string(), z.string()) // Map of docItemId -> Date String (ISO)
        }))
        .mutation(async ({ ctx, input }) => {
            const order = await ctx.db.query.docOrders.findFirst({
                where: eq(docOrders.id, input.id),
                with: {
                    items: {
                        with: {
                            farmer: true
                        }
                    }
                }
            });

            if (!order) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
            }

            if (order.status === "CONFIRMED") {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Order is already confirmed" });
            }

            return await ctx.db.transaction(async (tx) => {
                const results = [];

                for (const item of order.items) {
                    const cycleDateStr = input.cycleDates[item.id];
                    const cycleDate = cycleDateStr ? new Date(cycleDateStr) : order.orderDate;

                    // DATE VALIDATION: Max 40 days old, no future dates
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);

                    const fortyDaysAgo = new Date();
                    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
                    fortyDaysAgo.setHours(0, 0, 0, 0);

                    if (cycleDate < fortyDaysAgo) {
                        throw new TRPCError({ code: "BAD_REQUEST", message: `Date older than 40 days not allowed for farmer ${item.farmer.name}` });
                    }

                    // Create Cycle
                    const [newCycle] = await tx.insert(cycles).values({
                        name: item.farmer.name, // Cycle Name = Farmer Name
                        farmerId: item.farmerId,
                        organizationId: order.orgId,
                        doc: item.docCount,
                        age: 0,
                        birdType: item.birdType,
                        createdAt: cycleDate,
                        status: "active"
                    }).returning();

                    await tx.insert(cycleLogs).values({
                        cycleId: newCycle.id,
                        userId: ctx.user.id,
                        type: "SYSTEM",
                        valueChange: 0,
                        note: `Cycle started from DOC Order. Birds: ${item.docCount}, Type: ${item.birdType}`
                    });

                    // Initialize feed tracking
                    await updateCycleFeed(newCycle, ctx.user.id, true, tx);

                    results.push(newCycle);
                }

                // Mark order as confirmed
                await tx.update(docOrders)
                    .set({
                        status: "CONFIRMED"
                    })
                    .where(eq(docOrders.id, input.id));

                return { success: true, createdCycles: results.length };
            });
        }),
});
