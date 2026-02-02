import { cycleHistory, cycles, farmer, stockLogs, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { aliasedTable, and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "../../init";

export const managementFarmersRouter = createTRPCRouter({
    getMany: orgProcedure
        .input(z.object({
            search: z.string().optional(),
            page: z.number().default(1),
            pageSize: z.number().default(50),
            onlyMine: z.boolean().optional().default(false),
            status: z.enum(["active", "deleted", "all"]).default("active"),
            sortBy: z.string().optional(),
            sortOrder: z.enum(["asc", "desc"]).optional(),
        }))
        .query(async ({ ctx, input }) => {
            const { search, page, pageSize, onlyMine } = input;
            const orgId = input.orgId;

            const officers = aliasedTable(user, "officers");
            const whereClause = and(
                eq(farmer.organizationId, orgId),
                search ? or(
                    ilike(farmer.name, `%${search}%`),
                    ilike(officers.name, `%${search}%`)
                ) : undefined,
                onlyMine ? eq(farmer.officerId, ctx.user.id) : undefined,
                input.status === "all" ? undefined : eq(farmer.status, input.status)
            );

            const data = await ctx.db.select({
                farmer: farmer,
                officer: user
            })
                .from(farmer)
                .leftJoin(user, eq(farmer.officerId, user.id))
                .leftJoin(officers, eq(farmer.officerId, officers.id))
                .where(whereClause)
                .limit(pageSize)
                .offset((page - 1) * pageSize)
                .orderBy(desc(farmer.createdAt));

            const [total] = await ctx.db.select({ count: sql<number>`count(*)` })
                .from(farmer)
                .leftJoin(officers, eq(farmer.officerId, officers.id))
                .where(whereClause);

            return {
                items: await Promise.all(data.map(async d => {
                    const f = d.farmer;
                    const off = d.officer;

                    const [fCycles, fHistory] = await Promise.all([
                        ctx.db.query.cycles.findMany({ where: and(eq(cycles.farmerId, f.id), eq(cycles.status, 'active')) }),
                        ctx.db.query.cycleHistory.findMany({ where: eq(cycleHistory.farmerId, f.id) })
                    ]);

                    return {
                        ...f,
                        officerName: off?.name || "Unknown",
                        activeCyclesCount: fCycles.length,
                        pastCyclesCount: fHistory.length,
                        cycles: fCycles,
                        history: fHistory
                    };
                })),
                total: Number(total.count),
                totalPages: Math.ceil(Number(total.count) / pageSize)
            };
        }),

    getOrgFarmers: orgProcedure
        .input(z.object({
            search: z.string().optional(),
            status: z.enum(["active", "deleted", "all"]).default("active"),
        }))
        .query(async ({ ctx, input }) => {
            const search = input.search;

            const officers = aliasedTable(user, "officers");
            const data = await ctx.db.select({
                farmer: farmer,
                officer: user
            })
                .from(farmer)
                .leftJoin(user, eq(farmer.officerId, user.id))
                .leftJoin(officers, eq(farmer.officerId, officers.id))
                .where(and(
                    eq(farmer.organizationId, input.orgId),
                    input.status === "all" ? undefined : eq(farmer.status, input.status),
                    search ? or(
                        ilike(farmer.name, `%${search}%`),
                        ilike(officers.name, `%${search}%`)
                    ) : undefined
                ))
                .orderBy(desc(farmer.createdAt));

            return await Promise.all(data.map(async d => {
                const f = d.farmer;
                const off = d.officer;

                const [fCycles, fHistory] = await Promise.all([
                    ctx.db.query.cycles.findMany({ where: and(eq(cycles.farmerId, f.id), eq(cycles.status, 'active')) }),
                    ctx.db.query.cycleHistory.findMany({ where: eq(cycleHistory.farmerId, f.id) })
                ]);

                return {
                    ...f,
                    officerName: off?.name || "Unknown",
                    activeCyclesCount: fCycles.length,
                    pastCyclesCount: fHistory.length,
                    cycles: fCycles,
                    history: fHistory
                };
            }));
        }),

    getDetails: orgProcedure
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

            // Post-fetch org membership check (just in case they hacked farmerId but provided correct orgId)
            if (data.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Farmer belongs to a different organization" });
            }

            return data;
        }),

    getCycles: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (f.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN" });
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

    getHistory: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (f.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN" });
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
                    status: d.history.status
                }))
            };
        }),

    getStockLogs: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (f.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN" });
            }

            return await ctx.db.select()
                .from(stockLogs)
                .where(eq(stockLogs.farmerId, input.farmerId))
                .orderBy(desc(stockLogs.createdAt));
        }),

    getManagementHub: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            const farmerData = await ctx.db.query.farmer.findFirst({
                where: eq(farmer.id, input.farmerId),
                with: { officer: true }
            });

            if (!farmerData) throw new TRPCError({ code: "NOT_FOUND" });

            // Post-fetch org membership check
            if (farmerData.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Farmer belongs to a different organization" });
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
                        status: h.status
                    }))
                },
                stockLogs: stockLogsData
            };
        }),

    restore: orgProcedure
        .input(z.object({
            farmerId: z.string(),
            newName: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            const archivedFarmer = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.farmerId), eq(farmer.organizationId, input.orgId))
            });

            if (!archivedFarmer) throw new TRPCError({ code: "NOT_FOUND" });
            if (archivedFarmer.status === "active") return { success: true, message: "Farmer is already active" };

            // The original name is the part before the LAST underscore
            const lastUnderscoreIndex = archivedFarmer.name.lastIndexOf("_");
            const originalName = lastUnderscoreIndex !== -1
                ? archivedFarmer.name.substring(0, lastUnderscoreIndex)
                : archivedFarmer.name;

            const nameToRestore = input.newName || originalName;

            const conflict = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.organizationId, input.orgId),
                    eq(farmer.officerId, archivedFarmer.officerId),
                    eq(farmer.status, "active"),
                    eq(farmer.name, nameToRestore)
                )
            });

            if (conflict) {
                throw new TRPCError({
                    code: "CONFLICT",
                    message: `A farmer named "${nameToRestore}" already exists. Please provide a different name to restore this profile.`
                });
            }

            const [updated] = await ctx.db.update(farmer)
                .set({
                    status: "active",
                    name: nameToRestore,
                    deletedAt: null,
                    updatedAt: new Date()
                })
                .where(eq(farmer.id, input.farmerId))
                .returning();

            // NOTIFICATION: Farmer Restored
            try {
                const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                await NotificationService.sendToOrgManagers({
                    organizationId: input.orgId,
                    title: "Farmer Restored",
                    message: `Manager ${ctx.user.name} restored farmer "${updated.name}"`,
                    type: "SUCCESS",
                    link: `/management/farmers/${updated.id}`
                });
            } catch (e) {
                console.error("Failed to send farmer restoration notification", e);
            }

            return updated;
        }),

    delete: orgProcedure
        .input(z.object({ farmerId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const archivedFarmer = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.farmerId), eq(farmer.organizationId, input.orgId))
            });

            if (!archivedFarmer) throw new TRPCError({ code: "NOT_FOUND" });
            if (archivedFarmer.status === "deleted") throw new TRPCError({ code: "BAD_REQUEST", message: "Farmer is already archived" });

            // 1. Check for active cycles
            const activeCycles = await ctx.db.query.cycles.findFirst({
                where: and(eq(cycles.farmerId, input.farmerId), eq(cycles.status, "active"))
            });

            if (activeCycles) {
                throw new TRPCError({
                    code: "PRECONDITION_FAILED",
                    message: "Cannot archive farmer with active cycles. Please end all cycles first."
                });
            }

            // 2. Perform soft deletion
            const shortId = input.farmerId.slice(0, 4).toUpperCase();
            const archivedName = `${archivedFarmer.name}_${shortId}`;

            const [deleted] = await ctx.db.update(farmer)
                .set({
                    status: "deleted",
                    deletedAt: new Date(),
                    name: archivedName,
                    updatedAt: new Date()
                })
                .where(eq(farmer.id, input.farmerId))
                .returning();

            // NOTIFICATION: Farmer Deleted
            try {
                const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                await NotificationService.sendToOrgManagers({
                    organizationId: input.orgId,
                    title: "Farmer Profile Archived",
                    message: `Manager ${ctx.user.name} archived farmer profile "${deleted.name}"`,
                    type: "WARNING",
                    link: `/management/farmers`
                });
            } catch (e) {
                console.error("Failed to send farmer deletion notification", e);
            }

            return deleted;
        }),
});
