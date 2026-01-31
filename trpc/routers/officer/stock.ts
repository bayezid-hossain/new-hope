import { farmer, member, stockLogs } from "@/db/schema";
import { createTRPCRouter, proProcedure, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

export const officerStockRouter = createTRPCRouter({
    // GET HISTORY (Ledger)
    getHistory: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Check ownership
            const f = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.farmerId), eq(farmer.officerId, ctx.user.id))
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
            amount: z.number().positive().max(1000, "Max addition is 1000 bags"),
            note: z.string().max(500).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            // Check ownership
            const f = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.farmerId), eq(farmer.officerId, ctx.user.id))
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

                // B. Add Ledger Entry
                await tx.insert(stockLogs).values({
                    farmerId: input.farmerId,
                    amount: input.amount.toString(), // Stored as string or decimal
                    type: "RESTOCK",
                    note: input.note || "Manual Restock",
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
            note: z.string().max(500).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            // Check ownership
            const f = await ctx.db.query.farmer.findFirst({
                where: and(eq(farmer.id, input.farmerId), eq(farmer.officerId, ctx.user.id))
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

                // B. Add Ledger Entry (Negative Amount)
                await tx.insert(stockLogs).values({
                    farmerId: input.farmerId,
                    amount: (-input.amount).toString(), // Negative for deduction
                    type: "CORRECTION",
                    note: input.note || "Manual Deduction",
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
        .input(z.array(z.object({
            farmerId: z.string(),
            amount: z.number().positive().max(1000),
            note: z.string().max(500).optional()
        })).max(50)) // Limit batch size
        .mutation(async ({ ctx, input }) => {
            if (input.length === 0) return { success: true, count: 0 };

            const result = await ctx.db.transaction(async (tx) => {
                let successCount = 0;
                let orgId: string | undefined;

                for (const item of input) {
                    const f = await tx.query.farmer.findFirst({
                        where: and(eq(farmer.id, item.farmerId), eq(farmer.officerId, ctx.user.id))
                    });

                    if (!f) continue;
                    orgId = f.organizationId;

                    await tx.update(farmer)
                        .set({
                            mainStock: sql`${farmer.mainStock} + ${item.amount}`,
                            updatedAt: new Date()
                        })
                        .where(eq(farmer.id, item.farmerId));

                    await tx.insert(stockLogs).values({
                        farmerId: item.farmerId,
                        amount: item.amount.toString(),
                        type: "RESTOCK",
                        note: item.note || "Bulk Import Restock",
                    });

                    successCount++;
                }

                return { success: true, count: successCount, orgId };
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
            note: z.string().max(500).optional()
        }))
        .mutation(async ({ ctx, input }) => {
            // 1. Validate Input
            if (input.sourceFarmerId === input.targetFarmerId) {
                throw new Error("Cannot transfer to the same farmer.");
            }

            return await ctx.db.transaction(async (tx) => {
                // 2. Fetch Source & Target (Verify Ownership)
                const sourceFarmer = await tx.query.farmer.findFirst({
                    where: and(
                        eq(farmer.id, input.sourceFarmerId), eq(farmer.officerId, ctx.user.id)
                    )
                });

                const targetFarmer = await tx.query.farmer.findFirst({
                    where: and(
                        eq(farmer.id, input.targetFarmerId), eq(farmer.officerId, ctx.user.id)
                    )
                });

                if (!sourceFarmer || !targetFarmer) {
                    throw new Error("One or both farmers not found or not managed by you.");
                }

                // 3. Check Funds
                if (sourceFarmer.mainStock < input.amount) {
                    throw new Error(`Insufficient funds. Source has ${sourceFarmer.mainStock}, trying to send ${input.amount}.`);
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

                await tx.insert(stockLogs).values({
                    farmerId: input.sourceFarmerId,
                    amount: (-input.amount).toString(),
                    type: "TRANSFER_OUT",
                    referenceId: transferId,
                    note: input.note ? `Transfer to ${targetFarmer.name}: ${input.note}` : `Transferred to ${targetFarmer.name}`,
                });

                // B. Add to Target
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${input.amount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, input.targetFarmerId));

                await tx.insert(stockLogs).values({
                    farmerId: input.targetFarmerId,
                    amount: input.amount.toString(),
                    type: "TRANSFER_IN",
                    referenceId: transferId,
                    note: input.note ? `Received from ${sourceFarmer.name}: ${input.note}` : `Received from ${sourceFarmer.name}`,
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
                    where: eq(farmer.id, originalLog.farmerId!)
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
                if (originalLog.type === "CORRECTION") {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "This is already a correction log and cannot be reverted again."
                    });
                }

                // Safety Check: Prevent negative stock
                const amountToRevert = typeof originalLog.amount === 'string' ? parseFloat(originalLog.amount) : originalLog.amount;
                if (farmerData.mainStock - amountToRevert < 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Cannot revert this log. It would result in negative stock (${(farmerData.mainStock - amountToRevert).toFixed(1)} bags).`
                    });
                }

                // Check if this log has already been reverted (exists as a reference for another correction)
                const [existingCorrection] = await tx.select()
                    .from(stockLogs)
                    .where(and(eq(stockLogs.referenceId, input.logId), eq(stockLogs.type, "CORRECTION")));

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

                await tx.insert(stockLogs).values({
                    farmerId: originalLog.farmerId,
                    amount: correctionAmount.toString(),
                    type: "CORRECTION",
                    referenceId: originalLog.id,
                    note: input.note || `Revert: ${originalLog.note || "Original Entry"}`,
                });

                // 5. Update Farmer Stock
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${correctionAmount}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, originalLog.farmerId!));

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
                    where: eq(farmer.id, originalLog.farmerId!)
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
                if (originalLog.type === "CORRECTION") {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Correction logs cannot be edited." });
                }

                // Check if this log has been reverted
                const [reversion] = await tx.select()
                    .from(stockLogs)
                    .where(and(eq(stockLogs.referenceId, input.logId), eq(stockLogs.type, "CORRECTION")));

                if (reversion) {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit a log that has already been reverted." });
                }

                if (originalLog.type === "CYCLE_CLOSE") {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit cycle close logs. Reopen cycle instead." });
                }

                const oldAmount = typeof originalLog.amount === 'string' ? parseFloat(originalLog.amount) : originalLog.amount;
                const delta = input.newAmount - oldAmount;

                // 3.5 Safety Check: Prevent negative stock
                if (farmerData.mainStock + delta < 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `This correction would result in negative stock (${(farmerData.mainStock + delta).toFixed(1)} bags).`
                    });
                }

                if (delta === 0) return { success: true };

                // 4. Update Log
                await tx.update(stockLogs)
                    .set({
                        amount: input.newAmount.toString(),
                        note: input.note || originalLog.note,
                    })
                    .where(eq(stockLogs.id, input.logId));

                // 5. Update Farmer Stock by Delta
                await tx.update(farmer)
                    .set({
                        mainStock: sql`${farmer.mainStock} + ${delta}`,
                        updatedAt: new Date()
                    })
                    .where(eq(farmer.id, originalLog.farmerId!));

                // 6. NOTIFICATION
                try {
                    const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                    await NotificationService.sendToOrgManagers({
                        organizationId: farmerData.organizationId,
                        title: "Stock Log Edited",
                        message: `Officer ${ctx.user.name} edited a stock log for ${farmerData.name}. Amount changed from ${oldAmount} to ${input.newAmount}.`,
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

                    // Check if a correction for THIS transfer already exists
                    // We check if there's any CORRECTION log referencing this transferId
                    const [alreadyReverted] = await tx.select()
                        .from(stockLogs)
                        .where(and(eq(stockLogs.referenceId, input.referenceId), eq(stockLogs.type, "CORRECTION")));

                    if (alreadyReverted) {
                        throw new TRPCError({ code: "BAD_REQUEST", message: "This transfer has already been reverted." });
                    }

                    // Check Access
                    const farmerData = await tx.query.farmer.findFirst({
                        where: eq(farmer.id, log.farmerId!)
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
                            message: `Cannot revert this transfer. Farmer ${farmerData.name} would end up with negative stock (${(farmerData.mainStock + reverseAmount).toFixed(1)} bags).`
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

                    // B. Add Correction Log
                    await tx.insert(stockLogs).values({
                        farmerId: log.farmerId,
                        amount: reverseAmount.toString(),
                        type: "CORRECTION",
                        referenceId: log.referenceId,
                        note: input.note || `Revert Transfer: ${log.note || "Original Entry"}`,
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
});
