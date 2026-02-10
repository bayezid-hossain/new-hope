import { BASE_SELLING_PRICE } from "@/constants";
import { cycleLogs, cycles, farmer, member, saleEvents, saleReports } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { updateCycleFeed } from "@/modules/cycles/server/services/feed-service";
import { createTRPCRouter, proProcedure, protectedProcedure } from "../../init";

const officerProcedure = protectedProcedure;

// --- Shared Helpers for Metric Calculations ---
const calculateMetrics = (
    doc: number,
    mortality: number,
    totalWeight: number,
    feedConsumed: number, // in bags
    age: number,
    isEnded: boolean
) => {
    if (!isEnded) {
        return { fcr: 0, epi: 0 };
    }

    const survivors = doc - mortality;
    const survivalRate = doc > 0 ? (survivors / doc) * 100 : 0;
    const totalWeightKg = totalWeight;
    const feedKg = feedConsumed * 50; // 50kg per bag

    // FCR = Total Feed (kg) / Total Live Weight (kg)
    const fcr = totalWeightKg > 0 ? feedKg / totalWeightKg : 0;

    // EPI = (Survival % × Avg Weight kg) / (FCR × Age) × 100
    const avgWeightKg = survivors > 0 ? totalWeightKg / survivors : 0;
    const epi = (fcr > 0 && age > 0)
        ? (survivalRate * avgWeightKg) / (fcr * age) * 100
        : 0;

    return {
        fcr: parseFloat(fcr.toFixed(2)),
        epi: parseFloat(epi.toFixed(0))
    };
};

const getCycleStats = (events: any[]) => {
    const revenueMap = new Map<string, number>();
    const weightMap = new Map<string, number>();
    const birdsSoldMap = new Map<string, number>();
    const adjustmentsMap = new Map<string, number>();

    events.forEach(ev => {
        const key = ev.cycleId || ev.historyId || "unknown";
        const currentRevenue = revenueMap.get(key) || 0;
        const currentWeight = weightMap.get(key) || 0;
        const currentBirdsSold = birdsSoldMap.get(key) || 0;
        let currentAdjustment = adjustmentsMap.get(key) || 0;

        const price = parseFloat(ev.pricePerKg);
        revenueMap.set(key, currentRevenue + (parseFloat(ev.totalAmount) || 0));
        weightMap.set(key, currentWeight + (parseFloat(ev.totalWeight) || 0));
        birdsSoldMap.set(key, currentBirdsSold + (ev.birdsSold || 0));

        // Independent Price Adjustment Logic (Sum of all per-kg surpluses/deficits)
        const diff = price - BASE_SELLING_PRICE;
        if (diff > 0) {
            currentAdjustment += diff / 2;
        } else if (diff < 0) {
            currentAdjustment += diff;
        }
        adjustmentsMap.set(key, currentAdjustment);
    });

    return { revenueMap, weightMap, birdsSoldMap, adjustmentsMap };
};

// Feed item schema for dynamic arrays
const feedItemSchema = z.object({
    type: z.string().min(1, "Feed type is required"),
    bags: z.number().min(0, "Bags must be 0 or greater"),
});

// Sale event creation schema
const createSaleEventSchema = z.object({
    cycleId: z.string(),
    location: z.string().min(1, "Location is required"),
    party: z.string().optional(), // Buyer/party name
    saleDate: z.date().optional(),
    houseBirds: z.number().int().positive(),
    birdsSold: z.number().int().positive(),
    mortalityChange: z.number().int().default(0), // Removed .min(0) to allow corrections
    totalMortality: z.number().int().min(0),
    totalWeight: z.number().positive("Total weight must be greater than 0"),
    pricePerKg: z.number().positive("Price must be greater than 0"),
    cashReceived: z.number().min(0).default(0),
    depositReceived: z.number().min(0).default(0),
    feedConsumed: z.array(feedItemSchema).min(1, "At least one feed entry required"),
    feedStock: z.array(feedItemSchema),
    medicineCost: z.number().min(0).default(0),
    farmerMobile: z.string().min(1, "Mobile number is required"),
});

// ... (omitted unrelated implementations)

// Sale report generation schema
const generateReportSchema = z.object({
    saleEventId: z.string(),
    birdsSold: z.number().int().positive(),
    totalMortality: z.number().int().min(0).default(0),
    totalWeight: z.number().positive(),
    pricePerKg: z.number().positive(),
    adjustmentNote: z.string().optional(),
    location: z.string().optional(), // Allow adjusting location
    party: z.string().optional(),    // Allow adjusting party
    cashReceived: z.number().min(0).default(0),
    depositReceived: z.number().min(0).default(0),
    medicineCost: z.number().min(0).default(0),
    feedConsumed: z.array(feedItemSchema).optional(),
    feedStock: z.array(feedItemSchema).optional(),
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

            // DATE VALIDATION: Cannot sell before cycle started
            const effectiveSaleDate = input.saleDate || new Date();
            // Reset time components for comparison (compare dates only)
            const saleDateOnly = new Date(effectiveSaleDate);
            saleDateOnly.setHours(0, 0, 0, 0);

            const cycleStartDate = new Date(cycle.createdAt);
            cycleStartDate.setHours(0, 0, 0, 0);

            if (saleDateOnly < cycleStartDate) {
                throw new TRPCError({
                    code: "BAD_REQUEST",
                    message: `Sale date cannot be before cycle start date (${cycle.createdAt.toLocaleDateString()}).`
                });
            }

            // ACCESS LEVEL CHECK
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, cycle.organizationId)
                    )
                });

                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot record sales." });
                }
            }

            // Calculate remaining birds (Initial - Mortality - Already Sold)
            const remainingBirds = cycle.doc - cycle.mortality - cycle.birdsSold;
            // Note: If mortalityChange is negative (resurrection), remaining birds technically increases.
            // But we check if BIRDS SOLD > AVAILABLE. 
            // Available = Current Remaining. The mortality change happens "simultaneously" or we trust the user's manual "House Birds" context?
            // "House Birds" input is usually what the user counts. 
            // If user says 100 birds in house, but system thinks 90.
            // If user enters mortalityChange = -10 (restoring 10 birds), then system matches 100.
            // For safety, let's stick to system's current count for validation.

            if (input.birdsSold > remainingBirds) {
                // Special case: If mortalityChange is negative, maybe we have enough?
                // Effective Remaining = Remaining + (-mortalityChange)
                const effectiveRemaining = remainingBirds - (input.mortalityChange < 0 ? input.mortalityChange : 0);
                if (input.birdsSold > effectiveRemaining) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Cannot sell ${input.birdsSold} birds. Only ${effectiveRemaining} birds calculated as available.`,
                    });
                }
            }

            // Calculate averages and totals
            const avgWeight = input.totalWeight / input.birdsSold;
            const totalAmount = input.totalWeight * input.pricePerKg;

            const result = await ctx.db.transaction(async (tx) => {
                // 0. Auto-update farmer profile if location/mobile are missing
                const updates: Record<string, any> = {};
                if (!cycle.farmer.location && input.location) {
                    updates.location = input.location;
                }
                if (!cycle.farmer.mobile && input.farmerMobile) {
                    updates.mobile = input.farmerMobile;
                }

                if (Object.keys(updates).length > 0) {
                    await tx.update(farmer)
                        .set({ ...updates, updatedAt: new Date() })
                        .where(eq(farmer.id, cycle.farmerId));
                }

                // 1. Validate Mortality Floor
                const newMortality = cycle.mortality + input.mortalityChange;

                // Get Max Mortality from PREVIOUS Sale Events
                const [maxPrevSale] = await tx
                    .select({ totalMortality: saleEvents.totalMortality })
                    .from(saleEvents)
                    .where(eq(saleEvents.cycleId, input.cycleId))
                    .orderBy(desc(saleEvents.totalMortality))
                    .limit(1);

                const floor = maxPrevSale?.totalMortality || 0;

                if (newMortality < floor) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Cannot reduce total mortality to ${newMortality}. A previous sale report recorded ${floor} dead birds.`,
                    });
                }
                if (newMortality < 0) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Total mortality cannot be negative.`,
                    });
                }


                // Create sale event
                const [saleEvent] = await tx.insert(saleEvents).values({
                    cycleId: input.cycleId,
                    location: input.location,
                    party: input.party,
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
                    createdAt: input.saleDate || new Date(),
                }).returning();

                // Auto-generate first report with SAME values (Financials + Mortality included)
                await tx.insert(saleReports).values({
                    saleEventId: saleEvent.id,
                    birdsSold: input.birdsSold,
                    totalMortality: input.totalMortality,
                    totalWeight: input.totalWeight.toString(),
                    pricePerKg: input.pricePerKg.toString(),
                    totalAmount: totalAmount.toFixed(2),
                    avgWeight: avgWeight.toFixed(2),
                    cashReceived: input.cashReceived.toString(),
                    depositReceived: input.depositReceived.toString(),
                    medicineCost: input.medicineCost.toString(),
                    createdBy: ctx.user.id,
                    createdAt: input.saleDate || new Date(),
                });

                // Update cycle: add any new mortality and increment birdsSold
                // const newMortality calculated above
                const newBirdsSold = cycle.birdsSold + input.birdsSold;
                const currentIntake = input.feedConsumed.reduce((sum, item) => sum + item.bags, 0);

                await tx.update(cycles)
                    .set({
                        mortality: newMortality,
                        birdsSold: newBirdsSold,
                        // intake: currentIntake, // We no longer hard-override here, let updateCycleFeed handle the truth
                        updatedAt: new Date()
                    })
                    .where(eq(cycles.id, input.cycleId));

                // Recalculate Feed Intake based on new population status
                const [freshCycle] = await tx.select().from(cycles).where(eq(cycles.id, input.cycleId)).limit(1);
                if (freshCycle) {
                    await updateCycleFeed(
                        freshCycle,
                        ctx.user.id,
                        true, // Force update since population changed
                        tx,
                        `Sale Event Recorded. Recalculated total intake.`,
                        input.saleDate || new Date()
                    );
                }

                // Check if all birds are sold - if so, end the cycle
                const totalBirdsAfterMortality = cycle.doc - newMortality;
                let cycleEnded = false;
                let historyId: string | undefined = undefined;

                if (newBirdsSold >= totalBirdsAfterMortality) {
                    // MANUAL OVERRIDE: For the last sale, we use the input feed as the TOTAL cycle consumption
                    const manualTotalBags = currentIntake;

                    // Call shared end logic
                    const { endCycleLogic } = await import("@/modules/cycles/server/services/cycle-service");
                    const endResult = await endCycleLogic(tx, input.cycleId, manualTotalBags, ctx.user.id, ctx.user.name);

                    // Move sale events to history
                    await tx.update(saleEvents)
                        .set({ historyId: endResult.historyId, cycleId: null })
                        .where(eq(saleEvents.cycleId, input.cycleId));

                    cycleEnded = true;
                    historyId = endResult.historyId;
                }

                // Add SALES log entry
                await tx.insert(cycleLogs).values({
                    cycleId: cycleEnded ? null : input.cycleId,
                    historyId: cycleEnded ? historyId : null,
                    userId: ctx.user.id,
                    type: "SALES",
                    valueChange: input.birdsSold,
                    newValue: newBirdsSold,
                    previousValue: cycle.birdsSold,
                    note: `Sale recorded: ${input.birdsSold} birds at ৳${input.pricePerKg}/kg. Location: ${input.location}${cycleEnded ? " (Cycle Completed)" : ""}`,
                    createdAt: input.saleDate || new Date()
                });

                // Add MORTALITY log entry if changed
                if (input.mortalityChange !== 0) {
                    await tx.insert(cycleLogs).values({
                        cycleId: cycleEnded ? null : input.cycleId,
                        historyId: cycleEnded ? historyId : null,
                        userId: ctx.user.id,
                        type: "MORTALITY",
                        valueChange: input.mortalityChange,
                        newValue: newMortality,
                        previousValue: cycle.mortality,
                        note: `Mortality adjustment during sale.`,
                        createdAt: input.saleDate || new Date()
                    });
                }

                return { saleEvent, cycleEnded, historyId };
            });

            // Send Notification (Outside transaction for performance/reliability)
            try {
                const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                await NotificationService.sendToOrgManagers({
                    organizationId: cycle.organizationId,
                    type: "SALES",
                    title: "New Sale Recorded",
                    message: `${ctx.user.name} recorded a sale of ${input.birdsSold} birds for ${cycle.farmer.name}.`,
                    details: `Total weight: ${input.totalWeight}kg, Amount: ৳${totalAmount.toFixed(2)}`,
                    adminLink: `/admin/organizations/${cycle.organizationId}/sales`,
                    managementLink: `/management/reports`
                });
            } catch (err) {
                console.error("Failed to send sale notification:", err);
            }

            return result;
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

            // ACCESS LEVEL CHECK
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, farmerData.organizationId)
                    )
                });

                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot adjust sales." });
                }
            }

            // Calculate totals
            const avgWeight = input.totalWeight / input.birdsSold;
            const totalAmount = input.totalWeight * input.pricePerKg;

            const result = await ctx.db.transaction(async (tx) => {
                const [report] = await tx.insert(saleReports).values({
                    saleEventId: event.id,
                    birdsSold: input.birdsSold,
                    totalMortality: input.totalMortality,
                    totalWeight: input.totalWeight.toString(),
                    pricePerKg: input.pricePerKg.toString(),
                    totalAmount: (input.totalWeight * input.pricePerKg).toFixed(2),
                    avgWeight: avgWeight.toFixed(2),
                    cashReceived: input.cashReceived.toString(),
                    depositReceived: input.depositReceived.toString(),
                    medicineCost: input.medicineCost.toString(),
                    feedConsumed: JSON.stringify(input.feedConsumed),
                    feedStock: JSON.stringify(input.feedStock),
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
                        ...(input.location && { location: input.location }),
                        ...(input.party && { party: input.party }),
                        ...(input.feedConsumed && { feedConsumed: JSON.stringify(input.feedConsumed) }),
                        ...(input.feedStock && { feedStock: JSON.stringify(input.feedStock) }),
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

                        // Recalculate Feed Intake based on adjusted population
                        const [freshCycle] = await tx.select().from(cycles).where(eq(cycles.id, event.cycleId)).limit(1);
                        if (freshCycle) {
                            await updateCycleFeed(
                                freshCycle,
                                ctx.user.id,
                                true,
                                tx,
                                `Sale Report Adjusted. Recalculated total intake.`,
                                event.saleDate
                            );
                        }

                        // LOOPHOLE FIX: Auto-Close if adjustment clears the population
                        const [refetchedCycle] = await tx.select().from(cycles).where(eq(cycles.id, event.cycleId)).limit(1);
                        const remaining = (refetchedCycle?.doc || 0) - (refetchedCycle?.mortality || 0) - (refetchedCycle?.birdsSold || 0);
                        if (remaining <= 0) {
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
                                createdAt: event.saleDate
                            });
                        }

                        if (birdsSoldDifference !== 0) {
                            await tx.insert(cycleLogs).values({
                                cycleId: event.cycleId,
                                userId: ctx.user.id,
                                type: "SYSTEM",
                                valueChange: birdsSoldDifference,
                                note: `Sale Report Adjustment (Birds sold adjusted by: ${birdsSoldDifference})`,
                                createdAt: event.saleDate
                            });
                        }
                    }
                }

                // Add SALES log entry for adjustment
                await tx.insert(cycleLogs).values({
                    cycleId: event.cycleId,
                    historyId: event.historyId,
                    userId: ctx.user.id,
                    type: "SALES",
                    valueChange: birdsSoldDifference,
                    note: `Sale Adjustment Recorded: birds sold adjusted by ${birdsSoldDifference}. ${input.adjustmentNote || ""}`,
                    createdAt: event.saleDate
                });

                return { report, birdsSoldDifference };
            });

            // Send Notification (Outside transaction)
            try {
                const { NotificationService } = await import("@/modules/notifications/server/notification-service");
                await NotificationService.sendToOrgManagers({
                    organizationId: farmerData.organizationId,
                    type: "SALES",
                    title: "Sale Adjusted",
                    message: `${ctx.user.name} adjusted a sale for ${farmerData.name}.`,
                    details: input.adjustmentNote || `Birds adjusted by ${result.birdsSoldDifference}.`,
                    adminLink: `/admin/organizations/${farmerData.organizationId}/sales`,
                    managementLink: `/management/reports`
                });
            } catch (err) {
                console.error("Failed to send adjustment notification:", err);
            }

            return result.report;
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
                                            with: { createdByUser: { columns: { name: true } } },
                                            orderBy: desc(saleReports.createdAt),
                                            columns: {
                                                id: true,
                                                birdsSold: true,
                                                totalWeight: true,
                                                pricePerKg: true,
                                                totalAmount: true,
                                                avgWeight: true,
                                                totalMortality: true,
                                                cashReceived: true,
                                                depositReceived: true,
                                                medicineCost: true,
                                                adjustmentNote: true,
                                                feedConsumed: true,
                                                feedStock: true,
                                                createdAt: true,
                                            }
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
                                            with: { createdByUser: { columns: { name: true } } },
                                            orderBy: desc(saleReports.createdAt),
                                            columns: {
                                                id: true,
                                                birdsSold: true,
                                                totalWeight: true,
                                                pricePerKg: true,
                                                totalAmount: true,
                                                avgWeight: true,
                                                totalMortality: true,
                                                cashReceived: true,
                                                depositReceived: true,
                                                medicineCost: true,
                                                adjustmentNote: true,
                                                feedConsumed: true,
                                                feedStock: true,
                                                createdAt: true,
                                            }
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

                // Sort by saleDate descending, then createdAt descending
                events = allEvents.sort((a, b) => {
                    const dateDiff = new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
                    if (dateDiff !== 0) return dateDiff;
                    // Tie-breaker
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                });
            } else {
                const whereClause = input.cycleId
                    ? eq(saleEvents.cycleId, input.cycleId)
                    : eq(saleEvents.historyId, input.historyId!);

                events = await ctx.db.query.saleEvents.findMany({
                    where: whereClause,
                    orderBy: [desc(saleEvents.saleDate), desc(saleEvents.createdAt)],
                    with: {
                        reports: {
                            orderBy: desc(saleReports.createdAt),
                            with: { createdByUser: { columns: { name: true } } },
                            columns: {
                                id: true,
                                birdsSold: true,
                                totalWeight: true,
                                pricePerKg: true,
                                totalAmount: true,
                                avgWeight: true,
                                totalMortality: true,
                                cashReceived: true,
                                depositReceived: true,
                                medicineCost: true,
                                adjustmentNote: true,
                                feedConsumed: true,
                                feedStock: true,
                                createdAt: true,
                            }
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

            // Calculate cumulative revenue, weight AND independent price adjustments PER CYCLE/HISTORY
            const { revenueMap, weightMap, birdsSoldMap, adjustmentsMap } = getCycleStats(events);

            return events.map((e) => {
                const cycleOrHistory = e.cycle || e.history;
                const isEnded = !e.cycleId && !!e.historyId;
                const groupKey = e.cycleId || e.historyId || "unknown";

                // Get cycle context
                const doc = cycleOrHistory?.doc || 0;
                const mortality = cycleOrHistory?.mortality || 0;
                const age = cycleOrHistory?.age || 0;
                const feedConsumed = isEnded
                    ? (e.history?.finalIntake || 0)
                    : (e.cycle?.intake || 0);

                // Get cumulative totals
                const cumulativeRevenue = revenueMap.get(groupKey) || 0;
                const cumulativeWeight = weightMap.get(groupKey) || 0;
                const cumulativeBirdsSold = birdsSoldMap.get(groupKey) || 0;
                const netAdjustment = adjustmentsMap.get(groupKey) || 0;

                // Effective Rate = max(BASE_SELLING_PRICE, BASE_SELLING_PRICE + Net Adjustment)
                const effectiveRate = Math.max(BASE_SELLING_PRICE, BASE_SELLING_PRICE + netAdjustment);
                const formulaRevenue = effectiveRate * cumulativeWeight;

                // Calculate FCR/EPI
                const { fcr, epi } = calculateMetrics(doc, mortality, cumulativeWeight, feedConsumed, age, isEnded);

                return {
                    ...e,
                    feedConsumed: JSON.parse(e.feedConsumed) as { type: string; bags: number }[],
                    feedStock: JSON.parse(e.feedStock) as { type: string; bags: number }[],
                    cycleName: e.cycle?.name || e.history?.cycleName || "Unknown Batch",
                    farmerName: e.cycle?.farmer?.name || e.history?.farmer?.name || "Unknown Farmer",
                    cycleContext: {
                        doc,
                        mortality,
                        age,
                        feedConsumed,
                        isEnded,
                        fcr,
                        epi,
                        revenue: formulaRevenue, // Updated to use the formula revenue
                        actualRevenue: cumulativeRevenue,
                        totalWeight: cumulativeWeight,
                        cumulativeBirdsSold,
                        effectiveRate,
                        netAdjustment
                    }
                };
            });
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
                columns: {
                    id: true,
                    birdsSold: true,
                    totalWeight: true,
                    pricePerKg: true,
                    totalAmount: true,
                    avgWeight: true,
                    totalMortality: true,
                    cashReceived: true,
                    depositReceived: true,
                    medicineCost: true,
                    adjustmentNote: true,
                    feedConsumed: true,
                    feedStock: true,
                    createdAt: true,
                    createdBy: true,
                    saleEventId: true,
                }
            });
        }),

    // Get Recent Sales Feed (Aggregated)
    getRecentSales: proProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(20),
            search: z.string().optional()
        }))
        .query(async ({ ctx, input }) => {
            // Fetch sales created by the officer
            // Note: If scale becomes an issue (thousands of sales), we need to add farmerId to saleEvents or use a more complex join.
            // For now, fetching recent 100 or so and filtering is "okay" given standard officer limits,
            // BUT for correct search we should probably select all matching the officer, then filter.
            // Since Drizzle 'findMany' with 'where' on deep relations is tricky, we'll fetch a larger set if searching,
            // or just rely on 'createdBy' index which should be fast.

            const events = await ctx.db.query.saleEvents.findMany({
                where: eq(saleEvents.createdBy, ctx.user.id),
                orderBy: desc(saleEvents.saleDate),
                // If searching, we might need to fetch more to find matches, but for safety let's cap at 200 then filter
                limit: input.search ? 200 : input.limit,
                with: {
                    cycle: { with: { farmer: true } },
                    history: { with: { farmer: true } },
                    reports: {
                        with: { createdByUser: { columns: { name: true } } },
                        orderBy: desc(saleReports.createdAt),
                        columns: {
                            id: true,
                            birdsSold: true,
                            totalWeight: true,
                            pricePerKg: true,
                            totalAmount: true,
                            avgWeight: true,
                            totalMortality: true,
                            cashReceived: true,
                            depositReceived: true,
                            medicineCost: true,
                            adjustmentNote: true,
                            feedConsumed: true,
                            feedStock: true,
                            createdAt: true,
                        }
                    }
                }
            });

            // Fetch cumulative data for these cycles to calculate correct metrics
            const cycleIds = [...new Set(events.map(e => e.cycleId).filter(Boolean))] as string[];
            const historyIds = [...new Set(events.map(e => e.historyId).filter(Boolean))] as string[];

            const allCycleEvents = await ctx.db.query.saleEvents.findMany({
                where: or(
                    cycleIds.length > 0 ? inArray(saleEvents.cycleId, cycleIds) : undefined,
                    historyIds.length > 0 ? inArray(saleEvents.historyId, historyIds) : undefined
                )
            });

            const { revenueMap, weightMap, birdsSoldMap, adjustmentsMap } = getCycleStats(allCycleEvents);

            let formattedEvents = events.map(e => {
                const cycleOrHistory = e.cycle || e.history;
                const isEnded = !e.cycleId && !!e.historyId;
                const groupKey = e.cycleId || e.historyId || "unknown";

                const doc = cycleOrHistory?.doc || 0;
                const mortality = cycleOrHistory?.mortality || 0;
                const age = cycleOrHistory?.age || 0;
                const feedConsumed = isEnded
                    ? (e.history?.finalIntake || 0)
                    : (e.cycle?.intake || 0);

                // Get cumulative totals
                const cumulativeRevenue = revenueMap.get(groupKey) || 0;
                const cumulativeWeight = weightMap.get(groupKey) || 0;
                const cumulativeBirdsSold = birdsSoldMap.get(groupKey) || 0;
                const netAdjustment = adjustmentsMap.get(groupKey) || 0;

                // Effective Rate = max(BASE_SELLING_PRICE, BASE_SELLING_PRICE + Net Adjustment)
                const effectiveRate = Math.max(BASE_SELLING_PRICE, BASE_SELLING_PRICE + netAdjustment);
                const formulaRevenue = effectiveRate * cumulativeWeight;

                // Calculate FCR/EPI
                const { fcr, epi } = calculateMetrics(doc, mortality, cumulativeWeight, feedConsumed, age, isEnded);

                return {
                    ...e,
                    feedConsumed: JSON.parse(e.feedConsumed) as { type: string; bags: number }[],
                    feedStock: JSON.parse(e.feedStock) as { type: string; bags: number }[],
                    cycleName: e.cycle?.name || e.history?.cycleName || "Unknown Batch",
                    farmerName: e.cycle?.farmer?.name || e.history?.farmer?.name || "Unknown Farmer",
                    cycleContext: {
                        doc,
                        mortality,
                        age,
                        feedConsumed,
                        isEnded,
                        fcr,
                        epi,
                        revenue: formulaRevenue,
                        actualRevenue: cumulativeRevenue,
                        totalWeight: cumulativeWeight,
                        cumulativeBirdsSold,
                        effectiveRate,
                        netAdjustment
                    }
                };
            });

            // In-memory Filter for Search
            if (input.search) {
                const searchLower = input.search.toLowerCase();
                formattedEvents = formattedEvents.filter(e =>
                    e.farmerName.toLowerCase().includes(searchLower) ||
                    e.location.toLowerCase().includes(searchLower) ||
                    (e.party && e.party.toLowerCase().includes(searchLower))
                );
            }

            // Apply limit after filtering
            return formattedEvents.slice(0, input.limit);
        }),
});
