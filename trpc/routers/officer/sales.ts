import { cycleLogs, cycles, farmer, saleEvents, saleReports } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, proProcedure, protectedProcedure } from "../../init";

const officerProcedure = protectedProcedure;

// Feed item schema for dynamic arrays
const feedItemSchema = z.object({
    type: z.string().min(1, "Feed type is required"),
    bags: z.number().min(0, "Bags must be 0 or greater"),
});

// Sale event creation schema
const createSaleEventSchema = z.object({
    cycleId: z.string(),
    location: z.string().min(1, "Location is required"),
    saleDate: z.date().optional(),
    houseBirds: z.number().int().positive(),
    birdsSold: z.number().int().positive(),
    mortalityChange: z.number().int().min(0).default(0),
    totalMortality: z.number().int().min(0),
    totalWeight: z.number().positive("Total weight must be greater than 0"),
    pricePerKg: z.number().positive("Price must be greater than 0"),
    cashReceived: z.number().min(0).default(0),
    depositReceived: z.number().min(0).default(0),
    feedConsumed: z.array(feedItemSchema).min(1, "At least one feed entry required"),
    feedStock: z.array(feedItemSchema),
    medicineCost: z.number().min(0).default(0),
});

// Sale report generation schema
const generateReportSchema = z.object({
    saleEventId: z.string(),
    birdsSold: z.number().int().positive(),
    totalMortality: z.number().int().min(0).default(0),
    totalWeight: z.number().positive(),
    pricePerKg: z.number().positive(),
    adjustmentNote: z.string().optional(),
    cashReceived: z.number().min(0).default(0),
    depositReceived: z.number().min(0).default(0),
    medicineCost: z.number().min(0).default(0),
});

export const officerSalesRouter = createTRPCRouter({
    // Create a new sale event
    createSaleEvent: proProcedure
        .input(createSaleEventSchema)
        .mutation(async ({ ctx, input }) => {
            // Get cycle and verify ownership
            const cycle = await ctx.db.query.cycles.findFirst({
                where: eq(cycles.id, input.cycleId),
                with: { farmer: true },
            });

            if (!cycle) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
            }

            if (!cycle.farmer || cycle.farmer.officerId !== ctx.user.id) {
                throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to sell from this cycle" });
            }

            if (cycle.farmer.status !== "active") {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot sell from an archived farmer" });
            }

            // Calculate remaining birds (Initial - Mortality - Already Sold)
            const remainingBirds = cycle.doc - cycle.mortality - cycle.birdsSold;
            if (input.birdsSold > remainingBirds) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Cannot sell ${input.birdsSold} birds. Only ${remainingBirds} birds remaining.`,
                });
            }

            // Calculate averages and totals
            const avgWeight = input.totalWeight / input.birdsSold;
            const totalAmount = input.totalWeight * input.pricePerKg;

            return await ctx.db.transaction(async (tx) => {
                // Create sale event
                const [saleEvent] = await tx.insert(saleEvents).values({
                    cycleId: input.cycleId,
                    location: input.location,
                    saleDate: input.saleDate || new Date(),
                    houseBirds: input.houseBirds,
                    birdsSold: input.birdsSold,
                    totalMortality: input.totalMortality,
                    totalWeight: input.totalWeight.toString(),
                    avgWeight: avgWeight.toFixed(2),
                    pricePerKg: input.pricePerKg.toString(),
                    totalAmount: totalAmount.toFixed(2),
                    cashReceived: input.cashReceived.toString(),
                    depositReceived: input.depositReceived.toString(),
                    feedConsumed: JSON.stringify(input.feedConsumed),
                    feedStock: JSON.stringify(input.feedStock),
                    medicineCost: input.medicineCost.toString(),
                    createdBy: ctx.user.id,
                }).returning();

                // Auto-generate first report with SAME values (Financials + Mortality included)
                await tx.insert(saleReports).values({
                    saleEventId: saleEvent.id,
                    birdsSold: input.birdsSold,
                    totalMortality: input.totalMortality, // Added
                    totalWeight: input.totalWeight.toString(),
                    pricePerKg: input.pricePerKg.toString(),
                    totalAmount: totalAmount.toFixed(2),
                    avgWeight: avgWeight.toFixed(2),
                    cashReceived: input.cashReceived.toString(), // Added
                    depositReceived: input.depositReceived.toString(), // Added
                    medicineCost: input.medicineCost.toString(), // Added
                    createdBy: ctx.user.id,
                });

                // Update cycle: add any new mortality and increment birdsSold
                const newMortality = cycle.mortality + (input.mortalityChange || 0);
                const newBirdsSold = cycle.birdsSold + input.birdsSold;

                await tx.update(cycles)
                    .set({
                        mortality: newMortality,
                        birdsSold: newBirdsSold,
                        updatedAt: new Date()
                    })
                    .where(eq(cycles.id, input.cycleId));

                // REFRESH: Immediately recalculate feed requirement for the new population
                const { updateCycleFeed } = await import("@/modules/cycles/server/services/feed-service");
                await updateCycleFeed(
                    { ...cycle, mortality: newMortality, birdsSold: newBirdsSold },
                    ctx.user.id,
                    true, // forceUpdate
                    tx,   // pass transaction
                    `Sale recorded: ${input.birdsSold} birds.`
                );

                // Check if all birds are sold - if so, end the cycle
                const totalBirdsAfterMortality = cycle.doc - newMortality;

                if (newBirdsSold >= totalBirdsAfterMortality) {
                    // Fetch the updated cycle (mostly for debugging/logging context if needed)
                    // const [updatedCycle] = await tx.select().from(cycles).where(eq(cycles.id, input.cycleId)).limit(1);

                    // MANUAL OVERRIDE: For the last sale, we use the input feed as the TOTAL cycle consumption
                    // Logic: User inputs the "Final Total Consumption" in the UI.
                    const manualTotalBags = input.feedConsumed.reduce((sum, item) => sum + item.bags, 0);

                    // Call shared end logic
                    const { endCycleLogic } = await import("@/modules/cycles/server/services/cycle-service");
                    // Pass manualTotalBags as the final intake to deduct from stock
                    const endResult = await endCycleLogic(tx, input.cycleId, manualTotalBags, ctx.user.id, ctx.user.name);

                    // Move sale events to history
                    await tx.update(saleEvents)
                        .set({ historyId: endResult.historyId, cycleId: null })
                        .where(eq(saleEvents.cycleId, input.cycleId));

                    return { saleEvent, cycleEnded: true, historyId: endResult.historyId };
                }

                return { saleEvent, cycleEnded: false };
            });
        }),

    // Generate additional report for a sale event
    generateReport: proProcedure
        .input(generateReportSchema)
        .mutation(async ({ ctx, input }) => {
            // Verify sale event exists and user has access
            const event = await ctx.db.query.saleEvents.findFirst({
                where: eq(saleEvents.id, input.saleEventId),
                with: {
                    cycle: { with: { farmer: true } },
                    history: { with: { farmer: true } },
                },
            });

            if (!event) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Sale event not found" });
            }

            // Check ownership via cycle or history
            const farmerData = event.cycle?.farmer || event.history?.farmer;
            if (!farmerData || farmerData.officerId !== ctx.user.id) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
            }

            // Calculate totals
            const avgWeight = input.totalWeight / input.birdsSold;
            const totalAmount = input.totalWeight * input.pricePerKg;

            return await ctx.db.transaction(async (tx) => {
                const [report] = await tx.insert(saleReports).values({
                    saleEventId: input.saleEventId,
                    birdsSold: input.birdsSold,
                    totalMortality: input.totalMortality,
                    totalWeight: input.totalWeight.toString(),
                    pricePerKg: input.pricePerKg.toString(),
                    totalAmount: totalAmount.toFixed(2),
                    avgWeight: avgWeight.toFixed(2),

                    cashReceived: input.cashReceived.toString(),
                    depositReceived: input.depositReceived.toString(),
                    medicineCost: input.medicineCost.toString(),

                    adjustmentNote: input.adjustmentNote,
                    createdBy: ctx.user.id,
                }).returning();

                // 1. SYNC PARENT SUMMARY (SaleEvents)
                // Keep the parent record updated with the latest verson's summary data
                await tx.update(saleEvents)
                    .set({
                        birdsSold: input.birdsSold,
                        totalMortality: input.totalMortality,
                        totalWeight: input.totalWeight.toString(),
                        avgWeight: avgWeight.toFixed(2),
                        pricePerKg: input.pricePerKg.toString(),
                        totalAmount: totalAmount.toFixed(2),
                        cashReceived: input.cashReceived.toString(),
                        depositReceived: input.depositReceived.toString(),
                        medicineCost: input.medicineCost.toString(),
                    })
                    .where(eq(saleEvents.id, input.saleEventId));

                // 2. INVENTORY SYNC LOGIC (Cycles Table)
                const latestReports = await tx.query.saleReports.findMany({
                    where: eq(saleReports.saleEventId, input.saleEventId),
                    orderBy: desc(saleReports.createdAt),
                    limit: 2, // Get current (just inserted) and previous
                });

                // Determine differences
                let previousMortality = event.totalMortality;
                let previousBirdsSold = event.birdsSold;

                if (latestReports.length > 1) {
                    previousMortality = latestReports[1].totalMortality || 0;
                    previousBirdsSold = latestReports[1].birdsSold || 0;
                }

                const mortalityDifference = input.totalMortality - previousMortality;
                const birdsSoldDifference = input.birdsSold - previousBirdsSold;

                if ((mortalityDifference !== 0 || birdsSoldDifference !== 0) && event.cycleId) {
                    const [activeCycle] = await tx.select().from(cycles).where(eq(cycles.id, event.cycleId));

                    if (activeCycle) {
                        const newMortality = activeCycle.mortality + mortalityDifference;
                        const newBirdsSold = activeCycle.birdsSold + birdsSoldDifference;

                        // LOOPHOLE FIX: Population Safety Check
                        if (newMortality + newBirdsSold > activeCycle.doc) {
                            throw new TRPCError({
                                code: "BAD_REQUEST",
                                message: `Adjustment rejected. Total dead/sold (${newMortality + newBirdsSold}) would exceed initial birds (${activeCycle.doc}).`
                            });
                        }

                        // Update cycle counts
                        await tx.update(cycles)
                            .set({
                                mortality: newMortality,
                                birdsSold: newBirdsSold,
                                updatedAt: new Date()
                            })
                            .where(eq(cycles.id, event.cycleId));

                        // LOOPHOLE FIX: Force intake recalculation if population was adjusted
                        const { updateCycleFeed } = await import("@/modules/cycles/server/services/feed-service");
                        await updateCycleFeed(
                            { ...activeCycle, mortality: newMortality, birdsSold: newBirdsSold },
                            ctx.user.id,
                            true, // forceUpdate
                            tx,
                            `Sale Adjustment: Corrected birds sold to ${newBirdsSold} and mortality to ${newMortality}.`
                        );

                        // LOOPHOLE FIX: Auto-Close if adjustment clears the population
                        const remaining = activeCycle.doc - newMortality - newBirdsSold;
                        if (remaining <= 0) {
                            const [refetchedCycle] = await tx.select().from(cycles).where(eq(cycles.id, event.cycleId)).limit(1);
                            const { endCycleLogic } = await import("@/modules/cycles/server/services/cycle-service");
                            await endCycleLogic(tx, event.cycleId, refetchedCycle?.intake || 0, ctx.user.id, ctx.user.name);
                        }

                        // Log the system adjustment
                        if (mortalityDifference !== 0) {
                            await tx.insert(cycleLogs).values({
                                cycleId: event.cycleId,
                                userId: ctx.user.id,
                                type: "MORTALITY",
                                valueChange: mortalityDifference,
                                note: `Sale Report Adjustment (Mortality change: ${mortalityDifference})`,
                            });
                        }

                        if (birdsSoldDifference !== 0) {
                            await tx.insert(cycleLogs).values({
                                cycleId: event.cycleId,
                                userId: ctx.user.id,
                                type: "SYSTEM",
                                valueChange: birdsSoldDifference,
                                note: `Sale Report Adjustment (Birds sold adjusted by: ${birdsSoldDifference})`,
                            });
                        }
                    }
                }

                return report;
            });
        }),

    // Get sale events for a cycle or farmer
    getSaleEvents: proProcedure
        .input(z.object({
            cycleId: z.string().optional(),
            historyId: z.string().optional(),
            farmerId: z.string().optional()
        }))
        .query(async ({ ctx, input }) => {
            if (!input.cycleId && !input.historyId && !input.farmerId) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Either cycleId, historyId or farmerId required" });
            }

            let events;

            if (input.farmerId) {
                // Fetch farmer with all its linked sales via cycles and history using Relation API
                const farmerData = await ctx.db.query.farmer.findFirst({
                    where: eq(farmer.id, input.farmerId),
                    with: {
                        cycles: {
                            with: {
                                saleEvents: {
                                    with: {
                                        reports: {
                                            orderBy: desc(saleReports.createdAt),
                                            with: { createdByUser: { columns: { name: true } } }
                                        },
                                        createdByUser: { columns: { name: true } },
                                        cycle: {
                                            with: { farmer: { columns: { name: true } } }
                                        },
                                        history: {
                                            with: { farmer: { columns: { name: true } } }
                                        }
                                    }
                                }
                            }
                        },
                        history: {
                            with: {
                                saleEvents: {
                                    with: {
                                        reports: {
                                            orderBy: desc(saleReports.createdAt),
                                            with: { createdByUser: { columns: { name: true } } }
                                        },
                                        createdByUser: { columns: { name: true } },
                                        cycle: {
                                            with: { farmer: { columns: { name: true } } }
                                        },
                                        history: {
                                            with: { farmer: { columns: { name: true } } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                });

                if (!farmerData) return [];

                // Flatten all sale events from both active cycles and history records
                const allEvents = [
                    ...(farmerData.cycles?.flatMap(c => c.saleEvents) || []),
                    ...(farmerData.history?.flatMap(h => h.saleEvents) || [])
                ];

                // Sort by saleDate descending
                events = allEvents.sort((a, b) =>
                    new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
                );
            } else {
                const whereClause = input.cycleId
                    ? eq(saleEvents.cycleId, input.cycleId)
                    : eq(saleEvents.historyId, input.historyId!);

                events = await ctx.db.query.saleEvents.findMany({
                    where: whereClause,
                    orderBy: desc(saleEvents.saleDate),
                    with: {
                        reports: {
                            orderBy: desc(saleReports.createdAt),
                            with: { createdByUser: { columns: { name: true } } }
                        },
                        createdByUser: {
                            columns: { name: true },
                        },
                        cycle: {
                            with: { farmer: { columns: { name: true } } }
                        },
                        history: {
                            with: { farmer: { columns: { name: true } } }
                        }
                    },
                });
            }

            return events.map((e) => ({
                ...e,
                feedConsumed: JSON.parse(e.feedConsumed) as { type: string; bags: number }[],
                feedStock: JSON.parse(e.feedStock) as { type: string; bags: number }[],
                cycleName: e.cycle?.name || e.history?.cycleName || "Unknown Batch",
                farmerName: e.cycle?.farmer?.name || e.history?.farmer?.name || "Unknown Farmer"
            }));
        }),

    // Get reports for a sale event
    getReports: proProcedure
        .input(z.object({ saleEventId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db.query.saleReports.findMany({
                where: eq(saleReports.saleEventId, input.saleEventId),
                orderBy: desc(saleReports.createdAt),
                with: {
                    createdByUser: {
                        columns: { name: true },
                    },
                },
            });
        }),
});
