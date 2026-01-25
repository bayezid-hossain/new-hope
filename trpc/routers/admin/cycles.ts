import { cycleHistory, cycleLogs, cycles, farmer } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, ilike, ne } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    if (ctx.user.globalRole !== "ADMIN") {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "Admin access required"
        });
    }
    return next();
});

const cycleSearchSchema = z.object({
    search: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(10),
    orgId: z.string(),
    sortBy: z.enum(["name", "age", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const adminCyclesRouter = createTRPCRouter({
    listActive: adminProcedure
        .input(cycleSearchSchema)
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, orgId, sortBy, sortOrder } = input;
            const offset = (page - 1) * pageSize;

            const whereClause = and(
                eq(cycles.organizationId, orgId),
                eq(cycles.status, "active"),
                search ? ilike(cycles.name, `%${search}%`) : undefined,
            );

            let orderByClause;
            switch (sortBy) {
                case "name":
                    orderByClause = sortOrder === "asc" ? asc(cycles.name) : desc(cycles.name);
                    break;
                case "createdAt":
                    orderByClause = sortOrder === "asc" ? asc(cycles.createdAt) : desc(cycles.createdAt);
                    break;
                // 'age' is not directly applicable to cycles table, default to createdAt
                default:
                    orderByClause = sortOrder === "asc" ? asc(cycles.createdAt) : desc(cycles.createdAt);
                    break;
            }

            const data = await ctx.db.select({
                cycle: cycles,
                farmerName: farmer.name,
            })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(whereClause)
                .orderBy(orderByClause)
                .limit(pageSize)
                .offset(offset);

            const [total] = await ctx.db.select({ count: count() })
                .from(cycles)
                .where(whereClause);

            return {
                items: data.map(d => ({ ...d.cycle, farmerName: d.farmerName })),
                total: total.count,
                totalPages: Math.ceil(total.count / pageSize)
            };
        }),

    getDetails: adminProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const activeCycle = await ctx.db.query.cycles.findFirst({
                where: eq(cycles.id, input.id),
                with: { farmer: true }
            });

            if (activeCycle) {
                const logs = await ctx.db.select().from(cycleLogs)
                    .where(eq(cycleLogs.cycleId, activeCycle.id))
                    .orderBy(desc(cycleLogs.createdAt));

                const history = await ctx.db.select().from(cycleHistory)
                    .where(and(eq(cycleHistory.farmerId, activeCycle.farmerId)))
                    .orderBy(desc(cycleHistory.endDate));

                return {
                    type: 'active' as const,
                    data: {
                        ...activeCycle,
                        cycleName: activeCycle.name,
                        finalIntake: activeCycle.intake,
                        startDate: activeCycle.createdAt,
                        endDate: null as Date | null,
                        organizationId: activeCycle.organizationId || null,
                    },
                    logs,
                    history: history.map(h => ({ ...h, status: 'archived' as const })),
                    farmerContext: { mainStock: activeCycle.farmer.mainStock, name: activeCycle.farmer.name }
                };
            }

            const historyRecord = await ctx.db.query.cycleHistory.findFirst({
                where: eq(cycleHistory.id, input.id),
                with: { farmer: true }
            });

            if (!historyRecord) throw new TRPCError({ code: "NOT_FOUND" });

            const logs = await ctx.db.select().from(cycleLogs)
                .where(eq(cycleLogs.historyId, historyRecord.id))
                .orderBy(desc(cycleLogs.createdAt));

            const otherHistory = await ctx.db.select().from(cycleHistory)
                .where(and(eq(cycleHistory.farmerId, historyRecord.farmerId), ne(cycleHistory.id, historyRecord.id)))
                .orderBy(desc(cycleHistory.endDate));

            return {
                type: 'history' as const,
                data: {
                    ...historyRecord,
                    name: historyRecord.cycleName,
                    intake: historyRecord.finalIntake,
                    createdAt: historyRecord.startDate,
                    updatedAt: historyRecord.endDate,
                },
                logs,
                history: otherHistory.map(h => ({ ...h, status: 'archived' as const })),
                farmerContext: { mainStock: historyRecord.farmer.mainStock, name: historyRecord.farmer.name }
            };
        }),

    listPast: adminProcedure
        .input(cycleSearchSchema)
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, orgId, sortBy, sortOrder } = input;
            const offset = (page - 1) * pageSize;

            const whereClause = and(
                eq(cycleHistory.organizationId, orgId),
                search ? ilike(cycleHistory.cycleName, `%${search}%`) : undefined
            );

            const data = await ctx.db.select({
                history: cycleHistory,
                farmerName: farmer.name
            })
                .from(cycleHistory)
                .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
                .where(whereClause)
                .orderBy(desc(cycleHistory.endDate))
                .limit(pageSize)
                .offset(offset);

            const [total] = await ctx.db.select({ count: count() })
                .from(cycleHistory)
                .where(whereClause);

            return {
                items: data.map(d => ({
                    ...d.history,
                    name: d.history.cycleName,
                    farmerName: d.farmerName,
                    status: 'archived'
                })),
                total: total.count,
            };
        }),

    deleteHistory: adminProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await ctx.db.delete(cycleHistory).where(eq(cycleHistory.id, input.id));
            return { success: true };
        }),
});
