import { cycleHistory, cycleLogs, cycles, farmer, member, stockLogs } from "@/db/schema";
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
                    endDate: null as Date | null
                })),
                total: total.count,
                totalPages: Math.ceil(total.count / pageSize)
            };
        }),

    listPast: officerProcedure
        .input(cycleSearchSchema)
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, orgId, farmerId } = input;
            const offset = (page - 1) * pageSize;

            const whereClause = and(
                eq(cycleHistory.organizationId, orgId),
                eq(farmer.officerId, ctx.user.id),
                farmerId ? eq(cycleHistory.farmerId, farmerId) : undefined,
                search ? ilike(cycleHistory.cycleName, `%${search}%`) : undefined
            );

            const data = await ctx.db.select({
                history: cycleHistory,
                farmerName: farmer.name,
                farmerMainStock: farmer.mainStock
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
                    endDate: d.history.endDate
                })),
                total: total.count,
                totalPages: Math.ceil(total.count / pageSize)
            };
        }),

    create: officerProcedure
        .input(z.object({
            name: z.string().min(1).max(100),
            farmerId: z.string(),
            orgId: z.string(),
            doc: z.number().int().positive().max(200000, "Maximum 200,000 birds allowed per cycle"),
            age: z.number().int().min(0).max(30, "Maximum age is 30 days for new cycles").default(0),
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
                type: "SYSTEM",
                valueChange: 0,
                note: `Cycle started. Initial Age: ${input.age}, Birds: ${input.doc}`
            });

            await updateCycleFeed(newCycle, ctx.user.id, true);

            // NOTIFICATION: New Cycle
            try {
                const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                // Fetch farmer details for the message
                const farmerData = await ctx.db.query.farmer.findFirst({
                    where: eq(farmer.id, input.farmerId),
                    columns: { name: true }
                });

                await NotificationService.sendToOrgManagers({
                    organizationId: input.orgId,
                    title: "New Cycle Started",
                    message: `Officer ${ctx.user.name} started a new cycle for farmer "${farmerData?.name}"`,
                    details: `Cycle: ${newCycle.name}, DOC: ${newCycle.doc}`,
                    type: "INFO",
                    link: `/management/cycles/${newCycle.id}`, // Managers see this via management route presumably or we handle redirects
                    metadata: { cycleId: newCycle.id, farmerId: input.farmerId, actorId: ctx.user.id }
                });
            } catch (e) {
                console.error("Failed to send notification for cycle creation", e);
            }

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

                    farmerContext: { id: activeCycle.farmer.id, mainStock: activeCycle.farmer.mainStock, name: activeCycle.farmer.name, organizationId: activeCycle.farmer.organizationId }
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
                farmerContext: { id: historyRecord.farmer.id, mainStock: historyRecord.farmer.mainStock, name: historyRecord.farmer.name, organizationId: historyRecord.farmer.organizationId }
            };
        }),

    end: officerProcedure
        .input(z.object({
            id: z.string(),
            intake: z.number().nonnegative(), // Removed .positive() to allow ending with 0 if needed, though strictly positive usually makes sense for consumption. But user said "end cycle intake" logic check.
        }))
        .mutation(async ({ input, ctx }) => {
            return await ctx.db.transaction(async (tx) => {
                const [activeCycle] = await tx.select().from(cycles).where(eq(cycles.id, input.id));
                if (!activeCycle) throw new TRPCError({ code: "NOT_FOUND" });

                // LOGIC CHECK: Ensure intake does not exceed farmer's stock
                const farmerData = await tx.query.farmer.findFirst({
                    where: eq(farmer.id, activeCycle.farmerId)
                });
                if (!farmerData) throw new TRPCError({ code: "NOT_FOUND", message: "Farmer not found." });

                if ((input.intake || 0) > farmerData.mainStock) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Cannot consume ${input.intake} bags. Only ${farmerData.mainStock} bags available in stock.`
                    });
                }

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
                    type: "SYSTEM",
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

                // NOTIFICATION: Cycle Ended
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: activeCycle.organizationId,
                        title: "Cycle Ended",
                        message: `Officer ${ctx.user.name} ended cycle "${activeCycle.name}" for farmer "${farmerData.name}"`,
                        details: `Final Consumption: ${input.intake || 0} bags`,
                        type: "WARNING", // Using WARNING to grab attention as this affects stock
                        link: `/management/cycles/${history.id}`, // Linking to history view
                        metadata: { historyId: history.id, farmerId: activeCycle.farmerId, actorId: ctx.user.id }
                    });
                } catch (e) {
                    console.error("Failed to send notification for cycle end", e);
                }

                return { success: true };
            });
        }),

    addMortality: officerProcedure
        .input(z.object({
            id: z.string(),
            amount: z.number().int().positive().max(200000, "Sanity check failed: limit is 200k"),
            reason: z.string().max(500).optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const [current] = await ctx.db.select().from(cycles).where(eq(cycles.id, input.id));
            if (!current) throw new TRPCError({ code: "NOT_FOUND" });

            // LOGIC CHECK: New mortality + existing mortality should not exceed DOC
            if ((current.mortality + input.amount) > current.doc) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Invalid mortality. Total dead (${current.mortality + input.amount}) cannot exceed initial birds (${current.doc}).`
                });
            }

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

            // NOTIFICATION: Mortality Added
            try {
                const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                const farmerData = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, current.farmerId) });
                await NotificationService.sendToOrgManagers({
                    organizationId: current.organizationId,
                    title: "Mortality Reported",
                    message: `Officer ${ctx.user.name} reported ${input.amount} dead birds for cycle "${current.name}" (${farmerData?.name || 'Unknown Farmer'}).`,
                    type: "WARNING",
                    link: `/management/cycles/${current.id}`
                });
            } catch (e) {
                console.error("Failed to send mortality notification", e);
            }

            return updated;
        }),

    syncFeed: officerProcedure.mutation(async ({ ctx }) => {
        const activeCyclesData = await ctx.db.select({
            cycle: cycles,
        })
            .from(cycles)
            .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
            .where(and(eq(cycles.status, "active"), eq(farmer.officerId, ctx.user.id)));

        const results = await Promise.all(
            activeCyclesData.map(d => updateCycleFeed(d.cycle, ctx.user.id))
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
            await ctx.db.delete(cycleHistory).where(eq(cycleHistory.id, input.id));
            return { success: true };
        }),

    // REOPEN CYCLE (Undo End Cycle)
    reopenCycle: officerProcedure
        .input(z.object({ historyId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                // 1. Fetch History Record
                const historyRecord = await tx.query.cycleHistory.findFirst({
                    where: eq(cycleHistory.id, input.historyId),
                    with: { farmer: true }
                });

                if (!historyRecord) throw new TRPCError({ code: "NOT_FOUND" });

                // Access Check: Officer, Manager, or Admin
                if (ctx.user.globalRole !== "ADMIN" && historyRecord.farmer.officerId !== ctx.user.id) {
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, historyRecord.organizationId!),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
                }

                // 2. Move back to Cycles (Active)
                const [restoredCycle] = await tx.insert(cycles).values({
                    id: crypto.randomUUID(), // New ID or keep old? New is safer to avoid conflicts if ID reused ideally, but let's just make new.
                    name: historyRecord.cycleName,
                    farmerId: historyRecord.farmerId,
                    organizationId: historyRecord.organizationId!,
                    doc: historyRecord.doc,
                    age: historyRecord.age,
                    mortality: historyRecord.mortality,
                    intake: historyRecord.finalIntake,
                    status: "active",
                    createdAt: historyRecord.startDate,
                    updatedAt: new Date(),
                }).returning();

                // 3. Re-link Logs
                await tx.update(cycleLogs)
                    .set({ cycleId: restoredCycle.id, historyId: null })
                    .where(eq(cycleLogs.historyId, input.historyId));

                // 4. Revert Feed Consumption from Stock (Add back)
                // The cycle turned 'active' implies the feed it consumed is still "consumed" by the cycle,
                // BUT 'End Cycle' event usually deducts from mainStock.
                // Wait, 'End Cycle' logic in 'end' procedure:
                // await tx.update(farmer).set({ mainStock: mainStock - intake, totalConsumed: totalConsumed + intake })
                // So we must REVERSE this deduction.

                const amountToRestore = historyRecord.finalIntake;

                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${amountToRestore}`,
                        totalConsumed: sql`${farmer.totalConsumed} - ${amountToRestore}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, historyRecord.farmerId));

                // 5. Log the Stock Correction
                if (amountToRestore > 0) {
                    await tx.insert(stockLogs).values({
                        farmerId: historyRecord.farmerId,
                        amount: amountToRestore.toString(),
                        type: "CORRECTION",
                        note: `Cycle "${historyRecord.cycleName}" Reopened. Restored ${amountToRestore} bags.`,
                    });
                }

                // 6. Delete History Record
                await tx.delete(cycleHistory).where(eq(cycleHistory.id, input.historyId));

                // 7. Force Intake Recalculation for Reopened Cycle
                await updateCycleFeed(
                    restoredCycle,
                    ctx.user.id,
                    true,
                    tx,
                    `Cycle "${historyRecord.cycleName}" Reopened. Triggered feed intake recalculation.`
                );

                // 8. Log the Reopen Event
                await tx.insert(cycleLogs).values({
                    cycleId: restoredCycle.id,
                    userId: ctx.user.id,
                    type: "SYSTEM",
                    valueChange: 0,
                    note: `Cycle Reopened: "${historyRecord.cycleName}" was moved back from archive.`,
                });

                // 9. NOTIFICATION
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: historyRecord.organizationId!,
                        title: "Cycle Reopened",
                        message: `Officer ${ctx.user.name} reopened cycle "${historyRecord.cycleName}" for farmer "${historyRecord.farmer.name}".`,
                        type: "UPDATE",
                        link: `/management/cycles/${restoredCycle.id}`
                    });
                } catch (e) {
                    console.error("Failed to send cycle reopen notification", e);
                }

                return { success: true, cycleId: restoredCycle.id };
            });
        }),

    // REVERT MORTALITY (Undo Mortality Log)
    revertCycleLog: officerProcedure
        .input(z.object({ logId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                const [log] = await tx.select().from(cycleLogs).where(eq(cycleLogs.id, input.logId));
                if (!log) throw new TRPCError({ code: "NOT_FOUND" });
                if (log.type !== "MORTALITY") throw new TRPCError({ code: "BAD_REQUEST", message: "Only mortality logs can be reverted here." });

                // Verify Ownership via Cycle (Active)
                let cycleId = log.cycleId;
                if (!cycleId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot revert logs for archived cycles directly. Reopen the cycle first." });

                const [activeCycle] = await tx.select().from(cycles).where(eq(cycles.id, cycleId));
                if (!activeCycle) throw new TRPCError({ code: "NOT_FOUND", message: "Active cycle not found." });

                // Check Access
                const farmerData = await tx.query.farmer.findFirst({
                    where: eq(farmer.id, activeCycle.farmerId)
                });

                if (!farmerData) throw new TRPCError({ code: "NOT_FOUND" });

                if (ctx.user.globalRole !== "ADMIN" && farmerData.officerId !== ctx.user.id) {
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, farmerData.organizationId),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
                }

                // Update Cycle Mortality
                const revertAmount = log.valueChange; // This was +Amount

                await tx.update(cycles)
                    .set({
                        mortality: sql`${cycles.mortality} - ${revertAmount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(cycles.id, cycleId));

                // Create Correction Log
                await tx.insert(cycleLogs).values({
                    cycleId: cycleId,
                    userId: ctx.user.id,
                    type: "CORRECTION",
                    valueChange: -revertAmount,
                    note: `Reverted Mortality: Previously reported ${revertAmount} birds.`,
                    previousValue: activeCycle.mortality,
                    newValue: (activeCycle.mortality || 0) - revertAmount
                });

                // Trigger Intake Recalculation (Refetch to get updated mortality)
                const [updatedCycle] = await tx.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
                if (updatedCycle) {
                    await updateCycleFeed(
                        updatedCycle,
                        ctx.user.id,
                        true,
                        tx,
                        `Mortality Reverted. Recalculated intake based on updated live bird count.`
                    );
                }

                return { success: true };
            });
        }),

    // CORRECT DOC (Edit Initial Birds)
    correctDoc: officerProcedure
        .input(z.object({
            cycleId: z.string(),
            newDoc: z.number().int().positive().max(200000, "Maximum 200,000 birds"),
            reason: z.string().min(3).max(500)
        }))
        .mutation(async ({ ctx, input }) => {
            // console.log(`[correctDoc] Starting for cycleId: ${input.cycleId}, newDoc: ${input.newDoc}`);
            return await ctx.db.transaction(async (tx) => {
                // 1. Fetch Cycle
                const [cycle] = await tx.select().from(cycles).where(eq(cycles.id, input.cycleId)).limit(1);
                if (!cycle) {
                    console.error(`[correctDoc] Cycle not found: ${input.cycleId}`);
                    throw new TRPCError({ code: "NOT_FOUND" });
                }

                // 2. Access Check
                const farmerData = await tx.query.farmer.findFirst({
                    where: eq(farmer.id, cycle.farmerId)
                });

                if (!farmerData) throw new TRPCError({ code: "NOT_FOUND" });

                if (ctx.user.globalRole !== "ADMIN" && farmerData.officerId !== ctx.user.id) {
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, farmerData.organizationId),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
                }

                const oldDoc = cycle.doc;
                if (oldDoc === input.newDoc) return { success: true, message: "No change" };

                // console.log(`[correctDoc] Updating doc from ${oldDoc} to ${input.newDoc}`);

                // 3. Update Cycle
                const [updatedCycle] = await tx.update(cycles)
                    .set({
                        doc: input.newDoc,
                        updatedAt: new Date()
                    })
                    .where(eq(cycles.id, input.cycleId))
                    .returning();

                // 4. Recalculate Intake based on NEW DOC
                if (updatedCycle) {
                    await updateCycleFeed(
                        updatedCycle,
                        ctx.user.id,
                        true,
                        tx,
                        `DOC Corrected from ${oldDoc} to ${input.newDoc}. Reason: ${input.reason}`
                    );
                }

                // 5. Log Correction
                await tx.insert(cycleLogs).values({
                    cycleId: input.cycleId,
                    userId: ctx.user.id,
                    type: "CORRECTION",
                    valueChange: input.newDoc - (oldDoc || 0),
                    previousValue: oldDoc,
                    newValue: input.newDoc,
                    note: `DOC Correction: ${input.reason}`
                });

                // NOTIFICATION: DOC Corrected
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    const farmerData = await tx.query.farmer.findFirst({ where: eq(farmer.id, cycle.farmerId) });
                    await NotificationService.sendToOrgManagers({
                        organizationId: cycle.organizationId!,
                        title: "DOC Corrected",
                        message: `Officer ${ctx.user.name} corrected initial birds (DOC) for cycle "${cycle.name}" (${farmerData?.name}). From ${cycle.doc} to ${input.newDoc}.`,
                        type: "CRITICAL",
                        link: `/management/cycles/${cycle.id}`
                    });
                } catch (e) {
                    console.error("Failed to send DOC correction notification", e);
                }

                // console.log(`[correctDoc] Successfully completed.`);
                return { success: true };
            });
        }),

    editMortalityLog: officerProcedure
        .input(z.object({
            logId: z.string(),
            newAmount: z.number().int().positive().max(200000),
            reason: z.string().max(500).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                const [log] = await tx.select().from(cycleLogs).where(eq(cycleLogs.id, input.logId));
                if (!log) throw new TRPCError({ code: "NOT_FOUND" });
                if (log.type !== "MORTALITY") throw new TRPCError({ code: "BAD_REQUEST", message: "Only mortality logs can be edited here." });

                let cycleId = log.cycleId;
                if (!cycleId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit logs for archived cycles directly." });

                const [currentCycle] = await tx.select().from(cycles).where(eq(cycles.id, cycleId));
                if (!currentCycle) throw new TRPCError({ code: "NOT_FOUND" });

                // Check Access
                const farmerData = await tx.query.farmer.findFirst({ where: eq(farmer.id, currentCycle.farmerId) });
                if (!farmerData) throw new TRPCError({ code: "NOT_FOUND" });

                if (ctx.user.globalRole !== "ADMIN" && farmerData.officerId !== ctx.user.id) {
                    // Check membership for manager logic if needed, reusing logic from other procedures
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, farmerData.organizationId),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
                }

                const oldMortality = log.valueChange || 0;
                const doc = currentCycle.doc || 0;
                const currentTotalMortality = currentCycle.mortality || 0;

                // Validate new total
                // If we change this log from oldMortality to newAmount, the total changes by (newAmount - oldMortality)
                const diff = input.newAmount - oldMortality;
                const newTotal = currentTotalMortality + diff;

                if (newTotal > doc) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `New total mortality (${newTotal}) would exceed initial birds (${doc}).`
                    });
                }
                if (newTotal < 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `New total mortality cannot be negative.`
                    });
                }

                // Update Log
                await tx.update(cycleLogs)
                    .set({
                        valueChange: input.newAmount,
                        note: input.reason ? `Correction: ${input.reason}` : log.note,
                        newValue: input.newAmount
                    })
                    .where(eq(cycleLogs.id, input.logId));

                // Update Cycle
                const [updatedCycle] = await tx.update(cycles)
                    .set({
                        mortality: newTotal,
                        updatedAt: new Date()
                    })
                    .where(eq(cycles.id, cycleId))
                    .returning();

                // Recalculate Feed
                if (updatedCycle) {
                    await updateCycleFeed(
                        updatedCycle,
                        ctx.user.id,
                        true,
                        tx,
                        `Mortality Log Edited from ${oldMortality} to ${input.newAmount}`
                    );
                }

                // NOTIFICATION: Mortality Log Edited
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: currentCycle.organizationId!,
                        title: "Mortality Entry Edited",
                        message: `Officer ${ctx.user.name} edited a mortality log for cycle "${currentCycle.name}". Amount changed from ${oldMortality} to ${input.newAmount}.`,
                        type: "UPDATE",
                        link: `/management/cycles/${currentCycle.id}`
                    });
                } catch (e) {
                    console.error("Failed to send mortality edit notification", e);
                }

                return { success: true };
            });
        }),

    correctMortality: officerProcedure
        .input(z.object({
            cycleId: z.string(),
            newTotalMortality: z.number().int().min(0),
            reason: z.string().min(3)
        }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                // 1. Fetch Cycle
                const [cycle] = await tx.select().from(cycles).where(eq(cycles.id, input.cycleId)).limit(1);
                if (!cycle) {
                    throw new TRPCError({ code: "NOT_FOUND" });
                }

                // 2. Access Check
                const farmerData = await tx.query.farmer.findFirst({
                    where: eq(farmer.id, cycle.farmerId)
                });

                if (!farmerData) throw new TRPCError({ code: "NOT_FOUND" });

                if (ctx.user.globalRole !== "ADMIN" && farmerData.officerId !== ctx.user.id) {
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, farmerData.organizationId),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
                }

                const oldTotalMortality = cycle.mortality || 0;
                const doc = cycle.doc || 0;

                if (input.newTotalMortality > doc) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `New total mortality (${input.newTotalMortality}) cannot exceed initial birds (${doc}).`
                    });
                }

                if (oldTotalMortality === input.newTotalMortality) return { success: true, message: "No change" };

                // 3. Update Cycle
                const [updatedCycle] = await tx.update(cycles)
                    .set({
                        mortality: input.newTotalMortality,
                        updatedAt: new Date()
                    })
                    .where(eq(cycles.id, input.cycleId))
                    .returning();

                // 4. Recalculate Feed
                if (updatedCycle) {
                    await updateCycleFeed(
                        updatedCycle,
                        ctx.user.id,
                        true,
                        tx,
                        `Mortality Corrected from ${oldTotalMortality} to ${input.newTotalMortality}. Reason: ${input.reason}`
                    );
                }

                // 5. Log Correction
                await tx.insert(cycleLogs).values({
                    cycleId: input.cycleId,
                    userId: ctx.user.id,
                    type: "CORRECTION",
                    valueChange: input.newTotalMortality - oldTotalMortality,
                    previousValue: oldTotalMortality,
                    newValue: input.newTotalMortality,
                    note: `Mortality Correction: ${input.reason}`
                });

                // NOTIFICATION: Mortality Corrected
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: cycle.organizationId!,
                        title: "Mortality Corrected",
                        message: `Officer ${ctx.user.name} corrected total mortality for cycle "${cycle.name}". From ${oldTotalMortality} to ${input.newTotalMortality}. Reason: ${input.reason}`,
                        type: "UPDATE",
                        link: `/management/cycles/${cycle.id}`
                    });
                } catch (e) {
                    console.error("Failed to send mortality correction notification", e);
                }

                return { success: true };
            });
        }),

});
