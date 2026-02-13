import { BASE_SELLING_PRICE, DOC_PRICE_PER_BIRD, FEED_PRICE_PER_BAG } from "@/constants";
import { db } from "@/db";
import { cycleHistory, cycles, saleEvents, saleMetrics } from "@/db/schema";
import { eq } from "drizzle-orm";

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
        tx?: any
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
        // Use organization's feed price if available, otherwise fallback to constant
        // Note: We use the CURRENT feed price. Ideally this should be snapshot at cycle creation,
        // but for now this is better than a hardcoded constant.
        const orgFeedPrice = Number(cycle.farmer?.organization?.feedPricePerBag) || FEED_PRICE_PER_BAG;

        // Sort sales to find the latest one (Logic matches sales.ts)
        const sortedSales = [...sales].sort((a, b) => {
            const dateDiff = new Date(b.saleDate).getTime() - new Date(a.saleDate).getTime();
            if (dateDiff !== 0) return dateDiff;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });

        const latestSale = sortedSales.length > 0 ? sortedSales[0] : null;

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

            // Calculate Price Adjustment
            const diff = price - BASE_SELLING_PRICE;
            if (diff > 0) {
                netAdjustment += diff / 2;
            } else {
                netAdjustment += diff;
            }
        }

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
        // Revert to using Cycle Age for EPI to match frontend (sales-history-card.tsx)
        const averageAge = cycle.age || 0;

        // Calculate Average Weight using SURVIVORS (DOC - Mortality) to match frontend logic
        // This accounts for missing birds/theft which reduces the effective average weight of the flock
        const survivors = cycle.doc - (cycle.mortality || 0);
        const averageWeight = survivors > 0 ? totalWeight / survivors : 0;

        // 3. Calculate metrics
        const fcr = this.calculateFCR(totalFeedBags, totalWeight);
        const survivalRate = this.calculateSR(cycle.doc, cycle.mortality || 0);
        const epi = this.calculateEPI(survivalRate, averageWeight, fcr, averageAge);

        // 4. Calculate costs and profit
        // Profit Formula matches sales-history-card.tsx:
        // Profit = Formula Revenue - DOC Cost - Feed Cost
        // Medicine Cost is EXCLUDED from profit calculation (but still tracked)

        const effectiveRate = Math.max(BASE_SELLING_PRICE, BASE_SELLING_PRICE + netAdjustment);
        const formulaRevenue = effectiveRate * totalWeight;

        const docCost = cycle.doc * DOC_PRICE_PER_BIRD;
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
            feedPriceUsed: FEED_PRICE_PER_BAG.toString(),
            docPriceUsed: DOC_PRICE_PER_BIRD.toString(),
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
                lastRecalculatedAt: new Date(),
            }
        });
    }

    // Helper methods
    private static calculateFCR(feedBags: number, totalWeightKg: number): number {
        if (totalWeightKg <= 0) return 0;
        return (feedBags * 50) / totalWeightKg;
    }

    private static calculateSR(doc: number, mortality: number): number {
        if (doc <= 0) return 0;
        return ((doc - mortality) / doc) * 100;
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
