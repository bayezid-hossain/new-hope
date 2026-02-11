import { DOC_PRICE_PER_BIRD, FEED_PRICE_PER_BAG } from "@/constants";
import { db } from "@/db";
import { cycleHistory, cycles, saleMetrics } from "@/db/schema";
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
        historyId?: string
    ): Promise<void> {
        if (!cycleId && !historyId) throw new Error("Must provide cycleId or historyId");

        // 1. Fetch ALL sales for this cycle
        const sales = await db.query.saleEvents.findMany({
            where: (saleEvents, { eq }) => cycleId
                ? eq(saleEvents.cycleId, cycleId)
                : eq(saleEvents.historyId, historyId!),
            with: {
                selectedReport: true, // Get the active version of each sale
            }
        });

        if (sales.length === 0) {
            // No sales yet, delete any existing metrics
            await db.delete(saleMetrics).where(
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
        let totalAge = 0;

        // Get cycle data for DOC and mortality
        const cycle = cycleId
            ? await db.query.cycles.findFirst({ where: eq(cycles.id, cycleId) })
            : await db.query.cycleHistory.findFirst({ where: eq(cycleHistory.id, historyId!) });

        if (!cycle) return;

        for (const sale of sales) {
            // Use selected report data if available, otherwise use event data
            const data = sale.selectedReport || sale;

            const birdsSold = Number(data.birdsSold);
            const weight = parseFloat(data.totalWeight);
            const amount = parseFloat(data.totalAmount);

            totalBirdsSold += birdsSold;
            totalWeight += isNaN(weight) ? 0 : weight;
            totalRevenue += isNaN(amount) ? 0 : amount;
            totalMedicineCost += parseFloat(data.medicineCost || "0") || 0;
            totalFeedBags += this.countFeedBags(
                sale.selectedReport?.feedConsumed || sale.feedConsumed
            );

            // Age from cycle, not individual sales
            totalAge += (cycle.age || 0);
        }

        const numSales = sales.length;
        const averageAge = numSales > 0 ? totalAge / numSales : 0;
        const averageWeight = totalBirdsSold > 0 ? totalWeight / totalBirdsSold : 0;

        // 3. Calculate metrics
        const fcr = this.calculateFCR(totalFeedBags, totalWeight);
        const survivalRate = this.calculateSR(cycle.doc, cycle.mortality || 0);
        const epi = this.calculateEPI(survivalRate, averageWeight, fcr, averageAge);

        // 4. Calculate costs
        const docCost = cycle.doc * DOC_PRICE_PER_BIRD;
        const feedCost = totalFeedBags * FEED_PRICE_PER_BAG;
        const netProfit = totalRevenue - docCost - feedCost - totalMedicineCost;

        // 5. Upsert metrics
        await db.insert(saleMetrics).values({
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
            netProfit: netProfit.toString(),
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
