import { BASE_SELLING_PRICE, DOC_PRICE_PER_BIRD, FEED_PRICE_PER_BAG } from "@/constants";
import { db } from "@/db";
import { cycleHistory, cycles, pricePolicies, saleEvents, saleMetrics } from "@/db/schema";
import { and, desc, eq, lte } from "drizzle-orm";

export class SaleMetricsService {
    /**
     * Recalculate metrics for a cycle based on ALL its sales
     * Called when:
     * - A new sale is added to the cycle
     * - Any sale in the cycle is adjusted
     * - The cycle is ended
     */
    static async recalculateForCycle(
        cycleId?: string,
        historyId?: string,
        tx?: any,
        recoveryPrice?: number,
        feedPriceOverride?: number,
        docPriceOverride?: number
    ): Promise<void> {
        if (!cycleId && !historyId) throw new Error("Must provide cycleId or historyId");

        const dbConnection = tx ?? db;

        // 1. Fetch ALL sales for this cycle
        const sales = await dbConnection.query.saleEvents.findMany({
            where: cycleId
                ? eq(saleEvents.cycleId, cycleId)
                : eq(saleEvents.historyId, historyId!),
            with: {
                selectedReport: true, // Get the active version of each sale
            }
        });

        if (sales.length === 0) {
            // No sales yet, delete any existing metrics
            await dbConnection.delete(saleMetrics).where(
                cycleId
                    ? eq(saleMetrics.cycleId, cycleId)
                    : eq(saleMetrics.historyId, historyId!)
            );
            return;
        }

        // 2. Aggregate data from all sales (using selected versions)
        let totalBirdsSold = 0;
        let totalWeight = 0;
        let totalRevenue = 0;
        let totalMedicineCost = 0;
        let totalFeedBags = 0;

        // Get cycle data for DOC and mortality
        const cycle = cycleId
            ? await dbConnection.query.cycles.findFirst({
                where: eq(cycles.id, cycleId),
                with: {
                    farmer: {
                        with: {
                            organization: true
                        }
                    }
                }
            })
            : await dbConnection.query.cycleHistory.findFirst({
                where: eq(cycleHistory.id, historyId!),
                with: {
                    farmer: {
                        with: {
                            organization: true
                        }
                    }
                }
            });

        if (!cycle) return;

        const cycleStartDate = cycleId ? cycle.createdAt : cycle.startDate;

        // Sort sales first — needed to find latest sale date for price policy lookup
        const sortedSales = [...sales].sort((a, b) => {
            const dateDiff = new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
            if (dateDiff !== 0) return dateDiff;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        const latestSale = sortedSales.length > 0 ? sortedSales[0] : null;

        // Determine the reference date for price policy lookup.
        // Use the date of the most recent sale so prices reflect when the sale activity occurred.
        // Ended cycles: use cycleHistory.endDate (set at archive time, matches last sale).
        // Active cycles: use the latest sale's saleDate, or cycle.createdAt if no sales yet.
        const priceDate = historyId
            ? (cycle as typeof cycleHistory.$inferSelect).endDate
            : (latestSale ? new Date(latestSale.saleDate) : cycle.createdAt);

        const orgId = cycle.organizationId ?? cycle.farmer?.organization?.id ?? "";

        if (!orgId) {
            console.warn(`[recalculateForCycle] No orgId found for ${historyId ? `history ${historyId}` : `cycle ${cycleId}`} — price policy lookup will use defaults`);
        }

        // Look up price policy effective at priceDate (or use explicit overrides)
        const policyPrices = await SaleMetricsService.getPriceForDate(orgId, priceDate, tx);
        const orgFeedPrice = feedPriceOverride ?? policyPrices.feedPrice;
        const docPriceUsed = docPriceOverride ?? policyPrices.docPrice;

        // Use per-cycle recovery price if provided, otherwise fallback to policy price
        const basePrice = recoveryPrice ?? policyPrices.basePrice;

        let netAdjustment = 0;

        for (const sale of sales) {
            // Use selected report data if available, otherwise use event data
            const data = sale.selectedReport || sale;

            const birdsSold = Number(data.birdsSold);
            const weight = parseFloat(data.totalWeight);
            const amount = parseFloat(data.totalAmount);
            const price = parseFloat(data.pricePerKg);

            totalBirdsSold += birdsSold;
            totalWeight += isNaN(weight) ? 0 : weight;
            totalRevenue += isNaN(amount) ? 0 : amount;
            totalMedicineCost += parseFloat(data.medicineCost || "0") || 0;

            // Calculate Price Adjustment (Weighted)
            // Weight individual sale price delta by its volume (kg)
            const diff = price - basePrice;
            if (diff > 0) {
                netAdjustment += (diff / 2) * weight;
            } else {
                netAdjustment += diff * weight;
            }
        }

        // Normalize weighted adjustment by total weight
        netAdjustment = totalWeight > 0 ? netAdjustment / totalWeight : 0;

        // Determine Total Feed Consumption
        // Logic:
        // 1. If Active Cycle: Use cycle.intake (which includes estimated living consumption + sold/dead locked intake)
        // 2. If History (Ended): Use the feed from the LATEST sale event (cumulative).
        //    Fallback to history.finalIntake if available.

        if (cycleId) {
            // Active Cycle: cycle.intake is the master source of truth (managed by feed-service)
            // Need to cast to any/unknown first because cycle could be from cycles or cycleHistory table type definition mismatch in the union
            const activeCycle = cycle as typeof cycles.$inferSelect;
            totalFeedBags = Number(activeCycle.intake) || 0;
        } else {
            // Ended Cycle: Use latest sale's feed data (which should be the final cumulative amount)
            if (latestSale) {
                totalFeedBags = this.countFeedBags(
                    latestSale.selectedReport?.feedConsumed || latestSale.feedConsumed
                );
            } else {
                // No sales? Fallback to history final intake
                const endedCycle = cycle as typeof cycleHistory.$inferSelect;
                totalFeedBags = Number(endedCycle.finalIntake) || 0;
            }
        }

        const numSales = sales.length;

        // Calculate Weighted Average Age
        // Formula: Sum(Bird-Days) / Total Birds Sold where Bird-Days = birds sold * Age at Sale
        let totalBirdDays = 0;
        const MS_PER_DAY = 1000 * 60 * 60 * 24;

        for (const sale of sales) {
            const data = sale.selectedReport || sale;
            const birdsSold = Number(data.birdsSold) || 0;
            const birdsRejected = Number(data.birdsRejected) || 0;

            // Prefer report-level age (set via "Edit Sale Age") over the raw event age
            const ageAtSale = data.age ?? sale.age ?? (() => {
                const saleDate = new Date(sale.saleDate);
                const cycleStart = new Date(cycleStartDate);
                saleDate.setHours(0, 0, 0, 0);
                cycleStart.setHours(0, 0, 0, 0);

                const diffTime = saleDate.getTime() - cycleStart.getTime();
                return Math.max(1, Math.round(diffTime / MS_PER_DAY) + 1);
            })();

            totalBirdDays += (birdsSold + birdsRejected) * ageAtSale;
        }

        // Revert to using Cycle Age for EPI to match frontend (sales-history-card.tsx) if no sales
        const rawAverageAge = totalBirdsSold > 0 ? (totalBirdDays / totalBirdsSold) : (cycle.age || 0);
        const averageAge = Number(rawAverageAge.toFixed(2));
        
        // Get rejected birds from the latest sale (matches how totalMortality is sourced)
        const latestSaleData = latestSale?.selectedReport || latestSale;
        const totalBirdsRejected = Number(latestSaleData?.birdsRejected) || 0;

        // Calculate Average Weight using SURVIVORS (DOC - Mortality - Rejected) to match frontend logic
        // This accounts for missing birds/theft which reduces the effective average weight of the flock
        const survivors = cycle.doc - (cycle.mortality || 0) - totalBirdsRejected;
        const averageWeight = survivors > 0 ? totalWeight / survivors : 0;

        // 3. Calculate metrics
        const fcr = this.calculateFCR(totalFeedBags, totalWeight);
        const survivalRate = this.calculateSR(cycle.doc, cycle.mortality || 0, totalBirdsRejected);
        const epi = this.calculateEPI(survivalRate, averageWeight, fcr, averageAge);

        // 4. Calculate costs and profit
        // Profit Formula matches sales-history-card.tsx:
        // Profit = Formula Revenue - DOC Cost - Feed Cost
        // Medicine Cost is EXCLUDED from profit calculation (but still tracked)

        const effectiveRate = Math.max(basePrice, basePrice + netAdjustment);
        const formulaRevenue = effectiveRate * totalWeight;

        const docCost = cycle.doc * docPriceUsed;
        const feedCost = totalFeedBags * orgFeedPrice;

        // Use formula revenue for profit, and exclude medicine cost
        const netProfit = formulaRevenue - docCost - feedCost;

        // 5. Upsert metrics
        await dbConnection.insert(saleMetrics).values({
            cycleId,
            historyId,
            fcr: fcr.toString(),
            epi: epi.toString(),
            survivalRate: survivalRate.toString(),
            averageWeight: averageWeight.toString(),
            totalBirdsSold,
            totalDoc: cycle.doc,
            totalMortality: cycle.mortality || 0,
            averageAge: averageAge.toString(),
            docCost: docCost.toString(),
            feedCost: feedCost.toString(),
            medicineCost: totalMedicineCost.toString(),
            totalRevenue: totalRevenue.toString(),
            netProfit: netProfit.toFixed(2).toString(),
            feedPriceUsed: orgFeedPrice.toString(),
            docPriceUsed: docPriceUsed.toString(),
            recoveryPrice: (recoveryPrice ?? policyPrices.basePrice).toString(),
            lastRecalculatedAt: new Date(),
        }).onConflictDoUpdate({
            target: cycleId ? [saleMetrics.cycleId] : [saleMetrics.historyId],
            set: {
                fcr: fcr.toString(),
                epi: epi.toString(),
                survivalRate: survivalRate.toString(),
                averageWeight: averageWeight.toString(),
                totalBirdsSold,
                totalMortality: cycle.mortality || 0,
                averageAge: averageAge.toString(),
                feedCost: feedCost.toString(),
                medicineCost: totalMedicineCost.toString(),
                totalRevenue: totalRevenue.toString(),
                netProfit: netProfit.toString(),
                feedPriceUsed: orgFeedPrice.toString(),
                docPriceUsed: docPriceUsed.toString(),
                recoveryPrice: (recoveryPrice ?? policyPrices.basePrice).toString(),
                lastRecalculatedAt: new Date(),
            }
        });
    }

    static async getPriceForDate(
        orgId: string,
        date: Date,
        tx?: any
    ): Promise<{ feedPrice: number; docPrice: number; basePrice: number }> {
        if (!orgId) {
            console.warn("[getPriceForDate] orgId is empty — falling back to default constants");
        }
        const dbConn = tx ?? db;
        const policy = await dbConn.query.pricePolicies.findFirst({
            where: and(
                eq(pricePolicies.organizationId, orgId),
                lte(pricePolicies.effectiveFrom, date)
            ),
            orderBy: [desc(pricePolicies.effectiveFrom)],
        });
        return {
            feedPrice: Number(policy?.feedPricePerBag) || FEED_PRICE_PER_BAG,
            docPrice:  Number(policy?.docPricePerBird) || DOC_PRICE_PER_BIRD,
            basePrice: Number(policy?.baseSellPrice)   || BASE_SELLING_PRICE,
        };
    }

    // Helper methods
    private static calculateFCR(feedBags: number, totalWeightKg: number): number {
        if (totalWeightKg <= 0) return 0;
        return (feedBags * 50) / totalWeightKg;
    }

    private static calculateSR(doc: number, mortality: number, rejected: number = 0): number {
        if (doc <= 0) return 0;
        return ((doc - mortality - rejected) / doc) * 100;
    }

    private static calculateEPI(
        survivalRate: number,
        avgWeight: number,
        fcr: number,
        age: number
    ): number {
        if (fcr <= 0 || age <= 0) return 0;
        return (survivalRate * avgWeight) / (fcr * age) * 100;
    }

    private static countFeedBags(feedJson: string): number {
        try {
            const items = JSON.parse(feedJson) as { bags: number }[];
            return items.reduce((sum, item) => sum + (Number(item.bags) || 0), 0);
        } catch {
            return 0;
        }
    }
}
