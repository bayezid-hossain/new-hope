import { BASE_SELLING_PRICE, DOC_PRICE_PER_BIRD, FEED_PRICE_PER_BAG } from "@/constants";
import { cycleHistory, cycleLogs, cycles, farmer, member, saleEvents, saleMetrics, saleReports } from "@/db/schema";


import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, like, ne, or, sql } from "drizzle-orm";
import { z } from "zod";

import { updateCycleFeed } from "@/modules/cycles/server/services/feed-service";
import { SaleMetricsService } from "@/modules/reports/server/services/sale-metrics-service";
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
    const totalBirdDaysMap = new Map<string, number>();
    const MS_PER_DAY = 1000 * 60 * 60 * 24;

    events.forEach(ev => {
        const key = ev.cycleId || ev.historyId || "unknown";
        const currentRevenue = revenueMap.get(key) || 0;
        const currentWeight = weightMap.get(key) || 0;
        const currentBirdsSold = birdsSoldMap.get(key) || 0;
        const currentBirdDays = totalBirdDaysMap.get(key) || 0;

        const selectedData = ev.selectedReport || ev;
        revenueMap.set(key, currentRevenue + (parseFloat(selectedData.totalAmount) || 0));
        weightMap.set(key, currentWeight + (parseFloat(selectedData.totalWeight) || 0));
        birdsSoldMap.set(key, currentBirdsSold + (selectedData.birdsSold || 0));

        // Use the explicitly locked sale age if available, otherwise fallback dynamically
        // Prefer report-level age (selectedReport.age) over raw event age
        const ageAtSale = selectedData.age ?? ev.age ?? (() => {
            const cycleStartDate = ev.cycle?.createdAt || ev.history?.startDate || ev.history?.createdAt;
            if (cycleStartDate) {
                const saleDate = new Date(ev.saleDate);
                const cycleStart = new Date(cycleStartDate);
                saleDate.setHours(0, 0, 0, 0);
                cycleStart.setHours(0, 0, 0, 0);
                const diffTime = saleDate.getTime() - cycleStart.getTime();
                return Math.max(1, Math.round(diffTime / MS_PER_DAY) + 1);
            }
            return 0;
        })();

        if (ageAtSale > 0) {
            totalBirdDaysMap.set(key, currentBirdDays + ((selectedData.birdsSold || 0) * ageAtSale));
        }

    });

    const ageMap = new Map<string, number>();
    birdsSoldMap.forEach((totalBirds, key) => {
        const birdDays = totalBirdDaysMap.get(key) || 0;
        ageMap.set(key, totalBirds > 0 ? Number((birdDays / totalBirds).toFixed(2)) : 0);
    });
    // //console.logageMap)
    return { revenueMap, weightMap, birdsSoldMap, ageMap };
};

const getCycleStatsWithMortality = (events: any[]) => {
    const stats = getCycleStats(events);
    const latestMortalityMap = new Map<string, number>();
    const latestDateMap = new Map<string, Date>();

    events.forEach(ev => {
        const key = ev.cycleId || ev.historyId || "unknown";
        const saleDate = new Date(ev.saleDate);
        const existingDate = latestDateMap.get(key);

        if (!existingDate || saleDate >= existingDate) {
            latestDateMap.set(key, saleDate);
            // Use the mortality stored on the event (which is synced from selected report)
            latestMortalityMap.set(key, ev.totalMortality);
        }
    });

    return { ...stats, latestMortalityMap };
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
    recoveryPrice: z.number().positive().optional(),
    feedPricePerBag: z.number().positive().optional(),
    docPricePerBird: z.number().positive().optional(),
    officialInputDate: z.date().optional(),
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
    recoveryPrice: z.number().positive().optional(),
    feedPricePerBag: z.number().positive().optional(),
    docPricePerBird: z.number().positive().optional(),
    saleAge: z.number().int().positive().optional(),
    saleDate: z.date().optional(),
    officialInputDate: z.date().optional(),
    historyId: z.string().optional().nullable(),
});

// Helper to count bags from feed JSON
const countFeedBags = (feedJson: string | null | undefined): number => {
    if (!feedJson) return 0;
    try {
        const items = JSON.parse(feedJson) as { bags: number }[];
        if (!Array.isArray(items)) return 0;
        return items.reduce((sum, item) => sum + (Number(item.bags) || 0), 0);
    } catch {
        return 0;
    }
};

const getFeedFromEvent = (evt: any) => {
    // 1. If a report is selected, use it
    if (evt.selectedReportId && evt.reports) {
        const report = evt.reports.find((r: any) => r.id === evt.selectedReportId);
        if (report) {
            return countFeedBags(report.feedConsumed);
        }
    }
    // 2. Fallback to event's own data
    return countFeedBags(evt.feedConsumed);
};

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

            // DATE VALIDATION: Check if implied start date is before actual start date
            const effectiveSaleDate = input.saleDate || new Date();
            const saleDateOnly = new Date(effectiveSaleDate);
            saleDateOnly.setHours(0, 0, 0, 0);

            const cycleStartDate = new Date(cycle.createdAt);
            cycleStartDate.setHours(0, 0, 0, 0);

            const MS_PER_DAY = 1000 * 60 * 60 * 24;
            const saleAgeToUse = cycle.age;
            const impliedStartMs = saleDateOnly.getTime() - ((saleAgeToUse - 1) * MS_PER_DAY);
            const impliedStartDate = new Date(impliedStartMs);
            impliedStartDate.setHours(0, 0, 0, 0);

            let daysToBackdate = 0;
            if (impliedStartDate < cycleStartDate) {
                const diffMs = cycleStartDate.getTime() - impliedStartDate.getTime();
                daysToBackdate = Math.round(diffMs / MS_PER_DAY);
            }

            // ACCESS LEVEL CHECK
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(
                        eq(member.userId, ctx.user.id),
                        eq(member.organizationId, cycle.organizationId)
                    )
                });

                if (membership?.role === "MANAGER" && membership.accessLevel === "VIEW" && membership.activeMode == "MANAGEMENT") {
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot record sales." });
                }
            }

            // (Validation moved inside transaction with lock to prevent race conditions)

            // Calculate averages and totals
            const avgWeight = input.totalWeight / input.birdsSold;
            const totalAmount = input.totalWeight * input.pricePerKg;

            const result = await ctx.db.transaction(async (tx) => {
                // LOCK THE CYCLE RECORD to prevent race conditions during concurrent sales
                const [lockedCycle] = await tx
                    .select()
                    .from(cycles)
                    .where(eq(cycles.id, input.cycleId))
                    .for("update");

                if (!lockedCycle) {
                    throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found during transaction" });
                }

                // RE-VALIDATE BIRD COUNT INSIDE LOCK
                const currentRemaining = lockedCycle.doc - lockedCycle.mortality - lockedCycle.birdsSold;
                const effectiveRemaining = currentRemaining - (input.mortalityChange < 0 ? input.mortalityChange : 0);

                if (input.birdsSold > effectiveRemaining) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Cannot sell ${input.birdsSold} birds. Only ${effectiveRemaining} birds available based on latest records.`,
                    });
                }

                // Final safety check: Total birds accounted for cannot exceed initial intake
                const totalAccounted = (lockedCycle.birdsSold + input.birdsSold) + (lockedCycle.mortality + input.mortalityChange);
                if (totalAccounted > lockedCycle.doc) {
                    throw new TRPCError({
                        code: "BAD_REQUEST",
                        message: `Invalid transaction: Total birds (${totalAccounted}) would exceed initial intake (${lockedCycle.doc}).`,
                    });
                }

                // AUTO-BACKDATE CYCLE AND ALL RELATED LOGS
                if (daysToBackdate > 0) {
                    const intervalExpr = sql`interval '${sql.raw(String(daysToBackdate))} days'`;

                    // Shift active cycle createdAt, officialInputDate and increment age
                    await tx.update(cycles)
                        .set({
                            createdAt: sql`${cycles.createdAt} - ${intervalExpr}`,
                            // officialInputDate: sql`${cycles.officialInputDate} - ${intervalExpr}`,
                            age: sql`${cycles.age} + ${daysToBackdate}`
                        })
                        .where(eq(cycles.id, input.cycleId));

                    // Shift cycle_logs createdAt
                    await tx.update(cycleLogs)
                        .set({ createdAt: sql`${cycleLogs.createdAt} - ${intervalExpr}` })
                        .where(eq(cycleLogs.cycleId, input.cycleId));

                    // Shift sale_events saleDate and createdAt
                    const affectedSaleEvents = await tx.select({ id: saleEvents.id })
                        .from(saleEvents)
                        .where(eq(saleEvents.cycleId, input.cycleId));

                    if (affectedSaleEvents.length > 0) {
                        await tx.update(saleEvents)
                            .set({
                                saleDate: sql`${saleEvents.saleDate} - ${intervalExpr}`,
                                createdAt: sql`${saleEvents.createdAt} - ${intervalExpr}`,
                            })
                            .where(eq(saleEvents.cycleId, input.cycleId));

                        // Shift sale_reports createdAt
                        const saleEventIds = affectedSaleEvents.map(e => e.id);
                        if (saleEventIds.length > 0) {
                            await tx.update(saleReports)
                                .set({ createdAt: sql`${saleReports.createdAt} - ${intervalExpr}` })
                                .where(sql`${saleReports.saleEventId} IN ${saleEventIds}`);
                        }
                    }

                    // Insert a SYSTEM log noting the backdate
                    await tx.insert(cycleLogs).values({
                        cycleId: input.cycleId,
                        userId: ctx.user.id,
                        type: "SYSTEM",
                        valueChange: 0,
                        note: `Cycle auto-backdated by ${daysToBackdate} day(s) to match sale age. History shifted.`,
                    });
                }

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
                const newMortality = lockedCycle.mortality + input.mortalityChange;

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


                // Create sale event — age is the cycle's current age, NOT derived from dates
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
                    age: saleAgeToUse,
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

                // Auto-generate first report with SAME values (including feed data)
                const [firstReport] = await tx.insert(saleReports).values({
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
                    feedConsumed: JSON.stringify(input.feedConsumed),
                    feedStock: JSON.stringify(input.feedStock),
                    age: saleAgeToUse,
                    saleDate: input.saleDate || new Date(),
                    officialInputDate: input.officialInputDate || cycle.officialInputDate || cycle.createdAt,
                    createdBy: ctx.user.id,
                    createdAt: new Date(),
                }).returning();

                // Set selectedReportId on the parent event
                await tx.update(saleEvents)
                    .set({ selectedReportId: firstReport.id })
                    .where(eq(saleEvents.id, saleEvent.id));

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
                    // If a specific saleDate is specified and we close the cycle because of this sale, the cycle effectively ended on that saleDate.
                    const endResult = await endCycleLogic(tx, input.cycleId, manualTotalBags, ctx.user.id, ctx.user.name, input.saleDate, saleAgeToUse);

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

                // Recalculate metrics for this cycle/history
                await SaleMetricsService.recalculateForCycle(input.cycleId, historyId, tx, input.recoveryPrice, input.feedPricePerBag, input.docPricePerBird);

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

            // Visibility Restriction: Non-admins don't see deleted farmers' data
            if (ctx.user.globalRole !== "ADMIN" && farmerData.status === "deleted") {
                throw new TRPCError({ code: "NOT_FOUND", message: "Farmer not found" });
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
                    throw new TRPCError({ code: "FORBIDDEN", message: "View-only Managers cannot adjust sales." });
                }
            }

            // Safeguard: Ensure only the latest sale event can be adjusted
            const latestEvent = await ctx.db.query.saleEvents.findFirst({
                where: event.historyId
                    ? eq(saleEvents.historyId, event.historyId)
                    : eq(saleEvents.cycleId, event.cycleId!),
                orderBy: [desc(saleEvents.saleDate), desc(saleEvents.createdAt)]
            });

            if (latestEvent?.id !== event.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "Only the latest sale event can be adjusted."
                });
            }

            // Calculate totals
            const avgWeight = input.totalWeight / input.birdsSold;
            const totalAmount = input.totalWeight * input.pricePerKg;

            // BACKDATE LOGIC: Same as createSaleEvent — if saleDate implies cycle started earlier, shift everything back
            // EXCEPTION: Disable backdating for archived cycles (historical adjustments) as per user request
            let daysToBackdate = 0;
            if (input.saleDate && event.cycleId) {
                let cycleStartDate: Date | null = null;
                let currentAge = 0;

                if (event.cycleId) {
                    const activeCycle = await ctx.db.query.cycles.findFirst({
                        where: eq(cycles.id, event.cycleId),
                    });
                    if (activeCycle) {
                        cycleStartDate = activeCycle.createdAt;
                        currentAge = activeCycle.age;
                    }
                } else if (event.historyId) {
                    const archaicCycle = await ctx.db.query.cycleHistory.findFirst({
                        where: eq(cycleHistory.id, event.historyId),
                    });
                    if (archaicCycle) {
                        cycleStartDate = archaicCycle.startDate;
                        currentAge = archaicCycle.age;
                    }
                }

                if (cycleStartDate) {
                    const saleDateOnly = new Date(input.saleDate);
                    saleDateOnly.setHours(0, 0, 0, 0);

                    const cycleStartDateOnly = new Date(cycleStartDate);
                    cycleStartDateOnly.setHours(0, 0, 0, 0);

                    const MS_PER_DAY = 1000 * 60 * 60 * 24;
                    const saleAgeToUse = input.saleAge || currentAge;

                    const impliedStartMs = saleDateOnly.getTime() - ((saleAgeToUse - 1) * MS_PER_DAY);
                    let impliedStartDate = new Date(impliedStartMs);
                    impliedStartDate.setHours(0, 0, 0, 0);

                    if (impliedStartDate.getTime() !== cycleStartDateOnly.getTime()) {
                        const diffMs = cycleStartDateOnly.getTime() - impliedStartDate.getTime();
                        daysToBackdate = Math.round(diffMs / MS_PER_DAY);
                    }
                }
            }

            const result = await ctx.db.transaction(async (tx) => {
                // AUTO-BACKDATE if needed (same logic as createSaleEvent)
                if (daysToBackdate !== 0 && (event.cycleId || event.historyId)) {
                    const intervalExpr = sql`interval '${sql.raw(String(daysToBackdate))} days'`;

                    if (event.cycleId) {
                        await tx.update(cycles)
                            .set({
                                createdAt: sql`${cycles.createdAt} - ${intervalExpr}`,
                                // officialInputDate: sql`${cycles.officialInputDate} - ${intervalExpr}`,
                                age: sql`${cycles.age} + ${daysToBackdate}`
                            })
                            .where(eq(cycles.id, event.cycleId));

                        await tx.update(cycleLogs)
                            .set({ createdAt: sql`${cycleLogs.createdAt} - ${intervalExpr}` })
                            .where(eq(cycleLogs.cycleId, event.cycleId));
                    } else if (event.historyId) {
                        await tx.update(cycleHistory)
                            .set({
                                startDate: sql`${cycleHistory.startDate} - ${intervalExpr}`,
                                // officialInputDate: sql`${cycleHistory.officialInputDate} - ${intervalExpr}`,
                                age: sql`${cycleHistory.age} + ${daysToBackdate}`
                            })
                            .where(eq(cycleHistory.id, event.historyId));

                        await tx.update(cycleLogs)
                            .set({ createdAt: sql`${cycleLogs.createdAt} - ${intervalExpr}` })
                            .where(eq(cycleLogs.historyId, event.historyId));
                    }

                    const affectedSaleEvents = await tx.select({ id: saleEvents.id })
                        .from(saleEvents)
                        .where(event.cycleId ? eq(saleEvents.cycleId, event.cycleId) : eq(saleEvents.historyId, event.historyId!));

                    if (affectedSaleEvents.length > 0) {
                        await tx.update(saleEvents)
                            .set({
                                saleDate: sql`${saleEvents.saleDate} - ${intervalExpr}`,
                                createdAt: sql`${saleEvents.createdAt} - ${intervalExpr}`,
                            })
                            .where(event.cycleId ? eq(saleEvents.cycleId, event.cycleId) : eq(saleEvents.historyId, event.historyId!));

                        const saleEventIds = affectedSaleEvents.map(e => e.id);
                        if (saleEventIds.length > 0) {
                            await tx.update(saleReports)
                                .set({ createdAt: sql`${saleReports.createdAt} - ${intervalExpr}` })
                                .where(sql`${saleReports.saleEventId} IN ${saleEventIds}`);
                        }
                    }

                    await tx.insert(cycleLogs).values({
                        cycleId: event.cycleId,
                        userId: ctx.user.id,
                        type: "SYSTEM",
                        valueChange: 0,
                        note: `Cycle auto-backdated by ${daysToBackdate} day(s) during sale adjustment to match sale age.`,
                    });
                }
                // BACKFILL: Before overwriting the parent event, ensure existing reports
                // that lack feedConsumed/feedStock get the CURRENT parent event values.
                // This preserves Version 1's original data for older sales created before this fix.
                const existingReports = await tx.query.saleReports.findMany({
                    where: eq(saleReports.saleEventId, event.id),
                });
                for (const existingReport of existingReports) {
                    await tx.update(saleReports)
                        .set({
                            feedConsumed: existingReport.feedConsumed || event.feedConsumed,
                            feedStock: existingReport.feedStock || event.feedStock,
                            saleDate: existingReport.saleDate || event.saleDate,
                            officialInputDate: existingReport.officialInputDate || (event.cycle?.officialInputDate || event.history?.officialInputDate || event.cycle?.createdAt || event.history?.startDate),
                        })
                        .where(eq(saleReports.id, existingReport.id));
                }

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
                    feedPriceUsed: input.feedPricePerBag?.toString(),
                    docPriceUsed: input.docPricePerBird?.toString(),
                    recoveryPrice: input.recoveryPrice?.toString(),
                    age: input.saleAge,
                    saleDate: input.saleDate || event.saleDate,
                    officialInputDate: input.officialInputDate || (event.cycle?.officialInputDate || event.history?.officialInputDate),
                    createdBy: ctx.user.id,
                    createdAt: new Date(), // Ensure adjustment is always newer than original
                }).returning();

                // 1. SYNC PARENT SUMMARY (SaleEvents)
                // Keep the parent record updated with the latest version's summary data
                await tx.update(saleEvents)
                    .set({
                        selectedReportId: report.id,
                        birdsSold: input.birdsSold,
                        totalMortality: input.totalMortality,
                        totalWeight: input.totalWeight.toString(),
                        avgWeight: avgWeight.toFixed(2),
                        pricePerKg: input.pricePerKg.toString(),
                        totalAmount: totalAmount.toFixed(2),
                        cashReceived: input.cashReceived.toString(),
                        depositReceived: input.depositReceived.toString(),
                        medicineCost: input.medicineCost.toString(),
                        feedConsumed: JSON.stringify(input.feedConsumed),
                        feedStock: JSON.stringify(input.feedStock),
                        party: input.party,
                        location: input.location,
                        ...(input.saleAge !== undefined ? { age: input.saleAge } : {}),
                        ...(input.saleDate ? { saleDate: input.saleDate } : {}),
                    })
                    .where(eq(saleEvents.id, input.saleEventId));

                // SYNC cycle officialInputDate if it changed
                if (input.officialInputDate) {
                    if (event.cycleId) {
                        const currentDoc = event.cycle?.officialInputDate;
                        if (!currentDoc || input.officialInputDate.getTime() !== currentDoc.getTime()) {
                            await tx.update(cycles)
                                .set({ officialInputDate: input.officialInputDate, updatedAt: new Date() })
                                .where(eq(cycles.id, event.cycleId));
                        }
                    } else if (event.historyId) {
                        const currentDoc = event.history?.officialInputDate;
                        if (!currentDoc || input.officialInputDate.getTime() !== currentDoc.getTime()) {
                            await tx.update(cycleHistory)
                                .set({ officialInputDate: input.officialInputDate })
                                .where(eq(cycleHistory.id, event.historyId));
                        }
                    }
                }

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
                let reopenedCycleId: string | null = null;
                let autoClosedHistoryId: string | null = null;

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
                            const { updateCycleFeed } = await import("@/modules/cycles/server/services/feed-service");
                            await updateCycleFeed(
                                freshCycle,
                                ctx.user.id,
                                true,
                                tx,
                                `Sale Report Adjusted. Recalculated total intake.`,
                                event.saleDate
                            );
                        }

                        // Log the system adjustment (BEFORE auto-close, which deletes the cycle)
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

                        // LOOPHOLE FIX: Auto-Close if adjustment clears the population
                        const remaining = (activeCycle.doc || 0) - newMortality - newBirdsSold;
                        if (remaining <= 0) {
                            const { endCycleLogic } = await import("@/modules/cycles/server/services/cycle-service");
                            const endResult = await endCycleLogic(tx, event.cycleId, activeCycle.intake || 0, ctx.user.id, ctx.user.name, input.saleDate, input.saleAge);
                            autoClosedHistoryId = endResult.historyId;
                        }
                    }
                } else if (event.historyId) {
                    // Update cycle history stats for ended cycles
                    const [historyRecord] = await tx.select().from(cycleHistory).where(eq(cycleHistory.id, event.historyId));

                    if (historyRecord) {
                        const newMortality = historyRecord.mortality + mortalityDifference;
                        const newBirdsSold = historyRecord.birdsSold + birdsSoldDifference;

                        // Population Safety Check
                        if (newMortality + newBirdsSold > historyRecord.doc) {
                            throw new TRPCError({
                                code: "BAD_REQUEST",
                                message: `Adjustment rejected. Total dead/sold (${newMortality + newBirdsSold}) would exceed initial birds (${historyRecord.doc}).`
                            });
                        }

                        // Calculate new intake from adjustment's feed data
                        const adjustedIntake = input.feedConsumed
                            ? input.feedConsumed.reduce((sum, item) => sum + (Number(item.bags) || 0), 0)
                            : historyRecord.finalIntake;

                        // Update the history record with all adjusted stats
                        await tx.update(cycleHistory)
                            .set({
                                mortality: newMortality,
                                birdsSold: newBirdsSold,
                                finalIntake: adjustedIntake,
                                ...(input.saleAge !== undefined ? { age: input.saleAge } : {}),
                            })
                            .where(eq(cycleHistory.id, event.historyId));

                        // Log the system adjustment
                        if (mortalityDifference !== 0) {
                            await tx.insert(cycleLogs).values({
                                historyId: event.historyId,
                                userId: ctx.user.id,
                                type: "MORTALITY",
                                valueChange: mortalityDifference,
                                note: `Sale Report Adjustment (Mortality change: ${mortalityDifference})`,
                                createdAt: event.saleDate
                            });
                        }

                        if (birdsSoldDifference !== 0) {
                            await tx.insert(cycleLogs).values({
                                historyId: event.historyId,
                                userId: ctx.user.id,
                                type: "SYSTEM",
                                valueChange: birdsSoldDifference,
                                note: `Sale Report Adjustment (Birds sold adjusted by: ${birdsSoldDifference})`,
                                createdAt: event.saleDate
                            });
                        }

                        // Check if birds remain after adjustment → reopen cycle
                        const remaining = historyRecord.doc - newMortality - newBirdsSold;
                        if (remaining > 0) {
                            const { reopenCycleFromHistory } = await import("@/modules/cycles/server/services/reopen-cycle-service");
                            const reopened = await reopenCycleFromHistory(tx, event.historyId, ctx.user.id);
                            reopenedCycleId = reopened.cycleId;
                        }
                    }
                }

                // If the adjustment resulted in a cycle state change (close or reopen),
                // delete all previous versions of this sale report so only the latest remains.
                if (reopenedCycleId || autoClosedHistoryId) {
                    await tx.delete(saleReports)
                        .where(
                            and(
                                eq(saleReports.saleEventId, input.saleEventId),
                                ne(saleReports.id, report.id)
                            )
                        );
                }

                // Determine the correct references for post-adjustment logs/metrics
                // Three cases:
                // 1. History reopen: historyId deleted → use new cycleId
                // 2. Active auto-close: cycleId deleted → use new historyId
                // 3. Normal: use event's original cycleId/historyId
                let logCycleId: string | null;
                let logHistoryId: string | null;
                if (reopenedCycleId) {
                    logCycleId = reopenedCycleId;
                    logHistoryId = null;
                } else if (autoClosedHistoryId) {
                    logCycleId = null;
                    logHistoryId = autoClosedHistoryId;
                } else {
                    logCycleId = event.cycleId || null;
                    logHistoryId = event.historyId || null;
                }

                // Add SALES log entry for adjustment
                await tx.insert(cycleLogs).values({
                    cycleId: logCycleId,
                    historyId: logHistoryId,
                    userId: ctx.user.id,
                    type: "SALES",
                    valueChange: birdsSoldDifference,
                    note: `Sale Adjustment Recorded: birds sold adjusted by ${birdsSoldDifference}. ${input.adjustmentNote || ""}`,
                    createdAt: event.saleDate
                });

                // Recalculate metrics
                await SaleMetricsService.recalculateForCycle(
                    logCycleId || undefined,
                    logHistoryId || undefined,
                    tx,
                    input.recoveryPrice,
                    input.feedPricePerBag,
                    input.docPricePerBird
                );

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

    // Preview a sale event to see potential metrics (FCR, EPI, Profit)
    previewSale: proProcedure
        .input(createSaleEventSchema.extend({
            excludeSaleId: z.string().optional(),
            historyId: z.string().optional().nullable(),
            saleAge: z.number().int().positive().optional()
        }))
        .mutation(async ({ ctx, input }) => {

            let cycleIdToUse = input.cycleId;
            let historyIdToUse = input.historyId;

            // Robustness: If we are editing an existing sale, trust the DB's link
            if (input.excludeSaleId) {
                const existingSale = await ctx.db.query.saleEvents.findFirst({
                    where: eq(saleEvents.id, input.excludeSaleId),
                    columns: { cycleId: true, historyId: true }
                });

                if (existingSale) {
                    // Update our target IDs from the source of truth
                    if (existingSale.cycleId) cycleIdToUse = existingSale.cycleId;
                    if (existingSale.historyId) historyIdToUse = existingSale.historyId;
                }
            }

            // Get cycle and verify ownership
            let cycle: any = await ctx.db.query.cycles.findFirst({
                where: eq(cycles.id, cycleIdToUse),
                with: { farmer: { with: { organization: true } } },
            });

            // If not found in active cycles, check history
            if (!cycle && historyIdToUse) {
                const history = await ctx.db.query.cycleHistory.findFirst({
                    where: eq(cycleHistory.id, historyIdToUse),
                    with: { farmer: { with: { organization: true } } },
                });
                if (history) {
                    // Map history to cycle-like object for consistent logic
                    cycle = {
                        ...history,
                        // History stores final intake, use it as intake
                        intake: history.finalIntake,
                        // Map status for logic checks
                        status: 'archived'
                    };
                }
            }

            if (!cycle) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Cycle not found" });
            }

            if (!cycle.farmer || cycle.farmer.officerId !== ctx.user.id) {
                throw new TRPCError({ code: "FORBIDDEN", message: "You don't have permission to sell from this cycle" });
            }

            // Visibility Restriction: Non-admins don't see deleted farmers' data
            if (ctx.user.globalRole !== "ADMIN" && cycle.farmer.status === "deleted") {
                throw new TRPCError({ code: "NOT_FOUND", message: "Farmer not found" });
            }

            // Fetch previous sales to calculate cumulative stats
            const previousSales = await ctx.db.query.saleEvents.findMany({
                where: historyIdToUse ? eq(saleEvents.historyId, historyIdToUse) : eq(saleEvents.cycleId, cycleIdToUse),
                with: { selectedReport: true } // Need reports for accurate adjustments
            });

            // Aggregate data (Previous + Current Input)
            let totalWeight = input.totalWeight;
            let totalBirdsSold = input.birdsSold;
            let totalRevenue = input.birdsSold > 0 ? (input.totalWeight * input.pricePerKg) : 0; // Actual amount
            // Process previous sales
            for (const sale of previousSales) {
                if (input.excludeSaleId && sale.id === input.excludeSaleId) continue;

                const data = sale.selectedReport || sale;
                const w = parseFloat(data.totalWeight);
                const p = parseFloat(data.pricePerKg);
                const s = data.birdsSold;

                totalWeight += isNaN(w) ? 0 : w;
                totalBirdsSold += s;
                totalRevenue += parseFloat(data.totalAmount);
            }


            const newMortality = cycle.mortality + input.mortalityChange;
            // Feed logic: 
            // If ending cycle (sold all birds), input feed is FINAL total.
            // If not ending, we use current estimate + input? 
            // The constraint is: user enters feed consumed/stock.
            // For preview, we can just sum up bags from input as "current sale feed".
            // But for Total Cycle feed calculation (needed for FCR/Profit), we need the logic.

            // Check if cycle would end
            const totalBirdsAfterMortality = cycle.doc - newMortality;
            const isEnded = totalBirdsSold >= totalBirdsAfterMortality;

            let totalFeedBags = 0;
            if (isEnded) {
                // If ending, the input feed is the TOTAL cycle feed (as per our "manualTotalBags" logic in createSaleEvent)
                // Wait, in createSaleEvent: "const currentIntake = input.feedConsumed.reduce..."
                // "const manualTotalBags = currentIntake;"
                // So if ending, the input.feedConsumed IS the total.
                totalFeedBags = input.feedConsumed.reduce((sum, item) => sum + item.bags, 0);
            } else {
                // If not ending, use cycle.intake (which is maintained by feed service)
                // This is an estimation for running cycles.
                totalFeedBags = (cycle.intake || 0);
            }

            // Calculate Metrics
            const orgFeedPrice = input.feedPricePerBag ?? (Number(cycle.farmer?.organization?.feedPricePerBag) || FEED_PRICE_PER_BAG);


            // EPI Calculation needs age
            // formula: (survivalRate * avgWeight * 10) / FCR
            // But usually EPI = (Survival % * (Weight/Age) * 100) / FCR? 
            // Our service uses: (survivalRate * (avgWeight / age) * 100) / FCR ?
            // Let's match SaleMetricsService logic implicitly or explicitly.
            // Simplified here for preview:

            const totalBirds = (cycle.doc || 0);
            const birdsSoldTotal = totalBirdsSold;
            const mortalityTotal = newMortality;
            const currentHouseBirds = Math.max(0, totalBirds - mortalityTotal - birdsSoldTotal);
            // Survival Rate for EPI is usually based on birds sold? Or total survival at end?
            // If cycle is ending, survival = (birdsSold / doc) * 100 ?
            // If running, survival = ((doc - mortality) / doc) * 100
            const survivalRate = totalBirds > 0
                ? ((totalBirds - mortalityTotal) / totalBirds) * 100
                : 0;

            const totalWt = totalWeight;
            const avgWt = totalBirdsSold > 0 ? totalWt / totalBirdsSold : 0;
            const fcr = (totalWt > 0 && totalFeedBags > 0) ? (totalFeedBags * 50) / totalWt : 0;

            // EPI = (Survival Rate * Average Weight (kg) / Age (days) / FCR) * 100
            // Standard Broiler EPI = (Survival % * Avg Weight kg / Age days / FCR) * 100
            // Let's check typical formula. Commonly: (Survival * AvgWeight * 100) / (FCR * Age) ? or similar. 
            // We'll use a standard decent approximation if we don't import the service.
            // (Survival% * (AvgWeight / Age) * 100) / FCR? No that's huge.
            // (Survival% * AvgWeight / FCR / Age) * 100

            const docPriceUsed = input.docPricePerBird ?? DOC_PRICE_PER_BIRD;

            const basePrice = input.recoveryPrice ?? BASE_SELLING_PRICE;

            const avgPrice = totalWeight > 0 ? totalRevenue / totalWeight : 0;
            const netAdjustment = (avgPrice - basePrice) / 2;

            // Effective Rate = max(basePrice, basePrice + Net Adjustment)
            const effectiveRate = Math.max(basePrice, basePrice + netAdjustment);
            const formulaRevenue = effectiveRate * totalWeight;
            const feedCost = isEnded ? totalFeedBags * orgFeedPrice : 0;
            const docCost = isEnded ? cycle.doc * docPriceUsed : 0;
            const formulaProfit = formulaRevenue - docCost - feedCost;

            const avgWeight = totalBirdsSold > 0 ? totalWeight / totalBirdsSold : 0;

            // FCR/EPI
            // Age: use adjusted input age, or fall back to original sale event age (if adjusting), or current cycle age
            let originalAge = cycle.age || 0;
            if (input.excludeSaleId && previousSales) {
                const adjustingSale = previousSales.find((s: typeof previousSales[0]) => s.id === input.excludeSaleId);
                if (adjustingSale && adjustingSale.age != null) {
                    originalAge = adjustingSale.age;
                }
            }
            let age = input.saleAge ?? originalAge;
            const originalSaleAge = age;

            if (isEnded) {
                let totalBirdDays = 0;

                for (const sale of previousSales) {
                    if (input.excludeSaleId && sale.id === input.excludeSaleId) continue;

                    const data = sale.selectedReport || sale;
                    const bSold = Number(data.birdsSold) || 0;

                    // Prefer report-level age over raw event age
                    const ageAtSale = data.age ?? sale.age ?? (() => {
                        const cycleStartDate = cycle.createdAt || cycle.startDate || sale.createdAt;
                        const sDate = new Date(sale.saleDate);
                        const cStart = new Date(cycleStartDate);
                        sDate.setHours(0, 0, 0, 0);
                        cStart.setHours(0, 0, 0, 0);
                        const diffTime = sDate.getTime() - cStart.getTime();
                        const MS_PER_DAY = 1000 * 60 * 60 * 24;
                        return Math.max(1, Math.round(diffTime / MS_PER_DAY) + 1);
                    })();

                    totalBirdDays += bSold * ageAtSale;
                }

                totalBirdDays += input.birdsSold * age;

                if (totalBirdsSold > 0) {
                    age = Number((totalBirdDays / totalBirdsSold).toFixed(2));
                }
            }

            const epi = (fcr > 0 && age > 0) ? (survivalRate * avgWeight) / (fcr * age) * 100 : 0;

            // Construct Preview Object
            return {
                ...input,
                id: "preview-id",
                cycleId: input.cycleId,
                saleAge: originalSaleAge,
                totalAmount: (input.totalWeight * input.pricePerKg).toFixed(2),
                avgWeight: (input.birdsSold > 0 ? input.totalWeight / input.birdsSold : 0).toFixed(2),
                totalMortality: newMortality,
                remainingBirds: currentHouseBirds,
                officialInputDate: input.officialInputDate || cycle.officialInputDate || (cycle as any).startDate || cycle.createdAt,
                // Match SaleEvent structure expected by UI
                cycleContext: {
                    isEnded,
                    revenue: formulaRevenue,
                    actualRevenue: totalRevenue,
                    effectiveRate,
                    netAdjustment,
                    fcr: parseFloat(fcr.toFixed(2)),
                    epi: parseFloat(epi.toFixed(0)),
                    mortality: newMortality,
                    avgPrice: totalWeight > 0 ? totalRevenue / totalWeight : 0,
                    feedConsumed: totalFeedBags,
                    doc: cycle.doc,
                    feedCost,
                    docCost,
                    profit: formulaProfit,
                    totalWeight,
                    cumulativeBirdsSold: totalBirdsSold,
                    age,
                    recoveryPrice: basePrice,
                    feedPriceUsed: orgFeedPrice,
                    docPriceUsed: docPriceUsed,
                    birdType: cycle.birdType
                }
            };
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
                    where: and(
                        eq(farmer.id, input.farmerId),
                        ctx.user.globalRole !== "ADMIN" ? ne(farmer.status, "deleted") : undefined
                    ),
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
                                                feedPriceUsed: true,
                                                docPriceUsed: true,
                                                recoveryPrice: true,
                                                age: true,
                                                saleDate: true,
                                                officialInputDate: true,
                                                createdAt: true,
                                            }
                                        },
                                        createdByUser: { columns: { name: true } },
                                        cycle: {
                                            with: { farmer: { columns: { name: true, mobile: true, status: true } } }
                                        },
                                        history: {
                                            with: { farmer: { columns: { name: true, mobile: true, status: true } } }
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
                                                feedPriceUsed: true,
                                                docPriceUsed: true,
                                                recoveryPrice: true,
                                                age: true,
                                                saleDate: true,
                                                officialInputDate: true,
                                                createdAt: true,
                                            }
                                        },
                                        createdByUser: { columns: { name: true } },
                                        cycle: {
                                            with: { farmer: true }
                                        },
                                        history: {
                                            with: { farmer: true }
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
                                feedPriceUsed: true,
                                docPriceUsed: true,
                                recoveryPrice: true,
                                age: true,
                                saleDate: true,
                                officialInputDate: true,
                                createdAt: true,
                            }
                        },
                        createdByUser: {
                            columns: { name: true },
                        },
                        cycle: {
                            with: { farmer: true }
                        },
                        history: {
                            with: { farmer: true }
                        }
                    },
                });
            }

            // Fetch per-cycle recovery prices from saleMetrics
            const allGroupKeys = [...new Set(events.map(e => e.cycleId || e.historyId).filter(Boolean))] as string[];
            const metricsRows = allGroupKeys.length > 0 ? await ctx.db.query.saleMetrics.findMany({
                where: or(
                    ...allGroupKeys.map(k => or(eq(saleMetrics.cycleId, k), eq(saleMetrics.historyId, k)))
                ),
                columns: { cycleId: true, historyId: true, recoveryPrice: true, feedPriceUsed: true, docPriceUsed: true }
            }) : [];
            const recoveryPriceMap = new Map<string, number>();
            const feedPriceUsedMap = new Map<string, number>();
            const docPriceUsedMap = new Map<string, number>();
            for (const m of metricsRows) {
                const key = m.cycleId || m.historyId || "";
                if (key && m.recoveryPrice) recoveryPriceMap.set(key, Number(m.recoveryPrice));
                if (key && m.feedPriceUsed) feedPriceUsedMap.set(key, Number(m.feedPriceUsed));
                if (key && m.docPriceUsed) docPriceUsedMap.set(key, Number(m.docPriceUsed));
            }

            // Calculate cumulative revenue, weight AND independent price adjustments PER CYCLE/HISTORY
            const { latestMortalityMap, ageMap } = getCycleStatsWithMortality(events);

            // Pre-calculate LATEST feed intake for each History Group from the events themselves
            // (Since events are sorted DESC, the first event for a historyId is the Final Sale)
            const historyFeedMap = new Map<string, number>();

            for (const ev of events) {
                if (ev.historyId && !historyFeedMap.has(ev.historyId)) {
                    // This is the latest sale for this history
                    const bags = getFeedFromEvent(ev);
                    historyFeedMap.set(ev.historyId, bags);
                }
            }

            // Compute per-sale cumulative birds sold (for remainingBirds)
            // Group events by cycle/history, sort chronologically, accumulate
            const perSaleCumulativeMap = new Map<string, number>();
            const groupedForCumulative: Record<string, typeof events> = {};
            for (const ev of events) {
                const gk = ev.cycleId || ev.historyId || "unknown";
                if (!groupedForCumulative[gk]) groupedForCumulative[gk] = [];
                groupedForCumulative[gk].push(ev);
            }
            for (const gk of Object.keys(groupedForCumulative)) {
                const sorted = [...groupedForCumulative[gk]].sort((a, b) =>
                    new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime() ||
                    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
                );
                let running = 0;
                for (const ev of sorted) {
                    running += ev.birdsSold || 0;
                    perSaleCumulativeMap.set(ev.id, running);
                }
            }

            const seenGroups = new Set<string>();

            return events.map((e) => {
                const cycleOrHistory = e.cycle || e.history;
                const isEnded = !e.cycleId && !!e.historyId;
                const groupKey = e.cycleId || e.historyId || "unknown";

                // Determine if this is the latest sale for this group
                // (Since events are sorted DESC, the first one encountered is the latest)
                const isLatestInGroup = !seenGroups.has(groupKey);
                seenGroups.add(groupKey);

                const selectedReportForE = e.reports?.find(
                    (r: any) => r.id === e.selectedReportId
                );

                // Get cycle context
                const doc = cycleOrHistory?.doc || 0;

                let age = cycleOrHistory?.age || 0;
                if (isEnded && isLatestInGroup) {
                    const weightedAge = ageMap.get(groupKey);
                    if (weightedAge && weightedAge > 0) {
                        age = weightedAge;
                    }
                } else {
                    age = selectedReportForE?.age ?? e.age ?? age;
                }
                // FIX: Use the feed from the LATEST sale event for this history (version-aware),
                // fallback to database snapshot if needed.
                const feedConsumed = isEnded
                    ? (historyFeedMap.get(e.historyId!) ?? e.history?.finalIntake ?? 0)
                    : (e.cycle?.intake || 0);

                // For cumulative calculations, we need to recalculate based on selected versions
                // Get all events in this cycle/history group
                const groupEvents = events.filter(evt => {
                    const key = evt.cycleId || evt.historyId || "unknown";
                    return key === groupKey;
                });

                // Recalculate cumulative totals using selected report data for each event
                let cumulativeWeight = 0;
                let cumulativeRevenue = 0;
                let cumulativeBirdsSold = 0;
                let latestMortality = 0;

                // Initialize overridden prices with current global values from saleMetrics
                let finalRecoveryPrice: number | null = recoveryPriceMap.get(groupKey) ?? null;
                let finalFeedPrice: number | null = feedPriceUsedMap.get(groupKey) ?? null;
                let finalDocPrice: number | null = docPriceUsedMap.get(groupKey) ?? null;

                groupEvents.forEach(evt => {
                    const selectedReport = evt.reports?.find(
                        (r: any) => r.id === evt.selectedReportId
                    );

                    // Extract historical overrides from the selected report
                    if (selectedReport) {
                        if (selectedReport.recoveryPrice) finalRecoveryPrice = Number(selectedReport.recoveryPrice);
                        if (selectedReport.feedPriceUsed) finalFeedPrice = Number(selectedReport.feedPriceUsed);
                        if (selectedReport.docPriceUsed) finalDocPrice = Number(selectedReport.docPriceUsed);
                    }

                    const weight = selectedReport
                        ? parseFloat(selectedReport.totalWeight)
                        : parseFloat(evt.totalWeight);

                    const price = selectedReport
                        ? parseFloat(selectedReport.pricePerKg)
                        : parseFloat(evt.pricePerKg);

                    const birds = selectedReport
                        ? selectedReport.birdsSold
                        : evt.birdsSold;

                    const amount = selectedReport
                        ? parseFloat(selectedReport.totalAmount)
                        : parseFloat(evt.totalAmount);

                    const mortality =
                        selectedReport?.totalMortality ??
                        evt.totalMortality ??
                        0;

                    cumulativeWeight += weight;
                    cumulativeRevenue += amount;
                    cumulativeBirdsSold += birds;

                    // 🔥 LATEST MORTALITY FROM SELECTED VERSION
                    latestMortality = Math.max(latestMortality, mortality);
                });
                const basePrice = finalRecoveryPrice ?? recoveryPriceMap.get(groupKey) ?? BASE_SELLING_PRICE;
                const netAdjustment = ((cumulativeRevenue / cumulativeWeight) - basePrice) / 2;


                // Calculate the original sale age (not the weighted one)
                // Effective Rate = max(basePrice, basePrice + Net Adjustment)
                const effectiveRate = Math.max(basePrice, basePrice + netAdjustment);
                const formulaRevenue = effectiveRate * cumulativeWeight;

                // Use latest mortality from selected reports across all sales in this cycle
                const mortality = latestMortality || (latestMortalityMap.get(groupKey) ?? (cycleOrHistory?.mortality || 0));

                // Calculate FCR/EPI using version-specific data
                // Only calculate if this is the LATEST sale in the group (User Request)
                const { fcr, epi } = calculateMetrics(
                    doc,
                    latestMortality,     // 🔥 SELECTED VERSION
                    cumulativeWeight,    // 🔥 SUM OF SELECTED WEIGHTS
                    feedConsumed,        // 🔥 RECALCULATED FEED
                    age,
                    isLatestInGroup && isEnded      // Replaced isEnded
                );
                // Profit calculation (backend-only)
                const feedPrice = finalFeedPrice ?? feedPriceUsedMap.get(groupKey) ?? FEED_PRICE_PER_BAG;
                const docPrice = finalDocPrice ?? docPriceUsedMap.get(groupKey) ?? DOC_PRICE_PER_BIRD;
                const feedCost = isEnded ? feedConsumed * feedPrice : 0;
                const docCost = isEnded ? doc * docPrice : 0;
                const profit = formulaRevenue - feedCost - docCost;
                const avgPrice = cumulativeWeight > 0 ? cumulativeRevenue / cumulativeWeight : 0;

                // Sale age is fixed at sell/adjust time — just read from DB
                const saleAge = selectedReportForE?.age ?? e.age ?? cycleOrHistory?.age ?? 0;

                return {
                    ...e,
                    saleAge,
                    feedConsumed: JSON.parse(e.feedConsumed) as { type: string; bags: number }[],
                    feedStock: JSON.parse(e.feedStock) as { type: string; bags: number }[],
                    cycleName: e.cycle?.name || e.history?.cycleName || "Unknown Batch",
                    farmerName: e.cycle?.farmer?.name || e.history?.farmer?.name || "Unknown Farmer",
                    // Log to debug
                    // //console.log"Mapping event:", e.id, "Farmer:", e.cycle?.farmer, e.history?.farmer);
                    farmerMobile: e.cycle?.farmer?.mobile || e.history?.farmer?.mobile || "",
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
                        netAdjustment,
                        feedCost,
                        docCost,
                        profit,
                        avgPrice: parseFloat(avgPrice.toFixed(2)),
                        recoveryPrice: finalRecoveryPrice ?? recoveryPriceMap.get(groupKey) ?? null,
                        feedPriceUsed: finalFeedPrice ?? feedPriceUsedMap.get(groupKey) ?? null,
                        docPriceUsed: finalDocPrice ?? docPriceUsedMap.get(groupKey) ?? null,
                        birdType: cycleOrHistory?.birdType,
                        createdAt: cycleOrHistory ? ((cycleOrHistory as any).startDate || (cycleOrHistory as any).createdAt) : null,
                        officialInputDate: cycleOrHistory?.officialInputDate ?? null
                    },
                    remainingBirds: doc - (e.totalMortality ?? 0) - (perSaleCumulativeMap.get(e.id) ?? e.birdsSold ?? 0),
                };
            }).filter(e => {
                // Filter out deleted farmers for non-admins if not already filtered at DB level
                if (ctx.user.globalRole === "ADMIN") return true;
                const f = e.cycle?.farmer || e.history?.farmer;
                return f?.status !== "deleted";
            });
        }),

    setActiveVersion: proProcedure
        .input(z.object({
            saleEventId: z.string(),
            saleReportId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const result = await ctx.db.transaction(async (tx) => {

                const event = await tx.query.saleEvents.findFirst({
                    where: eq(saleEvents.id, input.saleEventId),
                    with: {
                        cycle: true,
                        history: true
                    }
                });

                const [report] = await tx
                    .select()
                    .from(saleReports)
                    .where(eq(saleReports.id, input.saleReportId))
                    .limit(1);

                if (!event || !report) {
                    throw new TRPCError({
                        code: "NOT_FOUND",
                        message: "Event or Report not found"
                    });
                }

                if (ctx.user.globalRole !== "ADMIN") {
                    // Fetch the organization ID to check the user's role
                    const eventWithContext = await tx.query.saleEvents.findFirst({
                        where: eq(saleEvents.id, input.saleEventId),
                        with: {
                            cycle: { with: { farmer: true } },
                            history: { with: { farmer: true } }
                        }
                    });

                    const organizationId = eventWithContext?.cycle?.farmer?.organizationId || eventWithContext?.history?.farmer?.organizationId;

                    if (organizationId) {
                        const membership = await tx.query.member.findFirst({
                            where: and(
                                eq(member.userId, ctx.user.id),
                                eq(member.organizationId, organizationId),
                                eq(member.status, "ACTIVE")
                            )
                        });

                        // Prevent managers from setting the version directly
                        if (membership && ((membership.role === "MANAGER" && membership.activeMode == "MANAGEMENT") || membership.role === "OWNER")) {
                            throw new TRPCError({
                                code: "FORBIDDEN",
                                message: "Managers are not allowed to set the active version. Only officers can."
                            });
                        }
                    }
                }

                // Safeguard: Ensure only the latest sale can have its active version changed
                const latestEvent = await tx.query.saleEvents.findFirst({
                    where: event.historyId
                        ? eq(saleEvents.historyId, event.historyId)
                        : eq(saleEvents.cycleId, event.cycleId!),
                    orderBy: [desc(saleEvents.saleDate), desc(saleEvents.createdAt)]
                });

                if (latestEvent?.id !== event.id) {
                    throw new TRPCError({
                        code: "FORBIDDEN",
                        message: "Version selection is only allowed for the latest sale in a cycle to ensure timeline consistency."
                    });
                }

                const mortalityDiff = (report.totalMortality || 0) - (event.totalMortality || 0);
                const birdsSoldDiff = (report.birdsSold || 0) - (event.birdsSold || 0);

                // Calculate Timeline Shift: (Old Implied Hatch Date) - (New Implied Hatch Date)
                // This ensures that switching to a version where saleAge was changed ALSO moves the cycle timeline.
                const MS_PER_DAY = 1000 * 60 * 60 * 24;
                const oldSaleDate = new Date(event.saleDate);
                oldSaleDate.setHours(0, 0, 0, 0);
                const oldImpliedStart = oldSaleDate.getTime() - (((event.age || 1) - 1) * MS_PER_DAY);

                const newSaleDate = new Date(report.saleDate || report.createdAt);
                newSaleDate.setHours(0, 0, 0, 0);
                const newImpliedStart = newSaleDate.getTime() - (((report.age || 1) - 1) * MS_PER_DAY);

                const shiftDays = Math.round((oldImpliedStart - newImpliedStart) / MS_PER_DAY);
                // console.log(shiftDays)
                // 🔁 Update parent sale event with selected version
                await tx.update(saleEvents)
                    .set({
                        selectedReportId: report.id,
                        birdsSold: report.birdsSold,
                        totalMortality: report.totalMortality || 0,
                        totalWeight: report.totalWeight,
                        pricePerKg: report.pricePerKg,
                        totalAmount: report.totalAmount,
                        avgWeight: report.avgWeight,
                        cashReceived: report.cashReceived,
                        depositReceived: report.depositReceived,
                        medicineCost: report.medicineCost,
                        feedConsumed: report.feedConsumed || "[]",
                        feedStock: report.feedStock || "[]",
                        age: report.age,
                        saleDate: report.saleDate || report.createdAt,
                    })
                    .where(eq(saleEvents.id, event.id));

                // Synchronize Parent Cycle / CycleHistory officialInputDate independently
                const targetDocDate = report.officialInputDate || event.cycle?.createdAt || event.history?.startDate;
                if (targetDocDate) {
                    if (event.cycleId) {
                        const currentDoc = event.cycle?.officialInputDate;
                        if (!currentDoc || targetDocDate.getTime() !== currentDoc.getTime()) {
                            await tx.update(cycles)
                                .set({ officialInputDate: targetDocDate, updatedAt: new Date() })
                                .where(eq(cycles.id, event.cycleId));
                        }
                    } else if (event.historyId) {
                        const currentDoc = event.history?.officialInputDate;
                        if (!currentDoc || targetDocDate.getTime() !== currentDoc.getTime()) {
                            await tx.update(cycleHistory)
                                .set({ officialInputDate: targetDocDate })
                                .where(eq(cycleHistory.id, event.historyId));
                        }
                    }
                }

                // Synchronize Cycle / CycleHistory Inventory and Dates based on the version toggle

                // Synchronize Cycle / CycleHistory Inventory and Dates based on the version toggle
                let effectiveShift = shiftDays;
                if (mortalityDiff !== 0 || birdsSoldDiff !== 0 || effectiveShift !== 0) {
                    const intervalExpr = sql`interval '${sql.raw(String(effectiveShift))} days'`;

                    if (event.cycleId) {
                        const [activeCycle] = await tx.select({ doc: cycles.doc }).from(cycles).where(eq(cycles.id, event.cycleId));
                        if (activeCycle) {
                            // Optionally add a sanity check here to ensure we don't exceed doc
                            await tx.update(cycles)
                                .set({
                                    mortality: sql`${cycles.mortality} + ${mortalityDiff}`,
                                    birdsSold: sql`${cycles.birdsSold} + ${birdsSoldDiff}`,
                                    updatedAt: new Date(),
                                    ...(effectiveShift !== 0 ? {
                                        age: sql`${cycles.age} + ${effectiveShift}`,
                                        createdAt: sql`${cycles.createdAt} - ${intervalExpr}`,
                                    } : {})
                                })
                                .where(eq(cycles.id, event.cycleId));

                            if (effectiveShift !== 0) {
                                await tx.update(cycleLogs)
                                    .set({ createdAt: sql`${cycleLogs.createdAt} - ${intervalExpr}` })
                                    .where(eq(cycleLogs.cycleId, event.cycleId));

                                await tx.update(saleEvents)
                                    .set({
                                        saleDate: sql`${saleEvents.saleDate} - ${intervalExpr}`,
                                        createdAt: sql`${saleEvents.createdAt} - ${intervalExpr}`,
                                    })
                                    .where(
                                        and(
                                            eq(saleEvents.cycleId, event.cycleId),
                                            ne(saleEvents.id, event.id)
                                        )
                                    );

                                const affectedSaleEvents = await tx.select({ id: saleEvents.id })
                                    .from(saleEvents)
                                    .where(
                                        and(
                                            eq(saleEvents.cycleId, event.cycleId),
                                            ne(saleEvents.id, event.id)
                                        )
                                    );
                                const saleEventIds = affectedSaleEvents.map(e => e.id);
                                if (saleEventIds.length > 0) {
                                    await tx.update(saleReports)
                                        .set({ createdAt: sql`${saleReports.createdAt} - ${intervalExpr}` })
                                        .where(sql`${saleReports.saleEventId} IN ${saleEventIds}`);
                                }
                            }
                        }
                    } else if (event.historyId) {
                        // For archived cycles, the age is fixed to the final sale's age. 
                        // If the version changes the age, we must shift the start dates exactly by the age difference.
                        // (If ageDiff is positive -> birds are older -> hatched earlier -> subtract days from startDate)
                        await tx.update(cycleHistory)
                            .set({
                                mortality: sql`${cycleHistory.mortality} + ${mortalityDiff}`,
                                birdsSold: sql`${cycleHistory.birdsSold} + ${birdsSoldDiff}`,
                                // updatedAt: new Date(),
                                ...(effectiveShift !== 0 ? {
                                    age: sql`${cycleHistory.age} + ${effectiveShift}`,
                                    startDate: sql`${cycleHistory.startDate} - ${intervalExpr}`,
                                } : {})
                            })
                            .where(eq(cycleHistory.id, event.historyId));

                        // Shift dates on logs and reports within this history if age changed
                        if (effectiveShift !== 0) {
                            await tx.update(cycleLogs)
                                .set({ createdAt: sql`${cycleLogs.createdAt} - ${intervalExpr}` })
                                .where(eq(cycleLogs.historyId, event.historyId));

                            await tx.update(saleEvents)
                                .set({
                                    saleDate: sql`${saleEvents.saleDate} - ${intervalExpr}`,
                                    createdAt: sql`${saleEvents.createdAt} - ${intervalExpr}`,
                                })
                                .where(
                                    and(
                                        eq(saleEvents.historyId, event.historyId),
                                        ne(saleEvents.id, event.id)
                                    )
                                );

                            const affectedSaleEvents = await tx.select({ id: saleEvents.id })
                                .from(saleEvents)
                                .where(
                                    and(
                                        eq(saleEvents.historyId, event.historyId),
                                        ne(saleEvents.id, event.id)
                                    )
                                );
                            const saleEventIds = affectedSaleEvents.map(e => e.id);
                            if (saleEventIds.length > 0) {
                                await tx.update(saleReports)
                                    .set({ createdAt: sql`${saleReports.createdAt} - ${intervalExpr}` })
                                    .where(sql`${saleReports.saleEventId} IN ${saleEventIds}`);
                            }
                        }
                    }
                }

                // 🔥 FORCE FEED RECALCULATION (THIS FIXES FCR)
                if (event.cycleId) {
                    const [freshCycle] = await tx
                        .select()
                        .from(cycles)
                        .where(eq(cycles.id, event.cycleId))
                        .limit(1);

                    if (freshCycle) {
                        await updateCycleFeed(
                            freshCycle,
                            ctx.user.id,
                            true, // FORCE
                            tx,
                            "Sale version switched. Recalculated feed intake.",
                            new Date()
                        );
                    }
                }

                // Recalculate metrics for this cycle/history to update Production Report
                // Use the overrides saved in the historical report if present, fallback to existing metrics
                const existingMetrics = await tx.query.saleMetrics.findFirst({
                    where: event.cycleId ? eq(saleMetrics.cycleId, event.cycleId) : eq(saleMetrics.historyId, event.historyId!),
                    columns: { recoveryPrice: true, feedPriceUsed: true, docPriceUsed: true }
                });

                const reportRecoveryPrice = report.recoveryPrice ? Number(report.recoveryPrice) : undefined;
                const reportFeedPrice = report.feedPriceUsed ? Number(report.feedPriceUsed) : undefined;
                const reportDocPrice = report.docPriceUsed ? Number(report.docPriceUsed) : undefined;

                await SaleMetricsService.recalculateForCycle(
                    event.cycleId || undefined,
                    event.historyId || undefined,
                    tx,
                    reportRecoveryPrice ?? (existingMetrics?.recoveryPrice ? Number(existingMetrics.recoveryPrice) : undefined),
                    reportFeedPrice ?? (existingMetrics?.feedPriceUsed ? Number(existingMetrics.feedPriceUsed) : undefined),
                    reportDocPrice ?? (existingMetrics?.docPriceUsed ? Number(existingMetrics.docPriceUsed) : undefined)
                );

                return { success: true };
            });

            return result;
        }),

    // Get reports for a sale event
    getReports: proProcedure
        .input(z.object({ saleEventId: z.string() }))
        .query(async ({ ctx, input }) => {
            const event = await ctx.db.query.saleEvents.findFirst({
                where: eq(saleEvents.id, input.saleEventId),
                with: {
                    cycle: { with: { farmer: true } },
                    history: { with: { farmer: true } },
                }
            });

            if (!event) throw new TRPCError({ code: "NOT_FOUND" });

            const farmerData = event.cycle?.farmer || event.history?.farmer;
            if (ctx.user.globalRole !== "ADMIN" && farmerData?.status === "deleted") {
                throw new TRPCError({ code: "NOT_FOUND" });
            }

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
                    age: true,
                    createdAt: true,
                    createdBy: true,
                    saleEventId: true,
                }
            });
        }),

    getRecentSales: proProcedure
        .input(z.object({
            limit: z.number().min(1).max(100).default(20),
            search: z.string().optional(),
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
                            age: true,
                            createdAt: true,
                            officialInputDate: true,
                            saleDate: true,
                        }
                    }
                }
            });

            // Filter out deleted farmers for non-admins before appending context
            const filteredEvents = events.filter(e => {
                if (ctx.user.globalRole === "ADMIN") return true;
                const f = e.cycle?.farmer || e.history?.farmer;
                return f?.status !== "deleted";
            });

            return await appendCycleContextToSales(ctx, filteredEvents, input.search, input.limit);
        }),

    delete: proProcedure
        .input(z.object({
            saleEventId: z.string(),
            historyId: z.string().optional().nullable() // Context
        }))
        .mutation(async ({ ctx, input }) => {
            const result = await ctx.db.transaction(async (tx) => {
                // 1. Get the sale event to identify the cycle/history
                const event = await tx.query.saleEvents.findFirst({
                    where: eq(saleEvents.id, input.saleEventId)
                });

                if (!event) throw new TRPCError({ code: "NOT_FOUND", message: "Sale event not found" });

                // Policy: We delete ALL sales for this cycle/history when any single one is deleted
                const deleteCriteria = input.historyId
                    ? eq(saleEvents.historyId, input.historyId)
                    : eq(saleEvents.cycleId, event.cycleId!);

                const allEventsInCycle = await tx.query.saleEvents.findMany({
                    where: deleteCriteria
                });

                const allEventIds = allEventsInCycle.map(e => e.id);
                if (allEventIds.length === 0) return { success: true };

                // Calculate mortality to revert
                // We identify mortality logs created during sales by the note pattern
                const mortalityToRevert = await tx
                    .select({ total: sql<number>`COALESCE(SUM(${cycleLogs.valueChange}), 0)` })
                    .from(cycleLogs)
                    .where(and(
                        eq(cycleLogs.type, "MORTALITY"),
                        input.historyId ? eq(cycleLogs.historyId, input.historyId) : eq(cycleLogs.cycleId, event.cycleId!),
                        like(cycleLogs.note, "Sale Report Adjustment (Mortality change:%")
                    ));

                const mortalityCount = Number(mortalityToRevert[0]?.total || 0);

                // 2. Delete all related records
                // Reports have cascade on saleEventId, but we might want to manually clean up cycleLogs
                await tx.delete(saleReports).where(inArray(saleReports.saleEventId, allEventIds));
                await tx.delete(saleEvents).where(inArray(saleEvents.id, allEventIds));

                // Clean up associated logs in cycleLogs
                await tx.delete(cycleLogs).where(and(
                    input.historyId ? eq(cycleLogs.historyId, input.historyId) : eq(cycleLogs.cycleId, event.cycleId!),
                    or(
                        eq(cycleLogs.type, "SALES"),
                        and(
                            eq(cycleLogs.type, "MORTALITY"),
                            like(cycleLogs.note, "Sale Report Adjustment%")
                        )
                    )
                ));

                // 3. Update Cycle or History record stats
                if (event.cycleId) {
                    // Revert active cycle
                    await tx.update(cycles)
                        .set({
                            birdsSold: 0,
                            mortality: sql`${cycles.mortality} - ${mortalityCount}`,
                            status: "active" // Ensure it's active if it was accidentally closed
                        })
                        .where(eq(cycles.id, event.cycleId));

                    // Recalculate feed intake/stock for active cycle
                    const [updatedCycle] = await tx.select().from(cycles).where(eq(cycles.id, event.cycleId)).limit(1);
                    if (updatedCycle) {
                        await updateCycleFeed(updatedCycle, ctx.user.id, true, tx, "Reverting sales - recalculated intake");
                    }
                }

                // Recalculate metrics for this cycle/history to update Production Report
                await SaleMetricsService.recalculateForCycle(
                    event.cycleId || undefined,
                    input.historyId || undefined,
                    tx
                );

                return { success: true };
            });

            return result;
        }),
});

export const appendCycleContextToSales = async (
    ctx: any,
    events: any[],
    search?: string,
    limit: number = 20
) => {
    // Fetch cumulative data for these cycles to calculate correct metrics
    const cycleIds = [...new Set(events.map(e => e.cycleId).filter(Boolean))] as string[];
    const historyIds = [...new Set(events.map(e => e.historyId).filter(Boolean))] as string[];

    const allCycleEvents = await ctx.db.query.saleEvents.findMany({
        where: or(
            cycleIds.length > 0 ? inArray(saleEvents.cycleId, cycleIds) : undefined,
            historyIds.length > 0 ? inArray(saleEvents.historyId, historyIds) : undefined
        ),
        with: { selectedReport: true } // Need selectedReport to get report-level age adjustments
    });

    // Fetch per-cycle recovery prices from saleMetrics
    const allGroupKeysForMetrics = [...new Set([...cycleIds, ...historyIds])];
    const metricsRows = allGroupKeysForMetrics.length > 0 ? await ctx.db.query.saleMetrics.findMany({
        where: or(
            ...allGroupKeysForMetrics.map(k => or(eq(saleMetrics.cycleId, k), eq(saleMetrics.historyId, k)))
        ),
        columns: { cycleId: true, historyId: true, recoveryPrice: true, feedPriceUsed: true, docPriceUsed: true }
    }) : [];
    const recoveryPriceMap = new Map<string, number>();
    const feedPriceUsedMap = new Map<string, number>();
    const docPriceUsedMap = new Map<string, number>();
    for (const m of metricsRows) {
        const key = m.cycleId || m.historyId || "";
        if (key && m.recoveryPrice) recoveryPriceMap.set(key, Number(m.recoveryPrice));
        if (key && m.feedPriceUsed) feedPriceUsedMap.set(key, Number(m.feedPriceUsed));
        if (key && m.docPriceUsed) docPriceUsedMap.set(key, Number(m.docPriceUsed));
    }

    const { revenueMap, weightMap, birdsSoldMap, latestMortalityMap, ageMap } = getCycleStatsWithMortality(allCycleEvents);

    // Pre-calculate LATEST feed intake for each History Group from ALL related events
    const historyFeedMap = new Map<string, number>();
    // Sort all events to ensure we find the latest one correctly
    const sortedAllEvents = [...allCycleEvents].sort((a, b) =>
        new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime()
    );

    const latestSaleIds = new Set<string>();
    const seenGroupsForLatest = new Set<string>();

    for (const ev of sortedAllEvents) {
        const groupKey = ev.cycleId || ev.historyId || "unknown";
        if (!seenGroupsForLatest.has(groupKey)) {
            latestSaleIds.add(ev.id);
            seenGroupsForLatest.add(groupKey);
        }

        if (ev.historyId && !historyFeedMap.has(ev.historyId)) {
            const bags = getFeedFromEvent(ev);
            historyFeedMap.set(ev.historyId, bags);
        }
    }

    // Compute per-sale cumulative birds sold (for remainingBirds)
    const perSaleCumulativeMap = new Map<string, number>();
    const groupedForCumulative: Record<string, typeof allCycleEvents> = {};
    for (const ev of allCycleEvents) {
        const gk = ev.cycleId || ev.historyId || "unknown";
        if (!groupedForCumulative[gk]) groupedForCumulative[gk] = [];
        groupedForCumulative[gk].push(ev);
    }
    for (const gk of Object.keys(groupedForCumulative)) {
        const sorted = [...groupedForCumulative[gk]].sort((a, b) =>
            new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime() ||
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        let running = 0;
        for (const ev of sorted) {
            running += ev.birdsSold || 0;
            perSaleCumulativeMap.set(ev.id, running);
        }
    }

    let formattedEvents = events.map(e => {
        const cycleOrHistory = e.cycle || e.history;
        const isEnded = !e.cycleId && !!e.historyId;
        const groupKey = e.cycleId || e.historyId || "unknown";
        const isLatestInGroup = latestSaleIds.has(e.id);

        const selectedReportForE = e.reports?.find(
            (r: any) => r.id === e.selectedReportId
        );

        const doc = cycleOrHistory?.doc || 0;
        // Use latest mortality from the last sale (synced with selected report) if available, else fallback to cycle mortality
        const mortality = latestMortalityMap.get(groupKey) ?? (cycleOrHistory?.mortality || 0);

        let age = cycleOrHistory?.age || 0;
        if (isEnded && isLatestInGroup) {
            const weightedAge = ageMap.get(groupKey);
            if (weightedAge && weightedAge > 0) {
                age = weightedAge;
            }
        } else {
            age = selectedReportForE?.age ?? e.age ?? age;
        }
        // FIX: Use the feed from the LATEST sale event
        const feedConsumed = isEnded
            ? (historyFeedMap.get(e.historyId!) ?? e.history?.finalIntake ?? 0)
            : (e.cycle?.intake || 0);

        // Get cumulative totals
        const cumulativeRevenue = revenueMap.get(groupKey) || 0;
        const cumulativeWeight = weightMap.get(groupKey) || 0;
        const cumulativeBirdsSold = birdsSoldMap.get(groupKey) || 0;
        const basePrice = recoveryPriceMap.get(groupKey) ?? BASE_SELLING_PRICE;
        const netAdjustment = ((cumulativeRevenue / cumulativeWeight) - basePrice) / 2;

        // Effective Rate = max(basePrice, basePrice + Net Adjustment)
        const effectiveRate = Math.max(basePrice, basePrice + netAdjustment);
        const formulaRevenue = effectiveRate * cumulativeWeight;

        // Calculate FCR/EPI
        const { fcr, epi } = calculateMetrics(doc, mortality, cumulativeWeight, feedConsumed, age, isEnded);

        // Profit calculation (backend-only)
        const feedPrice = feedPriceUsedMap.get(groupKey) ?? FEED_PRICE_PER_BAG;
        const docPrice = docPriceUsedMap.get(groupKey) ?? DOC_PRICE_PER_BIRD;
        const feedCost = isEnded ? feedConsumed * feedPrice : 0;
        const docCost = isEnded ? doc * docPrice : 0;
        const profit = formulaRevenue - feedCost - docCost;
        const avgPrice = cumulativeWeight > 0 ? cumulativeRevenue / cumulativeWeight : 0;

        // Sale age is fixed at sell/adjust time — just read from DB
        const saleAge = selectedReportForE?.age ?? e.age ?? cycleOrHistory?.age ?? 0;

        return {
            ...e,
            saleAge,
            feedConsumed: typeof e.feedConsumed === "string" ? JSON.parse(e.feedConsumed) : e.feedConsumed,
            feedStock: typeof e.feedStock === "string" ? JSON.parse(e.feedStock) : e.feedStock,
            cycleName: e.cycle?.name || e.history?.cycleName || "Unknown Batch",
            farmerName: e.cycle?.farmer?.name || e.history?.farmer?.name || "Unknown Farmer",
            farmerMobile: e.cycle?.farmer?.mobile || e.history?.farmer?.mobile || "",
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
                netAdjustment,
                feedCost,
                docCost,
                profit,
                avgPrice: parseFloat(avgPrice.toFixed(2)),
                recoveryPrice: recoveryPriceMap.get(groupKey) ?? null,
                birdType: cycleOrHistory?.birdType,
                createdAt: cycleOrHistory ? ((cycleOrHistory as any).startDate || (cycleOrHistory as any).createdAt) : null,
                officialInputDate: cycleOrHistory?.officialInputDate ?? null
            },
            remainingBirds: doc - (e.totalMortality ?? 0) - (perSaleCumulativeMap.get(e.id) ?? e.birdsSold ?? 0),
        };
    });

    if (search) {
        const searchLower = search.toLowerCase();
        formattedEvents = formattedEvents.filter(e =>
            e.farmerName.toLowerCase().includes(searchLower) ||
            (e.location && e.location.toLowerCase().includes(searchLower)) ||
            (e.party && e.party.toLowerCase().includes(searchLower))
        );
    }

    return formattedEvents.slice(0, limit);
};
