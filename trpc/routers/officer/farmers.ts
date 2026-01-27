import { cycles, farmer, stockLogs } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";

export const officerFarmersRouter = createTRPCRouter({
    // DASHBOARD: "Warehouse View" / List for Officer
    listWithStock: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            search: z.string().optional(),
            page: z.number().default(1),
            pageSize: z.number().default(10),
            sortBy: z.string().optional(),
            sortOrder: z.enum(["asc", "desc"]).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, search, page, pageSize } = input;

            const farmersData = await ctx.db.query.farmer.findMany({
                where: and(
                    eq(farmer.organizationId, orgId), eq(farmer.officerId, ctx.user.id),
                    search ? ilike(farmer.name, `%${search}%`) : undefined
                ),
                limit: pageSize,
                offset: (page - 1) * pageSize,
                orderBy: [desc(farmer.createdAt)],
                with: {
                    cycles: {
                        where: eq(cycles.status, "active"),
                        orderBy: [desc(cycles.createdAt)]
                    },
                    history: true
                }
            });

            const [total] = await ctx.db.select({ count: sql<number>`count(*)` })
                .from(farmer)
                .where(and(
                    eq(farmer.organizationId, orgId),
                    eq(farmer.officerId, ctx.user.id),
                    search ? ilike(farmer.name, `%${search}%`) : undefined
                ));

            return {
                items: farmersData.map(f => {
                    // 1. Active Consumption: Feed eaten by cycles that are currently OPEN
                    const activeConsumption = f.cycles.reduce((sum, c) => sum + (Number(c.intake) || 0), 0);
                    // 2. Real Available Stock: Book Balance - Active Consumption
                    const remainingStock = f.mainStock - activeConsumption;

                    return {
                        ...f,
                        activeCycles: f.cycles,
                        activeCyclesCount: f.cycles.length,
                        pastCyclesCount: f.history.length,
                        mainStock: f.mainStock,
                        totalConsumed: f.totalConsumed,
                        activeConsumption: activeConsumption,
                        remainingStock: remainingStock,
                        isLowStock: remainingStock < 5
                    };
                }),
                total: Number(total.count),
                totalPages: Math.ceil(Number(total.count) / pageSize)
            };
        }),

    getMany: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            search: z.string().optional(),
            page: z.number().default(1),
            pageSize: z.number().default(20),
            sortBy: z.string().optional(),
            sortOrder: z.enum(["asc", "desc"]).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, search, page, pageSize, sortBy, sortOrder } = input;

            const whereClause = and(
                eq(farmer.organizationId, orgId),
                eq(farmer.officerId, ctx.user.id),
                search ? ilike(farmer.name, `%${search}%`) : undefined
            );

            // Determine sort order
            let orderBy = [desc(farmer.createdAt)];
            if (sortBy === "createdAt") {
                orderBy = [sortOrder === "asc" ? sql`${farmer.createdAt} asc` : desc(farmer.createdAt)];
            } else if (sortBy === "name") {
                orderBy = [sortOrder === "asc" ? sql`${farmer.name} asc` : desc(farmer.name)];
            }

            const data = await ctx.db.query.farmer.findMany({
                where: whereClause,
                limit: pageSize,
                offset: (page - 1) * pageSize,
                orderBy: orderBy,
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                    history: true
                }
            });

            const [total] = await ctx.db.select({ count: sql<number>`count(*)` })
                .from(farmer)
                .where(whereClause);

            return {
                items: data.map(f => ({
                    ...f,
                    activeCyclesCount: f.cycles.length,
                    pastCyclesCount: f.history.length,
                    officerName: "Me"
                })),
                total: Number(total.count),
                totalPages: Math.ceil(Number(total.count) / pageSize)
            };
        }),

    create: protectedProcedure
        .input(z.object({
            name: z.string().min(2).max(100),
            orgId: z.string(),
            initialStock: z.number().min(0).max(1000, "Initial stock cannot exceed 1000 bags")
        }))
        .mutation(async ({ ctx, input }) => {
            const existing = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.officerId, ctx.user.id),
                    ilike(farmer.name, input.name.toUpperCase())
                )
            });

            if (existing) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `A farmer named "${input.name}" is already registered under your account.`
                });
            }

            return await ctx.db.transaction(async (tx) => {
                const [newFarmer] = await tx.insert(farmer).values({
                    name: input.name.toUpperCase(),
                    organizationId: input.orgId,
                    officerId: ctx.user.id,
                    mainStock: input.initialStock,
                }).returning();

                if (input.initialStock > 0) {
                    await tx.insert(stockLogs).values({
                        farmerId: newFarmer.id,
                        amount: input.initialStock.toString(),
                        type: "INITIAL",
                        note: "Initial Stock Assignment"
                    });
                }
                return newFarmer;
            });
        }),

    getDetails: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            const data = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.farmerId), eq(farmer.officerId, ctx.user.id)),
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                }
            });

            if (!data) throw new TRPCError({ code: "NOT_FOUND" });
            return data;
        }),
});
