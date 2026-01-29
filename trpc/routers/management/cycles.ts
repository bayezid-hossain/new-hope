import { cycleHistory, cycleLogs, cycles, farmer, member, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { aliasedTable, and, asc, count, desc, eq, ilike, ne, or } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";

const managementProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    // Logic to verify user is manager/owner of org or global admin
    // For now, passing through as the procedures check membership individually
    return next();
});

const cycleSearchSchema = z.object({
    search: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(10),
    orgId: z.string(),
    farmerId: z.string().optional(),
    sortBy: z.enum(["name", "age", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const managementCyclesRouter = createTRPCRouter({
    listActive: managementProcedure
        .input(cycleSearchSchema)
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, orgId, farmerId, sortBy, sortOrder } = input;
            const users = aliasedTable(user, "officer");

            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const offset = (page - 1) * pageSize;

            let orderByClause: any[] = [asc(farmer.name), desc(cycles.createdAt)];
            if (sortBy === "name") orderByClause = [sortOrder === "asc" ? asc(cycles.name) : desc(cycles.name)];
            if (sortBy === "age") orderByClause = [sortOrder === "asc" ? asc(cycles.age) : desc(cycles.age)];
            if (sortBy === "createdAt") orderByClause = [sortOrder === "asc" ? asc(cycles.createdAt) : desc(cycles.createdAt)];

            const whereClause = and(
                eq(cycles.organizationId, orgId),
                eq(cycles.status, "active"),
                farmerId ? eq(cycles.farmerId, farmerId) : undefined,
                search ? or(
                    ilike(cycles.name, `%${search}%`),
                    ilike(farmer.name, `%${search}%`),
                    ilike(users.name, `%${search}%`)
                ) : undefined,
            );

            const data = await ctx.db.select({
                cycle: cycles,
                farmerName: farmer.name,
                farmerMainStock: farmer.mainStock,
                officerName: users.name
            })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .leftJoin(users, eq(farmer.officerId, users.id))
                .where(whereClause)
                .orderBy(...orderByClause)
                .limit(pageSize)
                .offset(offset);

            const [total] = await ctx.db.select({ count: count() })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .leftJoin(users, eq(farmer.officerId, users.id))
                .where(whereClause);

            return {
                items: data.map(d => ({
                    id: d.cycle.id,
                    name: d.cycle.name,
                    farmerId: d.cycle.farmerId,
                    organizationId: d.cycle.organizationId || null,
                    doc: d.cycle.doc,
                    age: d.cycle.age,
                    intake: d.cycle.intake,
                    mortality: d.cycle.mortality,
                    status: "active" as const,
                    createdAt: d.cycle.createdAt,
                    updatedAt: d.cycle.updatedAt,
                    farmerName: d.farmerName,
                    farmerMainStock: d.farmerMainStock,
                    officerName: d.officerName || null,
                    endDate: null as Date | null
                })),
                total: total.count,
                totalPages: Math.ceil(total.count / pageSize)
            };
        }),

    getDetails: managementProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const activeCycle = await ctx.db.query.cycles.findFirst({
                where: eq(cycles.id, input.id),
                with: { farmer: true }
            });

            if (activeCycle) {
                // Access Check
                if (ctx.user.globalRole !== "ADMIN") {
                    const membership = await ctx.db.query.member.findFirst({
                        where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, activeCycle.organizationId), eq(member.status, "ACTIVE"))
                    });
                    if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
                }

                const logs = await ctx.db.select().from(cycleLogs)
                    .where(eq(cycleLogs.cycleId, activeCycle.id))
                    .orderBy(desc(cycleLogs.createdAt));

                const history = await ctx.db.select().from(cycleHistory)
                    .where(eq(cycleHistory.farmerId, activeCycle.farmerId))
                    .orderBy(desc(cycleHistory.endDate));

                const otherActiveCycles = await ctx.db.select().from(cycles)
                    .where(and(
                        eq(cycles.farmerId, activeCycle.farmerId),
                        ne(cycles.id, activeCycle.id),
                        eq(cycles.status, "active")
                    ))
                    .orderBy(desc(cycles.createdAt));

                const combinedHistory = [
                    ...otherActiveCycles.map(c => ({
                        ...c,
                        cycleName: c.name,
                        finalIntake: c.intake,
                        startDate: c.createdAt,
                        endDate: null,
                        status: 'active' as const
                    })),
                    ...history.map(h => ({ ...h, status: 'archived' as const }))
                ];

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
                    history: combinedHistory,
                    farmerContext: { mainStock: activeCycle.farmer.mainStock, name: activeCycle.farmer.name }
                };
            }

            const historyRecord = await ctx.db.query.cycleHistory.findFirst({
                where: eq(cycleHistory.id, input.id),
                with: { farmer: true }
            });

            if (!historyRecord) throw new TRPCError({ code: "NOT_FOUND" });

            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, historyRecord.organizationId!), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const logs = await ctx.db.select().from(cycleLogs)
                .where(eq(cycleLogs.historyId, historyRecord.id))
                .orderBy(desc(cycleLogs.createdAt));

            const otherHistory = await ctx.db.select().from(cycleHistory)
                .where(and(eq(cycleHistory.farmerId, historyRecord.farmerId), ne(cycleHistory.id, historyRecord.id)))
                .orderBy(desc(cycleHistory.endDate));

            const activeCycles = await ctx.db.select().from(cycles)
                .where(and(
                    eq(cycles.farmerId, historyRecord.farmerId),
                    eq(cycles.status, "active")
                ))
                .orderBy(desc(cycles.createdAt));

            const combinedHistory = [
                ...activeCycles.map(c => ({
                    ...c,
                    cycleName: c.name,
                    finalIntake: c.intake,
                    startDate: c.createdAt,
                    endDate: null,
                    status: 'active' as const
                })),
                ...otherHistory.map(h => ({ ...h, status: 'archived' as const }))
            ];

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
                history: combinedHistory,
                farmerContext: { mainStock: historyRecord.farmer.mainStock, name: historyRecord.farmer.name }
            };
        }),

    listPast: managementProcedure
        .input(cycleSearchSchema)
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, orgId, farmerId } = input;

            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const users = aliasedTable(user, "officer");
            const offset = (page - 1) * pageSize;
            const whereClause = and(
                eq(cycleHistory.organizationId, orgId),
                farmerId ? eq(cycleHistory.farmerId, farmerId) : undefined,
                search ? or(
                    ilike(cycleHistory.cycleName, `%${search}%`),
                    ilike(farmer.name, `%${search}%`),
                    ilike(users.name, `%${search}%`)
                ) : undefined
            );

            const data = await ctx.db.select({
                history: cycleHistory,
                farmerName: farmer.name,
                farmerMainStock: farmer.mainStock,
                officerName: users.name
            })
                .from(cycleHistory)
                .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
                .leftJoin(users, eq(farmer.officerId, users.id))
                .where(whereClause)
                .orderBy(desc(cycleHistory.endDate))
                .limit(pageSize)
                .offset(offset);

            const [total] = await ctx.db.select({ count: count() })
                .from(cycleHistory)
                .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
                .leftJoin(users, eq(farmer.officerId, users.id))
                .where(whereClause);

            return {
                items: data.map(d => ({
                    id: d.history.id,
                    name: d.history.cycleName,
                    farmerId: d.history.farmerId,
                    organizationId: d.history.organizationId || null,
                    doc: d.history.doc,
                    age: d.history.age,
                    intake: d.history.finalIntake,
                    mortality: d.history.mortality,
                    status: 'archived' as const,
                    createdAt: d.history.startDate,
                    updatedAt: d.history.endDate || d.history.startDate,
                    farmerName: d.farmerName,
                    farmerMainStock: d.farmerMainStock,
                    officerName: d.officerName || null,
                    endDate: d.history.endDate
                })),
                total: total.count,
                totalPages: Math.ceil(total.count / pageSize)
            };
        }),
});
