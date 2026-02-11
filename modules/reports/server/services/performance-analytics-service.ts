import { db } from "@/db";
import { cycleHistory, cycles, farmer, saleEvents, saleReports } from "@/db/schema";
import { and, eq, gte, lte, or, sql } from "drizzle-orm";

/**
 * Performance Analytics Service
 * 
 * Provides monthly performance report generation for officers.
 * Aggregates data from cycles (for DOC placement) and sale events
 * (for sales metrics, FCR, EPI, etc.)
 */

export interface MonthlyPerformance {
    month: string;
    monthNumber: number;
    chicksIn: number;
    chicksSold: number;
    averageAge: number;
    totalBirdWeight: number; // in kg
    feedConsumption: number; // in bags
    survivalRate: number; // percentage
    epi: number;
    fcr: number;
    averagePrice: number; // per kg
    totalRevenue: number;
}

export interface PerformanceSummary {
    year: number;
    officerId: string;
    monthlyData: MonthlyPerformance[];
    totalChicksIn: number;
    totalChicksSold: number;
    averageSurvivalRate: number;
    averageFCR: number;
    averageEPI: number;
    totalRevenue: number;
}

/**
 * Calculate FCR for a single sale event
 * FCR = Total Feed (kg) / Total Live Weight (kg)
 */
const calculateFCR = (feedBags: number, totalWeightKg: number): number => {
    if (totalWeightKg <= 0) return 0;
    const feedKg = feedBags * 50; // 50kg per bag
    return feedKg / totalWeightKg;
};

/**
 * Calculate EPI (Efficiency Production Index) for a sale event
 * EPI = (Survival % × Avg Weight kg) / (FCR × Age) × 100
 */
const calculateEPI = (
    survivalRate: number,
    avgWeightKg: number,
    fcr: number,
    age: number
): number => {
    if (fcr <= 0 || age <= 0) return 0;
    return (survivalRate * avgWeightKg) / (fcr * age) * 100;
};

/**
 * Parse feed JSON to count total bags
 */
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

/**
 * Get the feed consumed from a sale event
 * Uses the selected report's feed data if available, otherwise falls back to event data
 */
const getFeedFromSaleEvent = (
    event: any,
    selectedReport: any
): number => {
    if (selectedReport?.feedConsumed) {
        return countFeedBags(selectedReport.feedConsumed);
    }
    return countFeedBags(event.feedConsumed);
};

export class PerformanceAnalyticsService {
    /**
     * Generate annual performance report for an officer
     * @param officerId - ID of the officer
     * @param year - Year to generate report for (e.g., 2024)
     */
    static async getAnnualPerformance(
        officerId: string,
        year: number
    ): Promise<PerformanceSummary> {
        const monthlyData: MonthlyPerformance[] = [];

        // Generate data for each month (0-11)
        for (let month = 0; month < 12; month++) {
            const monthData = await this.getMonthlyPerformance(officerId, year, month);
            monthlyData.push(monthData);
        }

        // Calculate totals and averages
        const totalChicksIn = monthlyData.reduce((sum, m) => sum + m.chicksIn, 0);
        const totalChicksSold = monthlyData.reduce((sum, m) => sum + m.chicksSold, 0);

        // Calculate weighted averages (only from months with data)
        const monthsWithData = monthlyData.filter(m => m.chicksSold > 0);
        const averageSurvivalRate = monthsWithData.length > 0
            ? monthsWithData.reduce((sum, m) => sum + m.survivalRate, 0) / monthsWithData.length
            : 0;
        const averageFCR = monthsWithData.length > 0
            ? monthsWithData.reduce((sum, m) => sum + m.fcr, 0) / monthsWithData.length
            : 0;
        const averageEPI = monthsWithData.length > 0
            ? monthsWithData.reduce((sum, m) => sum + m.epi, 0) / monthsWithData.length
            : 0;

        const totalRevenue = monthlyData.reduce(
            (sum, m) => sum + m.totalRevenue,
            0
        );

        return {
            year,
            officerId,
            monthlyData,
            totalChicksIn,
            totalChicksSold,
            averageSurvivalRate,
            averageFCR,
            averageEPI,
            totalRevenue,
        };
    }

    /**
     * Generate performance data for a specific month
     * @param officerId - ID of the officer
     * @param year - Year (e.g., 2024)
     * @param month - Month (0-11, where 0 = January)
     */
    static async getMonthlyPerformance(
        officerId: string,
        year: number,
        month: number
    ): Promise<MonthlyPerformance> {
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        // Date range for the month
        const startOfMonth = new Date(year, month, 1);
        const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

        // 1. CHICKS IN: Get DOC from cycles STARTED in this month
        const chicksIn = await this.getChicksInForMonth(officerId, startOfMonth, endOfMonth);

        // 2. ALL OTHER METRICS: Get from sale events dated in this month
        const salesMetrics = await this.getSalesMetricsForMonth(officerId, startOfMonth, endOfMonth);

        return {
            month: monthNames[month],
            monthNumber: month,
            chicksIn,
            ...salesMetrics,
        };
    }

    /**
   * Get total DOC placement (Chicks IN) for cycles started in the given month
   */
    private static async getChicksInForMonth(
        officerId: string,
        startOfMonth: Date,
        endOfMonth: Date
    ): Promise<number> {
        // Query active cycles
        const currentCyclesResult = await db
            .select({ count: sql<number>`SUM(${cycles.doc})` })
            .from(cycles)
            .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
            .where(and(
                eq(farmer.officerId, officerId),
                gte(cycles.createdAt, startOfMonth),
                lte(cycles.createdAt, endOfMonth)
            ));

        // Query archived cycles
        const pastCyclesResult = await db
            .select({ count: sql<number>`SUM(${cycleHistory.doc})` })
            .from(cycleHistory)
            .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
            .where(and(
                eq(farmer.officerId, officerId),
                gte(cycleHistory.startDate, startOfMonth),
                lte(cycleHistory.startDate, endOfMonth)
            ));

        const activeCount = Number(currentCyclesResult[0]?.count || 0);
        const pastCount = Number(pastCyclesResult[0]?.count || 0);

        return activeCount + pastCount;
    }

    /**
     * Get sales metrics from sale events dated in the given month
     */
    private static async getSalesMetricsForMonth(
        officerId: string,
        startOfMonth: Date,
        endOfMonth: Date
    ): Promise<Omit<MonthlyPerformance, 'month' | 'monthNumber' | 'chicksIn'>> {
        // Fetch sale events with their selected reports using Drizzle query builder
        const sales = await db
            .select({
                birds_sold: saleEvents.birdsSold,
                total_weight: saleEvents.totalWeight,
                price_per_kg: saleEvents.pricePerKg,
                total_amount: saleEvents.totalAmount,
                total_mortality: saleEvents.totalMortality,
                house_birds: saleEvents.houseBirds,
                feed_consumed: saleEvents.feedConsumed,
                selected_report_id: saleEvents.selectedReportId,
                report_feed_consumed: saleReports.feedConsumed,
                cycle_age: cycles.age,
                history_age: cycleHistory.age
            })
            .from(saleEvents)
            .leftJoin(saleReports, eq(saleEvents.selectedReportId, saleReports.id))
            .leftJoin(cycles, eq(saleEvents.cycleId, cycles.id))
            .leftJoin(cycleHistory, eq(saleEvents.historyId, cycleHistory.id))
            .leftJoin(farmer, or(
                eq(cycles.farmerId, farmer.id),
                eq(cycleHistory.farmerId, farmer.id)
            ))
            .where(and(
                eq(farmer.officerId, officerId),
                gte(saleEvents.saleDate, startOfMonth),
                lte(saleEvents.saleDate, endOfMonth)
            ));

        if (sales.length === 0) {
            return {
                chicksSold: 0,
                averageAge: 0,
                totalBirdWeight: 0,
                feedConsumption: 0,
                survivalRate: 0,
                epi: 0,
                fcr: 0,
                averagePrice: 0,
                totalRevenue: 0,
            };
        }

        // Aggregate metrics
        let totalBirdsSold = 0;
        let totalWeight = 0;
        let totalAmount = 0;
        let totalFeedBags = 0;
        let totalPrice = 0;
        let totalAge = 0;
        let survivalRates: number[] = [];
        let fcrs: number[] = [];
        let epis: number[] = [];

        for (const sale of sales) {
            const birdsSold = Number(sale.birds_sold) || 0;
            const weight = parseFloat(sale.total_weight) || 0;
            const amount = parseFloat(sale.total_amount) || 0;
            const price = parseFloat(sale.price_per_kg) || 0;
            const age = Number(sale.cycle_age || sale.history_age) || 0;
            const houseBirds = Number(sale.house_birds) || 0;
            const mortality = Number(sale.total_mortality) || 0;

            // Use report feed if available, otherwise use event feed
            const feedBags = countFeedBags(sale.report_feed_consumed || sale.feed_consumed);

            totalBirdsSold += birdsSold;
            totalWeight += weight;
            totalAmount += amount;
            totalFeedBags += feedBags;
            totalPrice += price;
            totalAge += age;

            // Calculate per-sale metrics
            if (houseBirds > 0) {
                const survivalRate = ((houseBirds - mortality) / houseBirds) * 100;
                survivalRates.push(survivalRate);
            }

            if (weight > 0 && feedBags > 0) {
                const fcr = calculateFCR(feedBags, weight);
                fcrs.push(fcr);

                if (birdsSold > 0 && age > 0) {
                    const avgWeight = weight / birdsSold;
                    const survivalRate = houseBirds > 0 ? ((houseBirds - mortality) / houseBirds) * 100 : 0;
                    const epi = calculateEPI(survivalRate, avgWeight, fcr, age);
                    epis.push(epi);
                }
            }
        }

        const numSales = sales.length;

        return {
            chicksSold: totalBirdsSold,
            averageAge: numSales > 0 ? totalAge / numSales : 0,
            totalBirdWeight: totalWeight,
            feedConsumption: totalFeedBags,
            survivalRate: survivalRates.length > 0
                ? survivalRates.reduce((sum, rate) => sum + rate, 0) / survivalRates.length
                : 0,
            epi: epis.length > 0
                ? epis.reduce((sum, epi) => sum + epi, 0) / epis.length
                : 0,
            fcr: fcrs.length > 0
                ? fcrs.reduce((sum, fcr) => sum + fcr, 0) / fcrs.length
                : 0,
            averagePrice: numSales > 0 ? totalPrice / numSales : 0,
            totalRevenue: totalAmount,
        };
    }
}
