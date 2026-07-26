import { farmer, feedOrderItems, feedOrders, member, stockLogs } from "@/db/schema";
import { createTRPCRouter, orgProcedure, proProcedure, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";

export const officerStockRouter = createTRPCRouter({
    // GET HISTORY (Ledger)
    getHistory: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Check ownership
            const f = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.id, input.farmerId),
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, "active")
                )
            });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            return await ctx.db.select()
                .from(stockLogs)
                .where(eq(stockLogs.farmerId, input.farmerId))
                .orderBy(desc(stockLogs.createdAt));
        }),

    // ADD STOCK (Ledger Entry Added)
    addStock: protectedProcedure
        .input(z.object({
            farmerId: z.string(),
            amount: z.number().positive().max(2000, "Max addition is 2000 bags"),
            note: z.string().max(500).optional(),
            feedType: z.string().trim().max(50).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            // Check ownership
            const f = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.id, input.farmerId),
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, "active")
                )
            });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            return await ctx.db.transaction(async (tx) => {
                // A. Update Farmer DB
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${input.amount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, input.farmerId));

                const newBalance = f.mainStock + input.amount;

                // B. Add Ledger Entry
                await tx.insert(stockLogs).values({
                    farmerId: input.farmerId,
                    amount: input.amount.toString(),
                    type: "STOCK_ADDED",
                    note: input.note || "Standard stock replenishment",
                    feedType: input.feedType || null,
                    balanceAfter: newBalance.toString(),
                });

                // C. NOTIFICATION
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: f.organizationId,
                        title: "Stock Added",
                        message: `Officer ${ctx.user.name} added ${input.amount} bags to ${f.name}.`,
                        type: "SUCCESS",
                        link: `/management/farmers/${f.id}`
                    });
                } catch (e) {
                    console.error("Failed to send stock notification", e);
                }
            });
        }),

    // DEDUCT STOCK (Manual Correction)
    deductStock: protectedProcedure
        .input(z.object({
            farmerId: z.string(),
            amount: z.number().positive().max(1000, "Max deduction is 1000 bags"),
            note: z.string().max(500).optional(),
            feedType: z.string().trim().max(50).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            // Check ownership
            const f = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.id, input.farmerId),
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, "active")
                )
            });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            return await ctx.db.transaction(async (tx) => {
                // A. Update Farmer DB (Subtract)
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} - ${input.amount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, input.farmerId));

                const newBalance = f.mainStock - input.amount;

                // B. Add Ledger Entry (Negative Amount)
                await tx.insert(stockLogs).values({
                    farmerId: input.farmerId,
                    amount: (-input.amount).toString(),
                    type: "STOCK_DEDUCTED",
                    note: input.note || "Manual stock removal",
                    feedType: input.feedType || null,
                    balanceAfter: newBalance.toString(),
                });

                // C. NOTIFICATION
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: f.organizationId,
                        title: "Stock Deducted",
                        message: `Officer ${ctx.user.name} deducted ${input.amount} bags from ${f.name}.`,
                        type: "WARNING",
                        link: `/management/farmers/${f.id}`
                    });
                } catch (e) {
                    console.error("Failed to send stock notification", e);
                }
            });
        }),

    // BULK ADD STOCK (Pro Feature)
    bulkAddStock: proProcedure
        .input(z.object({
            items: z.array(z.object({
                farmerId: z.string(),
                feeds: z.array(z.object({
                    type: z.string().trim().max(50).optional(),
                    quantity: z.number().positive().max(1000)
                })).min(1).max(10),
                note: z.string().max(500).optional()
            })).max(50),
            driverName: z.string().min(1, "Driver name is required").max(100)
        }))
        .mutation(async ({ ctx, input }) => {
            const { items, driverName } = input;
            if (items.length === 0) return { success: true, count: 0 };

            const result = await ctx.db.transaction(async (tx) => {
                const inputFarmerIds = items.map(i => i.farmerId);

                // 1. Fetch all valid farmers for this user in one go
                const validFarmers = await tx.query.farmer.findMany({
                    where: and(
                        inArray(farmer.id, inputFarmerIds),
                        eq(farmer.officerId, ctx.user.id),
                        eq(farmer.status, "active")
                    )
                });

                const validFarmerIds = new Set(validFarmers.map(f => f.id));
                const orgId = validFarmers[0]?.organizationId;

                // 2. Filter input to only include valid farmers
                const validInputs = items.filter(item => validFarmerIds.has(item.farmerId));
                if (validInputs.length === 0) return { success: true, count: 0, orgId };

                // 3. Build a map of current stock for balance calculation
                const farmerStockMap = new Map(validFarmers.map(f => [f.id, f.mainStock]));

                // 4. Bulk Update Farmer Stock — total per farmer summed across its feed lines
                for (const item of validInputs) {
                    const farmerTotal = item.feeds.reduce((s, f) => s + f.quantity, 0);
                    await tx.update(farmer)
                        .set({
                            mainStock: sql`${farmer.mainStock} + ${farmerTotal}`,
                            updatedAt: new Date()
                        })
                        .where(eq(farmer.id, item.farmerId));
                }

                // 5. Prepare Bulk Stock Logs — one row per feed line, running balance per farmer
                const batchId = crypto.randomUUID();
                const logsToInsert: (typeof stockLogs.$inferInsert)[] = [];
                for (const item of validInputs) {
                    let running = farmerStockMap.get(item.farmerId) ?? 0;
                    for (const feed of item.feeds) {
                        running += feed.quantity;
                        logsToInsert.push({
                            farmerId: item.farmerId,
                            amount: feed.quantity.toString(),
                            type: "STOCK_ADDED",
                            referenceId: batchId,
                            driverName: driverName,
                            feedType: feed.type?.trim() || null,
                            note: item.note || `Bulk Restock (Driver: ${driverName})`,
                            balanceAfter: running.toString(),
                        });
                    }
                }

                await tx.insert(stockLogs).values(logsToInsert);

                return { success: true, count: validInputs.length, orgId };
            });

            if (result.success && result.count > 0 && result.orgId) {
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: result.orgId,
                        title: "Bulk Stock Update",
                        message: `Officer ${ctx.user.name} performed a bulk stock update for ${result.count} farmers.`,
                        type: "SUCCESS",
                        link: `/management/farmers`
                    });
                } catch (e) {
                    console.error("Failed to send bulk stock notification", e);
                }
            }

            return result;
        }),

    // TRANSFER STOCK (Officer to Officer)
    transferStock: protectedProcedure
        .input(z.object({
            sourceFarmerId: z.string(),
            targetFarmerId: z.string(),
            amount: z.number().positive().max(1000, "Max transfer is 1000 bags"),
            note: z.string().max(500).optional(),
            feedType: z.string().trim().max(50).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            // 1. Validate Input
            if (input.sourceFarmerId === input.targetFarmerId) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot transfer to the same farmer." });
            }

            return await ctx.db.transaction(async (tx) => {
                // 2. Fetch Source & Target
                const sourceFarmer = await tx.query.farmer.findFirst({
                    where: and(
                        eq(farmer.id, input.sourceFarmerId),
                        eq(farmer.status, "active")
                    )
                });

                const targetFarmer = await tx.query.farmer.findFirst({
                    where: and(
                        eq(farmer.id, input.targetFarmerId),
                        eq(farmer.status, "active")
                    )
                });

                if (!sourceFarmer || !targetFarmer) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "One or both farmers not found or archived." });
                }

                // 2.1 Permission Check
                const checkPermission = async (f: typeof sourceFarmer) => {
                    if (f.officerId === ctx.user.id) return true; // Owns the farmer
                    if (ctx.user.globalRole === "ADMIN") return true; // Super Admin

                    // Check Organization Membership — only MANAGER/OWNER can transfer across officers
                    const membership = await tx.query.member.findFirst({
                        where: and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, f.organizationId),
                            eq(member.status, "ACTIVE")
                        )
                    });

                    return membership?.role === "OWNER" || membership?.role === "MANAGER";
                };

                if (!await checkPermission(sourceFarmer) || !await checkPermission(targetFarmer)) {
                    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to manage these farmers." });
                }

                // 3. Check Funds
                if (sourceFarmer.mainStock < input.amount) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Insufficient stock. ${sourceFarmer.name} has ${sourceFarmer.mainStock} bags.`,
                    });
                }

                // 4. Execute Transfer (Source -> Target)
                const transferId = crypto.randomUUID();

                // A. Deduct from Source
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} - ${input.amount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, input.sourceFarmerId));

                const sourceNewBalance = sourceFarmer.mainStock - input.amount;

                await tx.insert(stockLogs).values({
                    farmerId: input.sourceFarmerId,
                    amount: (-input.amount).toString(),
                    type: "TRANSFER_OUT",
                    referenceId: transferId,
                    note: input.note ? `Transfer to ${targetFarmer.name}: ${input.note}` : `Stock transfer to ${targetFarmer.name}`,
                    feedType: input.feedType || null,
                    balanceAfter: sourceNewBalance.toString(),
                });

                // B. Add to Target
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${input.amount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, input.targetFarmerId));

                const targetNewBalance = targetFarmer.mainStock + input.amount;

                await tx.insert(stockLogs).values({
                    farmerId: input.targetFarmerId,
                    amount: input.amount.toString(),
                    type: "TRANSFER_IN",
                    referenceId: transferId,
                    note: input.note ? `Received from ${sourceFarmer.name}: ${input.note}` : `Stock received from ${sourceFarmer.name}`,
                    feedType: input.feedType || null,
                    balanceAfter: targetNewBalance.toString(),
                });

                // C. NOTIFICATION
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: sourceFarmer.organizationId,
                        title: "Stock Transfer",
                        message: `Officer ${ctx.user.name} transferred ${input.amount} bags from ${sourceFarmer.name} to ${targetFarmer.name}.`,
                        type: "INFO",
                        link: `/management/farmers/${targetFarmer.id}`
                    });
                } catch (e) {
                    console.error("Failed to send transfer notification", e);
                }

                return { success: true };
            });
        }),

    // REVERT STOCK LOG (Correction)
    revertStockLog: protectedProcedure
        .input(z.object({
            logId: z.string(),
            note: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                // 1. Fetch original log
                const [originalLog] = await tx.select().from(stockLogs).where(eq(stockLogs.id, input.logId));
                if (!originalLog) throw new TRPCError({ code: "NOT_FOUND", message: "Log entry not found." });

                // 2. Access Check
                const farmerData = await tx.query.farmer.findFirst({
                    where: and(
                        eq(farmer.id, originalLog.farmerId!),
                        ctx.user.globalRole !== "ADMIN" ? eq(farmer.status, "active") : undefined
                    )
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

                // 3. Preventive Checks
                if (originalLog.type === "ADJUSTMENT" || originalLog.type === "CYCLE_CONSUMPTION" || originalLog.type === "CORRECTION") {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "This type of log entry (Adjustment/Consumption) cannot be reverted."
                    });
                }

                // Safety Check: Prevent negative stock
                const amountToRevert = typeof originalLog.amount === 'string' ? parseFloat(originalLog.amount) : originalLog.amount;
                if (farmerData.mainStock - amountToRevert < 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Cannot revert this log. It would result in negative stock (${(farmerData.mainStock - amountToRevert).toFixed(2)} bags).`
                    });
                }

                // Check if this log has already been reverted (exists as a reference for another adjustment)
                const [existingCorrection] = await tx.select()
                    .from(stockLogs)
                    .where(and(eq(stockLogs.referenceId, input.logId), eq(stockLogs.type, "ADJUSTMENT")));

                if (existingCorrection) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "This log has already been reverted."
                    });
                }

                if (originalLog.type === "CYCLE_CLOSE") {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot revert a Cycle Close log directly. Please reopen the cycle from the History tab."
                    });
                }

                // 4. Create Correction Log (Negate the amount)
                const originalAmount = typeof originalLog.amount === 'string' ? parseFloat(originalLog.amount) : originalLog.amount;
                const correctionAmount = -originalAmount;

                // 5. Update Farmer Stock
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${correctionAmount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, originalLog.farmerId!));

                const newBalance = farmerData.mainStock + correctionAmount;

                await tx.insert(stockLogs).values({
                    farmerId: originalLog.farmerId,
                    amount: correctionAmount.toString(),
                    type: "ADJUSTMENT",
                    referenceId: originalLog.id,
                    note: input.note || `Revert of previous ${originalLog.type.replace(/_/g, ' ')}`,
                    feedType: originalLog.feedType,
                    balanceAfter: newBalance.toString(),
                });

                // 6. NOTIFICATION
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: farmerData.organizationId,
                        title: "Stock Log Reverted",
                        message: `Officer ${ctx.user.name} reverted a stock log for ${farmerData.name} (${originalLog.amount} bags).`,
                        type: "WARNING",
                        link: `/management/farmers/${farmerData.id}`
                    });
                } catch (e) {
                    console.error("Failed to send revert notification", e);
                }

                return { success: true };
            });
        }),

    // CORRECT STOCK LOG (Edit Amount)
    correctStockLog: protectedProcedure
        .input(z.object({
            logId: z.string(),
            newAmount: z.number(),
            note: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                // 1. Fetch original log
                const [originalLog] = await tx.select().from(stockLogs).where(eq(stockLogs.id, input.logId));
                if (!originalLog) throw new TRPCError({ code: "NOT_FOUND", message: "Log entry not found." });

                // 2. Access Check
                const farmerData = await tx.query.farmer.findFirst({
                    where: and(
                        eq(farmer.id, originalLog.farmerId!),
                        ctx.user.globalRole !== "ADMIN" ? eq(farmer.status, "active") : undefined
                    )
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

                // 3. Preventive Checks
                if (originalLog.type === "ADJUSTMENT" || originalLog.type === "CYCLE_CONSUMPTION" || originalLog.type === "CORRECTION") {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Adjustment or Consumption logs cannot be edited." });
                }

                // Check if this log has been reverted
                const [reversion] = await tx.select()
                    .from(stockLogs)
                    .where(and(eq(stockLogs.referenceId, input.logId), eq(stockLogs.type, "ADJUSTMENT")));

                if (reversion) {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit a log that has already been reverted." });
                }

                if (originalLog.type === "CYCLE_CLOSE") {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit cycle close logs. Reopen cycle instead." });
                }

                const oldAmount = typeof originalLog.amount === 'string' ? parseFloat(originalLog.amount) : originalLog.amount;
                const delta = input.newAmount - oldAmount;
                if (delta === 0) return { success: true };

                // 3.5 Safety Check: Prevent negative stock
                if (farmerData.mainStock + delta < 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `This correction would result in negative stock (${(farmerData.mainStock + delta).toFixed(2)} bags).`
                    });
                }

                // 4. Update Farmer Stock by Delta
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${delta}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, originalLog.farmerId!));

                const newBalance = farmerData.mainStock + delta;

                // 5. Insert ADJUSTMENT Log with delta
                await tx.insert(stockLogs).values({
                    farmerId: originalLog.farmerId,
                    amount: delta.toString(),
                    type: "ADJUSTMENT",
                    referenceId: originalLog.id,
                    note: input.note || `Amount adjustment for previous ${originalLog.type.replace(/_/g, ' ')}`,
                    feedType: originalLog.feedType,
                    balanceAfter: newBalance.toString(),
                });

                // 6. NOTIFICATION
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: farmerData.organizationId,
                        title: "Stock Log Corrected",
                        message: `Officer ${ctx.user.name} corrected a stock log for ${farmerData.name}. Adjustment: ${delta > 0 ? "+" : ""}${delta} bags.`,
                        type: "UPDATE",
                        link: `/management/farmers/${farmerData.id}`
                    });
                } catch (e) {
                    console.error("Failed to send edit notification", e);
                }

                return { success: true };
            });
        }),
    // REVERT TRANSFER (Reverse both sides of a transfer)
    revertTransfer: protectedProcedure
        .input(z.object({
            referenceId: z.string(),
            note: z.string().optional()
        }))
        .mutation(async ({ ctx, input }) => {
            return await ctx.db.transaction(async (tx) => {
                // 1. Fetch ALL logs linked by this referenceId
                const logs = await tx.select().from(stockLogs).where(eq(stockLogs.referenceId, input.referenceId));

                if (logs.length === 0) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "No logs found for this transfer." });
                }

                // 2. Security & Type Check (Ensure they are transfers and belong to user)
                for (const log of logs) {
                    if (log.type !== "TRANSFER_OUT" && log.type !== "TRANSFER_IN") {
                        throw new TRPCError({ code: "BAD_REQUEST", message: "Found non-transfer logs linked to this reference ID. Cannot revert." });
                    }

                    // Check if *any* of the logs in this transfer have already been reverted/adjusted
                    const [alreadyReverted] = await tx.select()
                        .from(stockLogs)
                        .where(and(eq(stockLogs.referenceId, log.id), eq(stockLogs.type, "ADJUSTMENT")));

                    if (alreadyReverted) {
                        throw new TRPCError({ code: "BAD_REQUEST", message: `A part of this transfer has already been reverted.` });
                    }

                    // Check Access
                    const farmerData = await tx.query.farmer.findFirst({
                        where: and(
                            eq(farmer.id, log.farmerId!),
                            ctx.user.globalRole !== "ADMIN" ? eq(farmer.status, "active") : undefined
                        )
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
                        if (!membership) {
                            throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to revert transfers for this farmer." });
                        }
                    }

                    // 2.5 Safety Check: Prevent negative stock
                    const amount = typeof log.amount === 'string' ? parseFloat(log.amount) : log.amount;
                    const reverseAmount = -amount;
                    if (reverseAmount < 0 && farmerData.mainStock + reverseAmount < 0) {
                        throw new TRPCError({
                            code: "BAD_REQUEST",
                            message: `Cannot revert this transfer. Farmer ${farmerData.name} would end up with negative stock (${(farmerData.mainStock + reverseAmount).toFixed(2)} bags).`
                        });
                    }
                }

                // 3. Execute Reversal
                for (const log of logs) {
                    const amount = typeof log.amount === 'string' ? parseFloat(log.amount) : log.amount;
                    const reverseAmount = -amount;

                    // A. Update Farmer Stock
                    await tx.update(farmer)
                        .set({
                            mainStock: sql`${farmer.mainStock} + ${reverseAmount}`,
                            updatedAt: new Date()
                        })
                        .where(eq(farmer.id, log.farmerId!));

                    // Re-read updated balance
                    const updatedFarmer = await tx.query.farmer.findFirst({
                        where: eq(farmer.id, log.farmerId!),
                        columns: { mainStock: true }
                    });

                    // B. Add Adjustment Log
                    await tx.insert(stockLogs).values({
                        farmerId: log.farmerId,
                        amount: reverseAmount.toString(),
                        type: "ADJUSTMENT",
                        referenceId: log.id,
                        note: input.note || `Reverted ${log.type.replace(/_/g, ' ')} (Ref: ${input.referenceId.substring(0, 8)})`,
                        feedType: log.feedType,
                        balanceAfter: updatedFarmer?.mainStock?.toString() ?? null,
                    });
                }

                // 4. NOTIFICATION
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: (await tx.query.farmer.findFirst({ where: eq(farmer.id, logs[0].farmerId!) }))?.organizationId,
                        title: "Transfer Reverted",
                        message: `Officer ${ctx.user.name} reverted a stock transfer (Ref: ${input.referenceId}).`,
                        type: "WARNING",
                        link: `/management/farmers`
                    });
                } catch (e) {
                    console.error("Failed to send transfer revert notification", e);
                }

                return { success: true };
            });
        }),
    // GET ALL FARMERS STOCK (Pro Ledger View - Paginated)
    getAllFarmersStock: proProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(20),
            cursor: z.number().default(0),
            search: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            const items = await ctx.db.query.farmer.findMany({
                where: and(
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, "active"),
                    input.search ? sql`${farmer.name} ILIKE ${`%${input.search}%`}` : undefined
                ),
                columns: {
                    id: true,
                    name: true,
                    mainStock: true,
                    updatedAt: true,
                },
                orderBy: [asc(farmer.name), asc(farmer.id)],
                limit: input.limit + 1, // Fetch one extra to know if there's a next page
                offset: input.cursor,
            });

            let nextCursor: typeof input.cursor | undefined = undefined;
            if (items.length > input.limit) {
                items.pop(); // Remove the extra item
                nextCursor = input.cursor + input.limit;
            }

            // Fetch latest stock log date per farmer
            const farmerIds = items.map(f => f.id);
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

            return {
                items: items.map(f => ({
                    ...f,
                    mainStockUpdatedAt: stockDatesMap.get(f.id),
                })),
                nextCursor,
            };
        }),

    // GET IMPORT HISTORY (Grouped by Batch)
    getImportHistory: proProcedure
        .input(z.object({
            limit: z.number().min(1).max(50).default(20),
            cursor: z.number().default(0),
            search: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            // We want to group by referenceId where type is RESTOCK
            // Drizzle doesn't support easy "GROUP BY" with relations in query builder yet,
            // so we might need raw SQL or thoughtful query construction.
            // Let's use a raw SQL query for the aggregation to get distinct batches.

            const searchPattern = input.search ? `%${input.search}%` : null;
            const searchCondition = searchPattern ? sql`AND (driver_name ILIKE ${searchPattern} OR farmer_id IN (SELECT id FROM ${farmer} WHERE name ILIKE ${searchPattern}))` : sql``;

            const result: any = await ctx.db.execute(sql`
                SELECT 
                    reference_id as "batchId",
                    MIN(created_at) as "importDate",
                    COUNT(DISTINCT farmer_id) as "count",
                    SUM(amount) as "totalAmount",
                    -- Get the driver_name from the first log in each batch that has one
                    MAX(driver_name) as "driverName",
                    MIN(created_at) as "createdAt"
                FROM ${stockLogs}
                WHERE type = 'STOCK_ADDED'
                AND reference_id IS NOT NULL
                AND farmer_id IN (
                    SELECT id FROM ${farmer} 
                    WHERE officer_id = ${ctx.user.id}
                    AND status = 'active'
                )
                ${searchCondition}
                GROUP BY reference_id
                ORDER BY MIN(created_at) DESC
                LIMIT ${input.limit + 1} OFFSET ${input.cursor}
            `);

            const rows = Array.isArray(result) ? result : result.rows;

            const formattedBatches = rows.map((b: any) => ({
                batchId: String(b.batchId),
                createdAt: new Date(b.createdAt),
                count: Number(b.count),
                totalAmount: Number(b.totalAmount),
                driverName: b.driverName ? String(b.driverName) : null
            }));

            let nextCursor: typeof input.cursor | undefined = undefined;
            if (formattedBatches.length > input.limit) {
                formattedBatches.pop();
                nextCursor = input.cursor + input.limit;
            }

            return {
                items: formattedBatches,
                nextCursor,
            };
        }),

    // GET BATCH DETAILS
    getBatchDetails: proProcedure
        .input(z.object({
            batchId: z.string()
        }))
        .query(async ({ ctx, input }) => {
            // Validate ownership by checking if at least one log in the batch belongs to a farmer owned by this officer
            // (Review: Is this check implicitly handled by the join? Yes, effectively.)

            const ms = await ctx.db.select({
                logId: stockLogs.id,
                amount: stockLogs.amount,
                note: stockLogs.note,
                createdAt: stockLogs.createdAt,
                driverName: stockLogs.driverName,
                feedType: stockLogs.feedType,
                farmerName: farmer.name,
                farmerId: farmer.id
            })
                .from(stockLogs)
                .innerJoin(farmer, eq(stockLogs.farmerId, farmer.id))
                .where(and(
                    eq(stockLogs.referenceId, input.batchId),
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, 'active')
                ))
                .orderBy(desc(stockLogs.createdAt));

            return ms;
        }),

    // GET STOCK BREAKDOWN BY FEED TYPE
    // Note: consumption (CYCLE_CLOSE logs) has no per-type breakdown, so it lands in `unspecified`
    // along with any untyped/legacy log. byType + unspecified always reconciles to `total`.
    getStockBreakdown: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            const f = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.id, input.farmerId),
                    eq(farmer.officerId, ctx.user.id),
                    eq(farmer.status, "active")
                )
            });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            const rows = await ctx.db.select({
                feedType: stockLogs.feedType,
                total: sql<string>`SUM(${stockLogs.amount})`
            })
                .from(stockLogs)
                .where(eq(stockLogs.farmerId, input.farmerId))
                .groupBy(stockLogs.feedType);

            const byType: { feedType: string; amount: number }[] = [];
            let unspecified = 0;
            rows.forEach(r => {
                const amt = Number(r.total);
                if (r.feedType) byType.push({ feedType: r.feedType, amount: amt });
                else unspecified += amt;
            });
            byType.sort((a, b) => a.feedType.localeCompare(b.feedType));

            return { byType, unspecified, total: f.mainStock };
        }),

    // SUGGEST FEED TYPES (Autocomplete source — org-wide, pulls from both stock logs and feed orders)
    getFeedTypeSuggestions: orgProcedure
        .query(async ({ ctx, input }) => {
            const result: any = await ctx.db.execute(sql`
                SELECT DISTINCT feed_type FROM (
                    SELECT sl.feed_type AS feed_type
                    FROM ${stockLogs} sl
                    INNER JOIN ${farmer} f ON f.id = sl.farmer_id
                    WHERE f.organization_id = ${input.orgId}
                      AND sl.feed_type IS NOT NULL AND sl.feed_type <> ''
                    UNION
                    SELECT foi.feed_type AS feed_type
                    FROM ${feedOrderItems} foi
                    INNER JOIN ${feedOrders} fo ON fo.id = foi.feed_order_id
                    WHERE fo.org_id = ${input.orgId}
                      AND foi.feed_type IS NOT NULL AND foi.feed_type <> ''
                ) t
                ORDER BY feed_type ASC
                LIMIT 50
            `);
            const rows = Array.isArray(result) ? result : result.rows;
            return rows.map((r: any) => String(r.feed_type)) as string[];
        }),

    // UPDATE FEED TYPE ON AN EXISTING LOG (retroactive label fix — no balance impact)
    updateLogFeedType: protectedProcedure
        .input(z.object({
            logId: z.string(),
            feedType: z.string().trim().max(50).nullable()
        }))
        .mutation(async ({ ctx, input }) => {
            const [log] = await ctx.db.select().from(stockLogs).where(eq(stockLogs.id, input.logId));
            if (!log) throw new TRPCError({ code: "NOT_FOUND", message: "Log entry not found." });

            const farmerData = await ctx.db.query.farmer.findFirst({
                where: and(
                    eq(farmer.id, log.farmerId!),
                    ctx.user.globalRole !== "ADMIN" ? eq(farmer.status, "active") : undefined
                )
            });
            if (!farmerData) throw new TRPCError({ code: "NOT_FOUND" });

            if (ctx.user.globalRole !== "ADMIN" && farmerData.officerId !== ctx.user.id) {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, farmerData.organizationId),
                        eq(member.status, "ACTIVE")
                    )
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const value = input.feedType?.trim() || null;
            await ctx.db.update(stockLogs).set({ feedType: value }).where(eq(stockLogs.id, input.logId));

            // Keep transfer pairs symmetric — editing one leg updates the other
            if ((log.type === "TRANSFER_OUT" || log.type === "TRANSFER_IN") && log.referenceId) {
                await ctx.db.update(stockLogs)
                    .set({ feedType: value })
                    .where(and(eq(stockLogs.referenceId, log.referenceId), ne(stockLogs.id, input.logId)));
            }

            return { success: true };
        }),
});
