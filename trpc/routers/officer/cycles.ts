import { cycleHistory, cycleLogs, cycles, farmer, stockLogs } from "@/db/schema";
import { updateCycleFeed } from "@/modules/cycles/server/services/feed-service";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, ilike, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";

const officerProcedure = protectedProcedure;

const cycleSearchSchema = z.object({
    search: z.string().optional(),
    page: z.number().default(1),
    pageSize: z.number().default(10),
    orgId: z.string(),
    farmerId: z.string().optional(),
    sortBy: z.enum(["name", "age", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const officerCyclesRouter = createTRPCRouter({
    listActive: officerProcedure
        .input(cycleSearchSchema)
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, orgId, farmerId, sortBy, sortOrder } = input;
            const offset = (page - 1) * pageSize;

            let orderByClause = desc(cycles.createdAt);
            if (sortBy === "name") orderByClause = sortOrder === "asc" ? asc(cycles.name) : desc(cycles.name);
            if (sortBy === "age") orderByClause = sortOrder === "asc" ? asc(cycles.age) : desc(cycles.age);

            const whereClause = and(
                eq(cycles.organizationId, orgId),
                eq(cycles.status, "active"),
                eq(farmer.officerId, ctx.user.id),
                farmerId ? eq(cycles.farmerId, farmerId) : undefined,
                search ? ilike(cycles.name, `%${search}%`) : undefined,
            );

            const data = await ctx.db.select({
                cycle: cycles,
                farmerName: farmer.name,
                farmerMainStock: farmer.mainStock,
            })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(whereClause)
                .orderBy(orderByClause)
                .limit(pageSize)
                .offset(offset);

            const [total] = await ctx.db.select({ count: count() })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(whereClause);

            return {
                items: data.map(d => ({ ...d.cycle, farmerName: d.farmerName, farmerMainStock: d.farmerMainStock })),
                total: total.count,
                totalPages: Math.ceil(total.count / pageSize)
            };
        }),

    listPast: officerProcedure
        .input(cycleSearchSchema)
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, orgId } = input;
            const offset = (page - 1) * pageSize;

            const whereClause = and(
                eq(cycleHistory.organizationId, orgId),
                eq(farmer.officerId, ctx.user.id),
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
                .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
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

    create: officerProcedure
        .input(z.object({
            name: z.string().min(1),
            farmerId: z.string(),
            orgId: z.string(),
            doc: z.number().int().positive(),
            age: z.number().int().default(0),
        }))
        .mutation(async ({ input, ctx }) => {
            const [newCycle] = await ctx.db.insert(cycles).values({
                name: input.name,
                farmerId: input.farmerId,
                organizationId: input.orgId,
                doc: input.doc,
                age: input.age,
                createdAt: input.age > 1
                    ? new Date(new Date().setDate(new Date().getDate() - (input.age - 1)))
                    : new Date()
            }).returning();

            await ctx.db.insert(cycleLogs).values({
                cycleId: newCycle.id,
                userId: ctx.user.id,
                type: "NOTE",
                valueChange: 0,
                note: `Cycle started. Initial Age: ${input.age}, Birds: ${input.doc}`
            });

            await updateCycleFeed(newCycle, ctx.user.id, true);
            return newCycle;
        }),

    getDetails: officerProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch by ID only, including the farmer relation for owner verification
            const activeCycle = await ctx.db.query.cycles.findFirst({
                where: eq(cycles.id, input.id),
                with: { farmer: true }
            });

            if (activeCycle) {
                // Verify ownership: Record must belong to a farmer managed by this officer
                if (activeCycle.farmer.officerId !== ctx.user.id) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "You do not have permission to view this cycle's details."
                    });
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

            // Verify ownership for history record as well
            if (historyRecord.farmer.officerId !== ctx.user.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You do not have permission to view this history record."
                });
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

    end: officerProcedure
        .input(z.object({
            id: z.string(),
            intake: z.number().positive(),
        }))
        .mutation(async ({ input, ctx }) => {
            return await ctx.db.transaction(async (tx) => {
                const [activeCycle] = await tx.select().from(cycles).where(eq(cycles.id, input.id));
                if (!activeCycle) throw new TRPCError({ code: "NOT_FOUND" });

                const [history] = await tx.insert(cycleHistory).values({
                    cycleName: activeCycle.name,
                    farmerId: activeCycle.farmerId,
                    organizationId: activeCycle.organizationId,
                    doc: activeCycle.doc,
                    finalIntake: input.intake || 0,
                    mortality: activeCycle.mortality,
                    age: activeCycle.age,
                    startDate: activeCycle.createdAt,
                    endDate: new Date(),
                    status: "archived"
                }).returning();

                await tx.update(cycleLogs)
                    .set({ historyId: history.id, cycleId: null })
                    .where(eq(cycleLogs.cycleId, activeCycle.id));

                await tx.insert(cycleLogs).values({
                    historyId: history.id,
                    userId: ctx.user.id,
                    type: "NOTE",
                    valueChange: 0,
                    note: `Cycle Ended. Total Consumption: ${(input.intake || 0).toFixed(2)} bags.`
                });

                await tx.update(farmer).set({
                    updatedAt: new Date(),
                    mainStock: sql`${farmer.mainStock} - ${input.intake || 0}`,
                    totalConsumed: sql`${farmer.totalConsumed} + ${input.intake || 0}`
                }).where(eq(farmer.id, activeCycle.farmerId));

                if (input.intake > 0) {
                    await tx.insert(stockLogs).values({
                        farmerId: activeCycle.farmerId,
                        amount: (-input.intake).toString(),
                        type: "CYCLE_CLOSE",
                        referenceId: history.id,
                        note: `Cycle "${activeCycle.name}" Ended. Consumed: ${input.intake} bags.`
                    });
                }

                await tx.delete(cycles).where(eq(cycles.id, input.id));
                return { success: true };
            });
        }),

    addMortality: officerProcedure
        .input(z.object({
            id: z.string(),
            amount: z.number().int().positive(),
            reason: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const [current] = await ctx.db.select().from(cycles).where(eq(cycles.id, input.id));
            if (!current) throw new TRPCError({ code: "NOT_FOUND" });

            const [updated] = await ctx.db.update(cycles)
                .set({
                    mortality: sql`${cycles.mortality} + ${input.amount}`,
                    updatedAt: new Date(),
                })
                .where(eq(cycles.id, input.id))
                .returning();

            await ctx.db.insert(cycleLogs).values({
                cycleId: input.id,
                userId: ctx.user.id,
                type: "MORTALITY",
                valueChange: input.amount,
                previousValue: current.mortality,
                newValue: current.mortality + input.amount,
                note: input.reason || "Reported Death"
            });

            return updated;
        }),

    syncFeed: officerProcedure.mutation(async ({ ctx }) => {
        const activeCycles = await ctx.db.query.cycles.findMany({
            where: and(eq(cycles.status, "active"), eq(farmer.officerId, ctx.user.id)),
            with: { farmer: true } // Need this for the link in updateCycleFeed usually, though helper might fetch it
        });

        const results = await Promise.all(
            activeCycles.map(cycle => updateCycleFeed(cycle, ctx.user.id))
        );

        return {
            success: true,
            updatedCount: results.filter(r => r !== null).length,
        };
    }),

    deleteHistory: officerProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Check if this record belongs to one of this officer's farmers
            const record = await ctx.db.query.cycleHistory.findFirst({
                where: eq(cycleHistory.id, input.id),
                with: { farmer: true }
            });

            if (!record) throw new TRPCError({ code: "NOT_FOUND" });
            if (record.farmer.officerId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

            await ctx.db.delete(cycleHistory).where(eq(cycleHistory.id, input.id));
            return { success: true };
        }),
});
