import { farmer, stockLogs } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
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
            amount: z.number().positive(),
            note: z.string().optional()
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
            });
        }),

    // DEDUCT STOCK (Manual Correction)
    deductStock: protectedProcedure
        .input(z.object({
            farmerId: z.string(),
            amount: z.number().positive(),
            note: z.string().optional()
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
            });
        }),

    // TRANSFER STOCK (Officer to Officer)
    transferStock: protectedProcedure
        .input(z.object({
            sourceFarmerId: z.string(),
            targetFarmerId: z.string(),
            amount: z.number().positive(),
            note: z.string().optional()
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

                // 2. Check Ownership via Farmer
                const farmerData = await tx.query.farmer.findFirst({
                    where: and(eq(farmer.id, originalLog.farmerId!), eq(farmer.officerId, ctx.user.id))
                });
                if (!farmerData) throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage this farmer." });

                // 3. Preventive Checks
                if (originalLog.type === "CYCLE_CLOSE") {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot revert a Cycle Close log directly. Please reopen the cycle from the History tab."
                    });
                }
                if (originalLog.type === "CORRECTION") {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: "Cannot revert a correction. Please make a new manual entry instead."
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

                // 2. Check Ownership
                const farmerData = await tx.query.farmer.findFirst({
                    where: and(eq(farmer.id, originalLog.farmerId!), eq(farmer.officerId, ctx.user.id))
                });
                if (!farmerData) throw new TRPCError({ code: "FORBIDDEN" });

                // 3. Preventive Checks
                if (originalLog.type === "CYCLE_CLOSE") {
                    throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot edit cycle close logs. Reopen cycle instead." });
                }

                const oldAmount = typeof originalLog.amount === 'string' ? parseFloat(originalLog.amount) : originalLog.amount;
                const delta = input.newAmount - oldAmount;

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

                // 6. Log a system note about the correction?
                // For now, updating the record is cleaner as per "correct box" request.

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

                    // Check if the user managed this farmer
                    const farmerData = await tx.query.farmer.findFirst({
                        where: and(eq(farmer.id, log.farmerId!), eq(farmer.officerId, ctx.user.id))
                    });
                    if (!farmerData) {
                        throw new TRPCError({ code: "FORBIDDEN", message: "You do not manage one or more farmers in this transfer." });
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

                return { success: true };
            });
        }),
});
