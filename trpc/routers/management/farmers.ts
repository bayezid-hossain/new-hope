import { cycleHistory, cycles, farmer, member, stockLogs } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";

export const managementFarmersRouter = createTRPCRouter({
    getMany: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            search: z.string().optional(),
            page: z.number().default(1),
            pageSize: z.number().default(50),
            onlyMine: z.boolean().optional().default(false),
            sortBy: z.string().optional(),
            sortOrder: z.enum(["asc", "desc"]).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { orgId, search, page, pageSize, onlyMine } = input;

            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const whereClause = and(
                eq(farmer.organizationId, orgId),
                search ? ilike(farmer.name, `%${search}%`) : undefined,
                onlyMine ? eq(farmer.officerId, ctx.user.id) : undefined
            );

            const data = await ctx.db.query.farmer.findMany({
                where: whereClause,
                limit: pageSize,
                offset: (page - 1) * pageSize,
                orderBy: [desc(farmer.createdAt)],
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                    history: true,
                    officer: true
                }
            });

            const [total] = await ctx.db.select({ count: sql<number>`count(*)` })
                .from(farmer)
                .where(whereClause);

            return {
                items: data.map(f => {
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    const { officer, ...rest } = f;
                    return {
                        ...rest,
                        officerName: officer?.name || "Unknown",
                        activeCyclesCount: f.cycles.length,
                        pastCyclesCount: f.history.length
                    };
                }),
                total: Number(total.count),
                totalPages: Math.ceil(Number(total.count) / pageSize)
            };
        }),

    getOrgFarmers: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            search: z.string().optional()
        }))
        .query(async ({ ctx, input }) => {
            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, input.orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const search = input.search;
            const data = await ctx.db.query.farmer.findMany({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    search ? ilike(farmer.name, `%${search}%`) : undefined
                ),
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                    history: true,
                    officer: true
                },
                orderBy: [desc(farmer.createdAt)]
            });

            return data.map(f => ({
                ...f,
                officerName: f.officer.name,
                activeCyclesCount: f.cycles.length,
                pastCyclesCount: f.history.length
            }));
        }),

    getDetails: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            const data = await ctx.db.query.farmer.findFirst({
                where: eq(farmer.id, input.farmerId),
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                    history: true,
                    officer: true
                }
            });

            if (!data) throw new TRPCError({ code: "NOT_FOUND" });

            // Access Check (Post-fetch to get OrgId)
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, data.organizationId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            return data;
        }),

    getCycles: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, f.organizationId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const data = await ctx.db.select({
                cycle: cycles,
                farmerName: farmer.name,
            })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(and(eq(cycles.farmerId, input.farmerId), eq(cycles.status, "active")))
                .orderBy(desc(cycles.createdAt));

            return { items: data.map(d => ({ ...d.cycle, farmerName: d.farmerName })) };
        }),

    getHistory: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, f.organizationId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const data = await ctx.db.select({
                history: cycleHistory,
                farmerName: farmer.name
            })
                .from(cycleHistory)
                .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
                .where(eq(cycleHistory.farmerId, input.farmerId))
                .orderBy(desc(cycleHistory.endDate));

            return {
                items: data.map(d => ({
                    ...d.history,
                    name: d.history.cycleName,
                    farmerName: d.farmerName,
                    organizationId: d.history.organizationId || "",
                    createdAt: d.history.startDate,
                    updatedAt: d.history.endDate,
                    intake: d.history.finalIntake,
                    status: 'archived'
                }))
            };
        }),

    getStockLogs: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, f.organizationId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            return await ctx.db.select()
                .from(stockLogs)
                .where(eq(stockLogs.farmerId, input.farmerId))
                .orderBy(desc(stockLogs.createdAt));
        }),

    getManagementHub: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            const farmerData = await ctx.db.query.farmer.findFirst({
                where: eq(farmer.id, input.farmerId),
                with: { officer: true }
            });

            if (!farmerData) throw new TRPCError({ code: "NOT_FOUND" });

            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, farmerData.organizationId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const [activeCyclesData, historyData, stockLogsData] = await Promise.all([
                ctx.db.select().from(cycles).where(and(eq(cycles.farmerId, input.farmerId), eq(cycles.status, "active"))).orderBy(desc(cycles.createdAt)),
                ctx.db.select().from(cycleHistory).where(eq(cycleHistory.farmerId, input.farmerId)).orderBy(desc(cycleHistory.endDate)),
                ctx.db.select().from(stockLogs).where(eq(stockLogs.farmerId, input.farmerId)).orderBy(desc(stockLogs.createdAt)).limit(50)
            ]);

            return {
                farmer: {
                    ...farmerData,
                    officerName: farmerData.officer.name,
                },
                activeCycles: {
                    items: activeCyclesData.map(c => ({ ...c, farmerName: farmerData.name }))
                },
                history: {
                    items: historyData.map(h => ({
                        ...h,
                        name: h.cycleName,
                        farmerName: farmerData.name,
                        organizationId: h.organizationId || "",
                        createdAt: h.startDate,
                        updatedAt: h.endDate,
                        intake: h.finalIntake,
                        status: 'archived' as const
                    }))
                },
                stockLogs: stockLogsData
            };
        }),
});
