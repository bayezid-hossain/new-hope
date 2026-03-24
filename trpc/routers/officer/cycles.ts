import { cycleHistory, cycleLogs, cycles, farmer, member, saleEvents, saleMetrics, saleReports, stockLogs } from "@/db/schema";
import { updateCycleFeed } from "@/modules/cycles/server/services/feed-service";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, ilike, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, proProcedure, protectedProcedure } from "../../init";

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
                eq(farmer.status, "active"),
                farmerId ? eq(cycles.farmerId, farmerId) : undefined,
                search ? ilike(cycles.name, `%${search}%`) : undefined,
            );

            const data = await ctx.db.select({
                cycle: cycles,
                farmerName: farmer.name,
                farmerLocation: farmer.location,
                farmerMobile: farmer.mobile,
                farmerMainStock: farmer.mainStock,
                farmerProblematicFeed: farmer.problematicFeed,
                farmerUpdatedAt: farmer.updatedAt,
            })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(whereClause)
                .orderBy(orderByClause)
                .limit(pageSize)
                .offset(offset);

            // Fetch latest stock log date per farmer to use as "Last Updated"
            const farmerIds = [...new Set(data.map(d => d.cycle.farmerId))];
            let stockDatesMap = new Map<string, Date>();

            if (farmerIds.length > 0) {
                const latestLogs = await ctx.db.select({
                    farmerId: stockLogs.farmerId,
                    latestDate: sql<Date>`max(${stockLogs.createdAt})`
                })
                    .from(stockLogs)
                    .where(sql`${stockLogs.farmerId} IN ${farmerIds}`)
                    .groupBy(stockLogs.farmerId);

                latestLogs.forEach(log => {
                    if (log.farmerId) stockDatesMap.set(log.farmerId, log.latestDate);
                });
            }

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
                    farmerLocation: d.farmerLocation,
                    farmerMobile: d.farmerMobile,
                    farmerMainStock: d.farmerMainStock,
                    farmerProblematicFeed: d.farmerProblematicFeed,
                    farmerUpdatedAt: d.farmerUpdatedAt,
                    mainStockUpdatedAt: stockDatesMap.get(d.cycle.farmerId),
                    birdsSold: d.cycle.birdsSold,
                    birdType: d.cycle.birdType,
                    officialInputDate: d.cycle.officialInputDate,
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
                eq(farmer.status, "active"),
                ne(cycleHistory.status, "deleted"),
                farmerId ? eq(cycleHistory.farmerId, farmerId) : undefined,
                search ? ilike(cycleHistory.cycleName, `%${search}%`) : undefined
            );

            const data = await ctx.db.select({
                history: cycleHistory,
                farmerName: farmer.name,
                farmerLocation: farmer.location,
                farmerMobile: farmer.mobile,
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
                    farmerLocation: d.farmerLocation,
                    farmerMobile: d.farmerMobile,
                    farmerMainStock: d.farmerMainStock,
                    birdsSold: d.history.birdsSold,
                    birdType: d.history.birdType,
                    officialInputDate: d.history.officialInputDate,
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
            age: z.number().int().min(0).max(40, "Maximum age is 40 days for new cycles").default(0),
            birdType: z.string().optional(),
            officialInputDate: z.string().optional(),
        }))
        .mutation(async ({ input, ctx }) => {
            const farmerData = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.farmerId), eq(farmer.status, "active"))
            });
            console.log(input)
            if (!farmerData) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Cannot create cycle for an archived or non-existent farmer."
                });
            }

            // SECURITY CHECK: Verify ownership
            if (farmerData.officerId !== ctx.user.id) {
                // Allow if Admin or Owner/Manager with permissions? 
                // Currently strict ownership usually implies Officer assignment.
                // But if Manager is acting as officer, they must be assigned?
                // For now, keep strict ownership check, but ALSO check Manager permissions if they ARE the assigned officer (e.g. self-assigned)

                // Whatever the ownership logic, if they ARE a manager, check VIEW mode.
                // We need to fetch membership to be sure of role/accessLevel
            }

            // ACCESS LEVEL CHECK
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, farmerData.organizationId)
                    )
                });

                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot create cycles." });
                }
            }

            if (farmerData.officerId !== ctx.user.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You do not have permission to create cycles for this farmer."
                });
            }

            const [newCycle] = await ctx.db.insert(cycles).values({
                name: input.name,
                farmerId: input.farmerId,
                organizationId: farmerData.organizationId, // STRICT: Use farmer's org, ignore input.orgId
                doc: input.doc,
                age: input.age,
                birdType: input.birdType,
                officialInputDate: input.officialInputDate ? new Date(input.officialInputDate) : null,
                createdAt: input.age > 1
                    ? new Date(new Date().setDate(new Date().getDate() - (input.age - 1)))
                    : new Date()
            }).returning();

            await ctx.db.insert(cycleLogs).values({
                cycleId: newCycle.id,
                userId: ctx.user.id,
                type: "SYSTEM",
                valueChange: 0,
                note: `Cycle started. Initial Age: ${input.age}, Birds: ${input.doc}${input.birdType ? `, Type: ${input.birdType}` : ""}`
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

    createBulk: proProcedure
        .input(z.object({
            orgId: z.string(),
            cycles: z.array(z.object({
                farmerId: z.string(),
                doc: z.number().int().positive(),
                age: z.number().int().min(0).max(40).default(0),
                birdType: z.string().optional(),
                startDate: z.date().optional() // Allow explicit start date (e.g. from header)
            }))
        }))
        .mutation(async ({ input, ctx }) => {
            const results = [];
            const errors: any[] = [];

            // Pre-fetch all farmer data for validation to avoid N+1 queries
            const farmerIds = [...new Set(input.cycles.map(c => c.farmerId))];
            const farmers = await ctx.db.query.farmer.findMany({
                where: and(
                    sql`${farmer.id} IN ${farmerIds}`,
                    eq(farmer.status, "active"),
                    eq(farmer.organizationId, input.orgId)
                )
            });

            const farmersMap = new Map(farmers.map(f => [f.id, f]));

            // Access Check (Manager View Mode)
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, input.orgId)
                    )
                });
                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot create cycles." });
                }
            }

            // Loop and create
            for (const item of input.cycles) {
                const farmerData = farmersMap.get(item.farmerId);

                if (!farmerData) {
                    errors.push({ farmerId: item.farmerId, error: "Farmer not found or inactive" });
                    continue;
                }

                if (farmerData.officerId !== ctx.user.id) {
                    // For now, skip if not valid officer. 
                    // TODO: Allow admins/managers to override?
                    errors.push({ farmerId: item.farmerId, error: "Not your farmer" });
                    continue;
                }

                try {
                    // Logic to determine CreatedAt based on Age OR specific Start Date
                    let createdAt = new Date();

                    if (item.startDate) {
                        createdAt = new Date(item.startDate);
                    } else if (item.age > 0) {
                        const d = new Date();
                        d.setDate(d.getDate() - item.age);
                        createdAt = d;
                    }

                    // DATE VALIDATION: Max 40 days old, no future dates
                    const today = new Date();
                    today.setHours(23, 59, 59, 999); // Allow until end of today

                    const fortyDaysAgo = new Date();
                    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
                    fortyDaysAgo.setHours(0, 0, 0, 0);

                    if (createdAt < fortyDaysAgo) {
                        errors.push({ farmerId: item.farmerId, error: "Dates older than 40 days are not allowed" });
                        continue;
                    }

                    const [newCycle] = await ctx.db.insert(cycles).values({
                        name: farmerData.name, // Use Farmer Name as requested
                        // Better to use a standard name format or generate sequential?
                        // Let's use a simple distinct name for now.
                        farmerId: item.farmerId,
                        organizationId: input.orgId,
                        doc: item.doc,
                        age: item.age, // Initial Age
                        birdType: item.birdType,
                        createdAt: createdAt
                    }).returning();

                    await ctx.db.insert(cycleLogs).values({
                        cycleId: newCycle.id,
                        userId: ctx.user.id,
                        type: "SYSTEM",
                        valueChange: 0,
                        note: `Bulk Cycle started. Initial Age: ${item.age}, Birds: ${item.doc}, Date: ${createdAt.toLocaleDateString()}`
                    });

                    await updateCycleFeed(newCycle, ctx.user.id, true);
                    results.push(newCycle);

                } catch (err: any) {
                    errors.push({ farmerId: item.farmerId, error: err.message });
                }
            }

            return {
                created: results.length,
                errors: errors
            };
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
                // Verify ownership: Record must belong to a farmer managed by this officer, or user is a manager
                let hasPermission = false;
                if (ctx.user.globalRole === "ADMIN") {
                    hasPermission = true;
                } else if (activeCycle.farmer && activeCycle.farmer.officerId === ctx.user.id && activeCycle.farmer.status === "active") {
                    hasPermission = true;
                } else if (activeCycle.farmer) {
                    const membership = await ctx.db.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, activeCycle.farmer.organizationId)
                        )
                    });
                    if (membership && ((membership.role === "MANAGER" && membership.activeMode == "MANAGEMENT") || membership.role === "OWNER")) {
                        hasPermission = true;
                    }
                }

                if (!hasPermission) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "You do not have permission to view this cycle's details."
                    });
                }
                const [logs, history, otherActiveCycles] = await Promise.all([
                    ctx.db.select().from(cycleLogs)
                        .where(eq(cycleLogs.cycleId, activeCycle.id))
                        .orderBy(desc(cycleLogs.createdAt)),
                    ctx.db.select().from(cycleHistory)
                        .where(and(eq(cycleHistory.farmerId, activeCycle.farmerId), ne(cycleHistory.status, "deleted")))
                        .orderBy(desc(cycleHistory.endDate)),
                    ctx.db.select().from(cycles)
                        .where(and(
                            eq(cycles.farmerId, activeCycle.farmerId),
                            ne(cycles.id, activeCycle.id),
                            eq(cycles.status, "active")
                        ))
                        .orderBy(desc(cycles.createdAt))
                ]);

                const combinedHistory = [
                    ...otherActiveCycles.map(c => ({
                        ...c,
                        cycleName: c.name,
                        finalIntake: c.intake,
                        startDate: c.createdAt,
                        endDate: null,
                        status: 'active' as const
                    })),
                    ...history.map(h => ({ ...h, status: h.status as any }))
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
                        birdType: activeCycle.birdType,
                    },
                    logs,
                    history: combinedHistory,

                    farmerContext: { id: activeCycle.farmer.id, mainStock: activeCycle.farmer.mainStock, name: activeCycle.farmer.name, organizationId: activeCycle.farmer.organizationId, location: activeCycle.farmer.location, mobile: activeCycle.farmer.mobile }
                };
            }

            const historyRecord = await ctx.db.query.cycleHistory.findFirst({
                where: and(eq(cycleHistory.id, input.id), ne(cycleHistory.status, "deleted")),
                with: { farmer: true }
            });

            if (!historyRecord) throw new TRPCError({ code: "NOT_FOUND" });

            // Verify ownership for history record as well
            let hasHistoryPermission = false;
            if (ctx.user.globalRole === "ADMIN") {
                hasHistoryPermission = true;
            } else if (historyRecord.farmer && historyRecord.farmer.officerId === ctx.user.id && historyRecord.farmer.status === "active") {
                hasHistoryPermission = true;
            } else if (historyRecord.farmer) {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, historyRecord.farmer.organizationId)
                    )
                });
                if (membership && ((membership.role === "MANAGER" && membership.activeMode == "MANAGEMENT") || membership.role === "OWNER")) {
                    hasHistoryPermission = true;
                }
            }

            if (!hasHistoryPermission) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You do not have permission to view this history record."
                });
            }

            const [logs, otherHistory, activeCycles] = await Promise.all([
                ctx.db.select().from(cycleLogs)
                    .where(eq(cycleLogs.historyId, historyRecord.id))
                    .orderBy(desc(cycleLogs.createdAt)),
                ctx.db.select().from(cycleHistory)
                    .where(and(eq(cycleHistory.farmerId, historyRecord.farmerId), ne(cycleHistory.id, historyRecord.id), ne(cycleHistory.status, "deleted")))
                    .orderBy(desc(cycleHistory.endDate)),
                ctx.db.select().from(cycles)
                    .where(and(
                        eq(cycles.farmerId, historyRecord.farmerId),
                        eq(cycles.status, "active")
                    ))
                    .orderBy(desc(cycles.createdAt))
            ]);

            const combinedHistory = [
                ...activeCycles.map(c => ({
                    ...c,
                    cycleName: c.name,
                    finalIntake: c.intake,
                    startDate: c.createdAt,
                    endDate: null,
                    status: 'active' as const
                })),
                ...otherHistory.map(h => ({ ...h, status: h.status as any }))
            ];

            return {
                type: 'history' as const,
                data: {
                    ...historyRecord,
                    name: historyRecord.cycleName,
                    intake: historyRecord.finalIntake,
                    createdAt: historyRecord.startDate,
                    updatedAt: historyRecord.endDate,
                    birdType: historyRecord.birdType,
                },
                logs,
                history: combinedHistory,
                farmerContext: { id: historyRecord.farmer.id, mainStock: historyRecord.farmer.mainStock, name: historyRecord.farmer.name, organizationId: historyRecord.farmer.organizationId, location: historyRecord.farmer.location, mobile: historyRecord.farmer.mobile }
            };
        }),

    end: officerProcedure
        .input(z.object({
            id: z.string(),
            intake: z.number().nonnegative(),
        }))
        .mutation(async ({ input, ctx }) => {
            const [cycle] = await ctx.db.select().from(cycles).where(eq(cycles.id, input.id));
            if (cycle && ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, cycle.organizationId)
                    )
                });
                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot end cycles." });
                }
            }

            return await ctx.db.transaction(async (tx) => {
                const { endCycleLogic } = await import("@/modules/cycles/server/services/cycle-service");
                return await endCycleLogic(tx, input.id, input.intake, ctx.user.id, ctx.user.name);
            });
        }),

    addMortality: officerProcedure
        .input(z.object({
            id: z.string(),
            amount: z.number().int().positive().max(200000, "Sanity check failed: limit is 200k"),
            reason: z.string().max(500).optional(),
            date: z.date().optional(), // New: Allow backdating
        }))
        .mutation(async ({ input, ctx }) => {
            const [current] = await ctx.db.select().from(cycles).where(eq(cycles.id, input.id));
            if (!current) throw new TRPCError({ code: "NOT_FOUND" });

            const farmerData = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, current.farmerId), eq(farmer.status, "active"))
            });

            if (!farmerData) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: "Cannot add mortality to a cycle of an archived farmer."
                });
            }

            // ACCESS LEVEL CHECK
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, farmerData.organizationId)
                    )
                });
                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot add mortality." });
                }
            }

            // LOGIC CHECK: New mortality + existing mortality + birds sold should not exceed DOC
            const totalAccounted = current.mortality + input.amount + (current.birdsSold || 0);
            if (totalAccounted > current.doc) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Invalid mortality. Total dead/sold (${totalAccounted}) cannot exceed initial birds (${current.doc}).`
                });
            }

            if (input.date) {
                const reqTime = new Date(input.date).getTime();
                const cycleTime = new Date(current.createdAt).getTime();

                // Allow up to 24 hours buffer to handle timezone discrepancies between local midnight and UTC server time
                if (reqTime < cycleTime - 24 * 60 * 60 * 1000) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Mortality log date cannot be before cycle start date (${current.createdAt.toLocaleDateString()}).`
                    });
                }
            }

            const updated = await ctx.db.transaction(async (tx) => {
                const [result] = await tx.update(cycles)
                    .set({
                        mortality: sql`${cycles.mortality} + ${input.amount}`,
                        updatedAt: new Date(),
                    })
                    .where(eq(cycles.id, input.id))
                    .returning();

                await tx.insert(cycleLogs).values({
                    cycleId: input.id,
                    userId: ctx.user.id,
                    type: "MORTALITY",
                    valueChange: input.amount,
                    previousValue: current.mortality,
                    newValue: current.mortality + input.amount,
                    note: input.reason || "Reported Death",
                    createdAt: input.date || new Date() // Use provided date or NOW
                });

                // RECALCULATE FEED INTAKE
                await updateCycleFeed(
                    result,
                    ctx.user.id,
                    true,
                    tx,
                    `Mortality added (${input.amount} birds). Recalculated intake based on ${result.doc - result.mortality} live birds.`,
                    input.date || new Date()
                );

                // Fetch full updated cycle to return
                const [finalResult] = await tx.select().from(cycles).where(eq(cycles.id, input.id)).limit(1);
                return finalResult;
            });

            // NOTIFICATION: Mortality Added (Keep simple for now, maybe add date to msg)
            try {
                const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                const farmerData = await ctx.db.query.farmer.findFirst({
                    where: and(eq(farmer.id, current.farmerId), eq(farmer.status, "active"))
                });
                if (farmerData) {
                    await NotificationService.sendToOrgManagers({
                        organizationId: current.organizationId,
                        title: "Mortality Reported",
                        message: `Officer ${ctx.user.name} reported ${input.amount} dead birds for cycle "${current.name}" (${farmerData.name}).`,
                        type: "WARNING",
                        link: `/management/cycles/${current.id}`
                    });
                }
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
            .where(and(
                eq(cycles.status, "active"),
                eq(farmer.officerId, ctx.user.id),
                eq(farmer.status, "active")
            ));

        const results = await Promise.all(
            activeCyclesData.map(d => updateCycleFeed(d.cycle, ctx.user.id))
        );

        return {
            success: true,
            updatedCount: results.filter(r => r !== null).length,
        };
    }),

    updateOfficialInputDate: officerProcedure
        .input(z.object({
            id: z.string(),
            officialInputDate: z.date().nullable(),
        }))
        .mutation(async ({ input, ctx }) => {
            console.log(input)
            let [cycle] = await ctx.db.select().from(cycles).where(eq(cycles.id, input.id));
            if (cycle) {
                if (ctx.user.globalRole !== "ADMIN") {
                    const membership = await ctx.db.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, cycle.organizationId)
                        )
                    });
                    if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                        throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot update cycles." });
                    }
                }
                await ctx.db.update(cycles)
                    .set({ officialInputDate: input.officialInputDate, updatedAt: new Date() })
                    .where(eq(cycles.id, input.id));
                return { success: true };
            }

            const [historyCycle] = await ctx.db.select().from(cycleHistory).where(eq(cycleHistory.id, input.id));
            if (!historyCycle) throw new TRPCError({ code: "NOT_FOUND" });

            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, historyCycle.organizationId || "")
                    )
                });
                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot update cycles." });
                }
            }

            await ctx.db.update(cycleHistory)
                .set({ officialInputDate: input.officialInputDate })
                .where(eq(cycleHistory.id, input.id));

            return { success: true };
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
            if (!record.farmer || record.farmer.officerId !== ctx.user.id || record.farmer.status !== "active") {
                throw new TRPCError({ code: "FORBIDDEN", message: "Farmer not found or archived." });
            }

            // ACCESS LEVEL CHECK
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, record.organizationId!)
                    )
                });
                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot delete history." });
                }
            }

            await ctx.db.update(cycleHistory)
                .set({ status: "deleted" })
                .where(eq(cycleHistory.id, input.id));
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
                if (!historyRecord.farmer || historyRecord.farmer.status !== "active") {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "Cannot reopen cycle for an archived farmer."
                    });
                }

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

                    // Enforce Manager View Mode
                    if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                        throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot reopen cycles." });
                    }
                } else if (ctx.user.globalRole !== "ADMIN") {
                    // Even if they are the officer (owned), if they are a Manager in VIEW mode, block it.
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, historyRecord.organizationId!),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                        throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot reopen cycles." });
                    }
                }

                // 2. Move back to Cycles (Active)
                // RESET: When reopening, we reset birdsSold because we delete all sales reports.
                const [restoredCycle] = await tx.insert(cycles).values({
                    id: crypto.randomUUID(),
                    name: historyRecord.cycleName,
                    farmerId: historyRecord.farmerId,
                    organizationId: historyRecord.organizationId!,
                    doc: historyRecord.doc,
                    age: historyRecord.age,
                    mortality: historyRecord.mortality, // Note: caller must ensure double-counting is avoided if sale mortality was synced
                    birdsSold: 0, // RESET birds sold
                    intake: historyRecord.finalIntake,
                    status: "active",
                    birdType: historyRecord.birdType,
                    createdAt: historyRecord.startDate,
                    updatedAt: new Date(),
                }).returning();

                // 3. Re-link Logs
                await tx.update(cycleLogs)
                    .set({ cycleId: restoredCycle.id, historyId: null })
                    .where(eq(cycleLogs.historyId, input.historyId));

                // 4. CLEANUP: Delete all Sale Events and Reports
                // User Request: "cycle reopen, should not all the reports be deleted?"
                await tx.delete(saleEvents).where(eq(saleEvents.historyId, input.historyId));

                // 5. Revert Feed Consumption from Stock (Add back)
                const amountToRestore = historyRecord.finalIntake;

                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${amountToRestore}`,
                        totalConsumed: sql`${farmer.totalConsumed} - ${amountToRestore}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, historyRecord.farmerId));

                // 6. Log the Stock Correction
                if (amountToRestore > 0) {
                    // Re-read updated balance
                    const updatedFarmer = await tx.query.farmer.findFirst({
                        where: eq(farmer.id, historyRecord.farmerId),
                        columns: { mainStock: true }
                    });

                    await tx.insert(stockLogs).values({
                        farmerId: historyRecord.farmerId,
                        amount: amountToRestore.toString(),
                        type: "ADJUSTMENT",
                        note: `Cycle Reopened: Added back ${amountToRestore} bags from "${historyRecord.cycleName}"`,
                        balanceAfter: updatedFarmer?.mainStock?.toString() ?? null,
                    });
                }

                // 7. Delete History Record
                await tx.delete(cycleHistory).where(eq(cycleHistory.id, input.historyId));

                // 8. Force Intake Recalculation for Reopened Cycle
                await updateCycleFeed(
                    restoredCycle,
                    ctx.user.id,
                    true,
                    tx,
                    `Cycle "${historyRecord.cycleName}" Reopened. Triggered feed intake recalculation.`
                );

                // 9. Log the Reopen Event
                await tx.insert(cycleLogs).values({
                    cycleId: restoredCycle.id,
                    userId: ctx.user.id,
                    type: "SYSTEM",
                    valueChange: 0,
                    note: `Cycle Reopened: "${historyRecord.cycleName}" was moved back from archive. Sales reports were cleared.`,
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

    // UPDATE MORTALITY LOG (Edit History)
    updateMortalityLog: officerProcedure
        .input(z.object({
            logId: z.string(),
            newAmount: z.number().int().positive(),
            newDate: z.date().optional(),
            reason: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                const [log] = await tx.select().from(cycleLogs).where(eq(cycleLogs.id, input.logId));
                if (!log) throw new TRPCError({ code: "NOT_FOUND" });
                if (log.type !== "MORTALITY") throw new TRPCError({ code: "BAD_REQUEST", message: "Only mortality logs can be edited here." });
                if (log.isReverted) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit a log that has already been reverted." });
                if ((log.valueChange ?? 0) < 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit a system-generated adjustment log." });

                // Verify Ownership via Cycle (Active)
                let cycleId = log.cycleId;
                if (!cycleId) throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit logs for archived cycles directly." });

                const [activeCycle] = await tx.select().from(cycles).where(eq(cycles.id, cycleId));
                if (!activeCycle) throw new TRPCError({ code: "NOT_FOUND", message: "Active cycle not found." });

                // Check Access
                const farmerData = await tx.query.farmer.findFirst({
                    where: and(eq(farmer.id, activeCycle.farmerId), eq(farmer.status, "active"))
                });
                if (!farmerData) throw new TRPCError({ code: "NOT_FOUND", message: "Farmer not found or archived." });

                if (ctx.user.globalRole !== "ADMIN" && farmerData.officerId !== ctx.user.id) {
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, farmerData.organizationId),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (!membership) throw new TRPCError({ code: "FORBIDDEN" });

                    if (membership.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                        throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot edit logs." });
                    }
                } else if (ctx.user.globalRole !== "ADMIN") {
                    // Check if Manager (even if officerId matches)
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, farmerData.organizationId),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                        throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot edit logs." });
                    }
                }

                // Date Validation
                if (input.newDate) {
                    const reqTime = new Date(input.newDate).getTime();
                    const cycleTime = new Date(activeCycle.createdAt).getTime();

                    // Allow up to 24 hours buffer to handle timezone discrepancies between local midnight and UTC server time
                    if (reqTime < cycleTime - 24 * 60 * 60 * 1000) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `Mortality log date cannot be before cycle start date (${activeCycle.createdAt.toLocaleDateString()}).`
                        });
                    }
                }

                // SAFETY LOCK: Cannot edit mortality that happened before a sale
                const [latestSale] = await tx
                    .select({ saleDate: saleEvents.saleDate })
                    .from(saleEvents)
                    .where(eq(saleEvents.cycleId, cycleId))
                    .orderBy(desc(saleEvents.saleDate))
                    .limit(1);

                if (latestSale) {
                    const saleTime = new Date(latestSale.saleDate).getTime();
                    const logTime = new Date(log.createdAt).getTime();
                    const newLogTime = input.newDate ? new Date(input.newDate).getTime() : logTime;

                    if (newLogTime < saleTime - 24 * 60 * 60 * 1000) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: "Cannot edit mortality logs to occur before a recorded sale."
                        });
                    }
                }

                const delta = input.newAmount - log.valueChange;
                const newTotalMortality = activeCycle.mortality + delta;

                // Protection: Mortality cannot drop below what was recorded in any sale event
                const [maxSaleEvent] = await tx
                    .select({ totalMortality: saleEvents.totalMortality })
                    .from(saleEvents)
                    .where(eq(saleEvents.cycleId, cycleId))
                    .orderBy(desc(saleEvents.totalMortality))
                    .limit(1);

                if (maxSaleEvent) {
                    if (newTotalMortality < maxSaleEvent.totalMortality) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `Cannot reduce mortality below ${maxSaleEvent.totalMortality}. A sale report already locked in this number.`
                        });
                    }
                } else {
                    if (newTotalMortality < 0) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `Invalid Operation: Total mortality cannot be negative (${newTotalMortality}).`
                        });
                    }
                }

                // Update Cycle
                await tx.update(cycles)
                    .set({
                        mortality: newTotalMortality,
                        updatedAt: new Date()
                    })
                    .where(eq(cycles.id, cycleId));

                // Update Log
                await tx.update(cycleLogs)
                    .set({
                        valueChange: input.newAmount,
                        createdAt: input.newDate || log.createdAt,
                        note: input.reason || log.note,
                        newValue: newTotalMortality
                    })
                    .where(eq(cycleLogs.id, input.logId));

                // Recalculate Feed
                const [updatedCycle] = await tx.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
                if (updatedCycle) {
                    await updateCycleFeed(
                        updatedCycle,
                        ctx.user.id,
                        true,
                        tx,
                        `Mortality Log Updated. Recalculated intake.`,
                        input.newDate || log.createdAt
                    );
                }

                return { success: true };
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
                    where: and(eq(farmer.id, activeCycle.farmerId), eq(farmer.status, "active"))
                });

                if (!farmerData) throw new TRPCError({ code: "NOT_FOUND", message: "Farmer not found or archived." });

                if (ctx.user.globalRole !== "ADMIN" && farmerData.officerId !== ctx.user.id) {
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, farmerData.organizationId),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
                    if (membership.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                        throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot revert logs." });
                    }
                } else if (ctx.user.globalRole !== "ADMIN") {
                    // Check if Manager (even if officerId matches)
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, farmerData.organizationId),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                        throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot revert logs." });
                    }
                }

                if (log.isReverted) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "This log has already been reverted."
                    });
                }

                if ((log.valueChange ?? 0) < 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot revert a system-generated adjustment/revert log."
                    });
                }

                // Update Cycle Mortality
                const revertAmount = log.valueChange; // This was +Amount
                const newTotalMortality = (activeCycle.mortality || 0) - revertAmount;

                // FLAWLESS PROTECTION: Mortality cannot drop below what was recorded in any sale event
                const [maxSaleEvent] = await tx
                    .select({ totalMortality: saleEvents.totalMortality })
                    .from(saleEvents)
                    .where(eq(saleEvents.cycleId, cycleId))
                    .orderBy(desc(saleEvents.totalMortality))
                    .limit(1);

                if (maxSaleEvent) {
                    if (newTotalMortality < maxSaleEvent.totalMortality) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `Cannot reduce mortality below ${maxSaleEvent.totalMortality}. A sale report already locked in this number.`
                        });
                    }
                } else {
                    if (newTotalMortality < 0) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `Invalid Operation: Total mortality cannot be negative (${newTotalMortality}).`
                        });
                    }
                }

                // 1. Mark original log as reverted
                await tx.update(cycleLogs)
                    .set({ isReverted: true })
                    .where(eq(cycleLogs.id, input.logId));

                // 2. Update Cycle Stats
                await tx.update(cycles)
                    .set({
                        mortality: sql`${cycles.mortality} - ${revertAmount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(cycles.id, cycleId));

                // 3. Create Correction Log (Stay as MORTALITY type for intake calculation)
                // EXPERIMENTAL: We backdate the correction to the original log's date.
                // This ensures that the feed calculation cancels out perfectly at the time of the error,
                // treating the birds as alive for the entire interim period.
                await tx.insert(cycleLogs).values({
                    cycleId: cycleId,
                    userId: ctx.user.id,
                    type: "MORTALITY",
                    valueChange: -revertAmount,
                    note: `Reverted Mortality: Previously reported ${revertAmount} birds.`,
                    previousValue: activeCycle.mortality,
                    newValue: newTotalMortality,
                    createdAt: log.createdAt // BACKDATE TO ORIGINAL LOG DATE
                });

                // Trigger Intake Recalculation (Refetch to get updated mortality)
                const [updatedCycle] = await tx.select().from(cycles).where(eq(cycles.id, cycleId)).limit(1);
                if (updatedCycle) {
                    await updateCycleFeed(
                        updatedCycle,
                        ctx.user.id,
                        true,
                        tx,
                        `Mortality Reverted. Recalculated intake based on updated live bird count.`,
                        log.createdAt
                    );
                }

                return { success: true };
            });
        }),

    // CORRECT DOC (Edit Initial Birds)
    correctDoc: proProcedure
        .input(z.object({
            cycleId: z.string(),
            newDoc: z.number().int().positive().max(200000, "Maximum 200,000 birds"),
            reason: z.string().max(500).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            // //conosle.log(`[correctDoc] Starting for cycleId: ${input.cycleId}, newDoc: ${input.newDoc}`);
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

                if (farmerData.status !== "active") {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot correct DOC for an archived farmer profile."
                    });
                }

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

                if (cycle.birdsSold > 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot edit initial birds after sales have started."
                    });
                }

                const oldDoc = cycle.doc;
                if (oldDoc === input.newDoc) return { success: true, message: "No change" };

                // //conosle.log(`[correctDoc] Updating doc from ${oldDoc} to ${input.newDoc}`);

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

                // //conosle.log(`[correctDoc] Successfully completed.`);
                return { success: true };
            });
        }),

    // CORRECT AGE (Edit Cycle Age)
    correctAge: proProcedure
        .input(z.object({
            cycleId: z.string(),
            newAge: z.number().int().positive().max(40, "Maximum 40 days"),
            reason: z.string().max(500).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                // 1. Fetch Cycle
                const [cycle] = await tx.select().from(cycles).where(eq(cycles.id, input.cycleId)).limit(1);
                if (!cycle) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
                }

                // 2. Validate Access
                const farmerData = await tx.query.farmer.findFirst({
                    where: eq(farmer.id, cycle.farmerId)
                });
                if (!farmerData) throw new TRPCError({ code: "NOT_FOUND" });
                if (farmerData.status !== "active") {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot correct age for archived farmer." });
                }

                // Check officer/admin rights
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

                // 3. VALIDATION: Cannot edit age if it conflicts with existing sales
                if (cycle.birdsSold > 0) {
                    const [maxSaleEvent] = await tx
                        .select({ maxAge: saleEvents.age })
                        .from(saleEvents)
                        .where(eq(saleEvents.cycleId, input.cycleId))
                        .orderBy(desc(saleEvents.age))
                        .limit(1);

                    const maxSaleAge = maxSaleEvent?.maxAge || 0;

                    if (input.newAge < maxSaleAge) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `Cannot reduce age to ${input.newAge}. The cycle has a recorded sale at age ${maxSaleAge}.`
                        });
                    }
                }

                const oldAge = cycle.age;
                if (input.newAge === oldAge) {
                    return { success: true, message: "No change in age." };
                }

                // 4. Calculate New createdAt
                // Logic: If current age is X, createdAt was X days ago.
                // We want new age to be Y, so createdAt must be Y days ago.
                const now = new Date();
                const newCreationDate = new Date(now);
                newCreationDate.setDate(now.getDate() - (input.newAge - 1)); // -1 because age 1 = today (0 days diff implies < 24h, logic in feed service considers days diff + 1)



                // Update Cycle
                await tx.update(cycles)
                    .set({
                        age: input.newAge,
                        createdAt: newCreationDate,
                        updatedAt: new Date()
                    })
                    .where(eq(cycles.id, input.cycleId));

                // 5. Create Correction Log
                await tx.insert(cycleLogs).values({
                    cycleId: input.cycleId,
                    userId: ctx.user.id,
                    type: "CORRECTION",
                    valueChange: 0,
                    previousValue: oldAge,
                    newValue: input.newAge,
                    note: `Age Correction: Changed from ${oldAge} to ${input.newAge}. Reason: ${input.reason}`
                });

                // 6. Recalculate Feed
                const [updatedCycle] = await tx.select().from(cycles).where(eq(cycles.id, input.cycleId)).limit(1);
                if (updatedCycle) {
                    const { updateCycleFeed } = await import("@/modules/cycles/server/services/feed-service");
                    await updateCycleFeed(
                        updatedCycle,
                        ctx.user.id,
                        true, // Force update
                        tx,
                        `Age corrected to ${input.newAge}. Recalculating intake.`
                    );
                }

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
                const farmerData = await tx.query.farmer.findFirst({
                    where: and(eq(farmer.id, currentCycle.farmerId), eq(farmer.status, "active"))
                });
                if (!farmerData) throw new TRPCError({ code: "NOT_FOUND", message: "Farmer not found or archived." });

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

                // FLAWLESS PROTECTION: Mortality cannot drop below what was recorded in any sale event
                const [maxSaleEvent] = await tx
                    .select({ totalMortality: saleEvents.totalMortality })
                    .from(saleEvents)
                    .where(eq(saleEvents.cycleId, cycleId))
                    .orderBy(desc(saleEvents.totalMortality))
                    .limit(1);

                const maxSaleMortality = maxSaleEvent?.totalMortality || 0;

                if (newTotal < maxSaleMortality) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Cannot reduce mortality to ${newTotal}. A sale report already recorded ${maxSaleMortality} dead birds. Adjust the sale reports first.`
                    });
                }

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

    correctMortality: proProcedure
        .input(z.object({
            cycleId: z.string(),
            newTotalMortality: z.number().int().min(0),
            reason: z.string().optional()
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

                if (farmerData.status !== "active") {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot correct mortality for an archived farmer profile."
                    });
                }

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

                if (cycle.birdsSold > 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot correct mortality after sales have started."
                    });
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

    // BACKDATE CYCLE (Shift all dates backward for an archived cycle)
    backdateCycle: proProcedure
        .input(z.object({
            historyId: z.string(),
            days: z.number().int().positive().max(730, "Maximum 730 days (2 years)"),
        }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                // 1. Fetch History Record
                const historyRecord = await tx.query.cycleHistory.findFirst({
                    where: eq(cycleHistory.id, input.historyId),
                    with: { farmer: true }
                });

                if (!historyRecord) throw new TRPCError({ code: "NOT_FOUND", message: "Cycle history not found." });
                if (!historyRecord.farmer || historyRecord.farmer.status !== "active") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "Farmer not found or archived." });
                }

                // Access Check: Officer ownership
                if (ctx.user.globalRole !== "ADMIN" && historyRecord.farmer.officerId !== ctx.user.id) {
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, historyRecord.organizationId!),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
                    if (membership.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                        throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot backdate cycles." });
                    }
                } else if (ctx.user.globalRole !== "ADMIN") {
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, historyRecord.organizationId!),
                            eq(member.status, "ACTIVE")
                        )
                    });
                    if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                        throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot backdate cycles." });
                    }
                }

                const intervalExpr = sql`interval '${sql.raw(String(input.days))} days'`;

                // 1. Shift cycle_history startDate and endDate
                await tx.update(cycleHistory)
                    .set({
                        startDate: sql`${cycleHistory.startDate} - ${intervalExpr}`,
                        endDate: sql`${cycleHistory.endDate} - ${intervalExpr}`,
                        officialInputDate: sql`${cycleHistory.officialInputDate} - ${intervalExpr}`,
                    })
                    .where(eq(cycleHistory.id, input.historyId));

                // 2. Shift cycle_logs createdAt
                await tx.update(cycleLogs)
                    .set({
                        createdAt: sql`${cycleLogs.createdAt} - ${intervalExpr}`,
                    })
                    .where(eq(cycleLogs.historyId, input.historyId));

                // 3. Shift sale_events saleDate and createdAt
                const affectedSaleEvents = await tx.select({ id: saleEvents.id })
                    .from(saleEvents)
                    .where(eq(saleEvents.historyId, input.historyId));

                if (affectedSaleEvents.length > 0) {
                    await tx.update(saleEvents)
                        .set({
                            saleDate: sql`${saleEvents.saleDate} - ${intervalExpr}`,
                            createdAt: sql`${saleEvents.createdAt} - ${intervalExpr}`,
                        })
                        .where(eq(saleEvents.historyId, input.historyId));

                    // 4. Shift sale_reports createdAt (linked via sale events)
                    const saleEventIds = affectedSaleEvents.map(e => e.id);
                    if (saleEventIds.length > 0) {
                        await tx.update(saleReports)
                            .set({
                                createdAt: sql`${saleReports.createdAt} - ${intervalExpr}`,
                            })
                            .where(sql`${saleReports.saleEventId} IN ${saleEventIds}`);
                    }
                }

                // 5. Shift sale_metrics calculatedAt and lastRecalculatedAt
                await tx.update(saleMetrics)
                    .set({
                        calculatedAt: sql`${saleMetrics.calculatedAt} - ${intervalExpr}`,
                        lastRecalculatedAt: sql`${saleMetrics.lastRecalculatedAt} - ${intervalExpr}`,
                    })
                    .where(eq(saleMetrics.historyId, input.historyId));

                // 6. Shift stock_logs createdAt (linked via referenceId = historyId)
                await tx.update(stockLogs)
                    .set({
                        createdAt: sql`${stockLogs.createdAt} - ${intervalExpr}`,
                    })
                    .where(eq(stockLogs.referenceId, input.historyId));

                // 7. Insert a SYSTEM log noting the backdate
                await tx.insert(cycleLogs).values({
                    historyId: input.historyId,
                    userId: ctx.user.id,
                    type: "SYSTEM",
                    valueChange: 0,
                    note: `Cycle backdated by ${input.days} day(s). All related dates shifted.`,
                });

                // Fetch the updated record to return
                const updated = await tx.query.cycleHistory.findFirst({
                    where: eq(cycleHistory.id, input.historyId)
                });

                return { success: true, startDate: updated?.startDate, endDate: updated?.endDate };
            });
        }),

});
