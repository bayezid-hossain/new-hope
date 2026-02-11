import { cycleHistory, cycles, farmer, member, saleEvents } from "@/db/schema";
import { PerformanceAnalyticsService } from "@/modules/reports/server/services/performance-analytics-service";
import { createTRPCRouter, proProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, eq, or, sql } from "drizzle-orm";
import { z } from "zod";

/**
 * Performance Reports Router
 * 
 * Provides endpoints for officers to access their monthly/annual performance data.
 * All endpoints are pro-gated (require active pro subscription).
 */

export const performanceReportsRouter = createTRPCRouter({
    /**
     * Get annual performance report for an officer
     * Pro feature - shows monthly breakdown for an entire year
     */
    getAnnualPerformance: proProcedure
        .input(z.object({
            year: z.number().min(2020).max(2100),
            officerId: z.string().optional(), // Admin/Manager can specify officer ID
        }))
        .query(async ({ ctx, input }) => {
            // Determine which officer's data to fetch
            let targetOfficerId = input.officerId || ctx.user.id;

            // Authorization: Officers can only see their own data
            // Managers/Admins can see any officer in their org
            if (input.officerId && input.officerId !== ctx.user.id) {
                // User is requesting someone else's data
                if (ctx.user.globalRole !== "ADMIN") {
                    // Check if user is a manager in the same org as the target officer
                    const [targetMembership] = await ctx.db
                        .select()
                        .from(member)
                        .where(and(
                            eq(member.userId, input.officerId),
                            eq(member.status, "ACTIVE")
                        ))
                        .limit(1);

                    if (!targetMembership) {
                        throw new TRPCError({
                            code: "NOT_FOUND",
                            message: "Officer not found"
                        });
                    }

                    const [requesterMembership] = await ctx.db
                        .select()
                        .from(member)
                        .where(and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, targetMembership.organizationId),
                            eq(member.status, "ACTIVE")
                        ))
                        .limit(1);

                    if (!requesterMembership ||
                        (requesterMembership.role !== "MANAGER" && requesterMembership.role !== "OWNER")) {
                        throw new TRPCError({
                            code: "FORBIDDEN",
                            message: "You don't have permission to view this officer's data"
                        });
                    }

                    // STRICT MODE CHECK: Must be in Management Mode to view others
                    if (requesterMembership.activeMode !== "MANAGEMENT") {
                        throw new TRPCError({
                            code: "FORBIDDEN",
                            message: "You must be in Management Mode to view other officers' reports."
                        });
                    }
                }
            }

            // Fetch performance data
            const performanceData = await PerformanceAnalyticsService.getAnnualPerformance(
                targetOfficerId,
                input.year
            );

            return performanceData;
        }),

    /**
     * Get performance summary for a custom date range
     * Pro feature - allows filtering by specific months or date ranges
     */
    getPerformanceSummary: proProcedure
        .input(z.object({
            startYear: z.number().min(2020),
            startMonth: z.number().min(0).max(11), // 0-11
            endYear: z.number().min(2020),
            endMonth: z.number().min(0).max(11),
            officerId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            let targetOfficerId = input.officerId || ctx.user.id;

            // Same authorization logic as above
            if (input.officerId && input.officerId !== ctx.user.id) {
                if (ctx.user.globalRole !== "ADMIN") {
                    const [targetMembership] = await ctx.db
                        .select()
                        .from(member)
                        .where(and(
                            eq(member.userId, input.officerId),
                            eq(member.status, "ACTIVE")
                        ))
                        .limit(1);

                    if (!targetMembership) {
                        throw new TRPCError({ code: "NOT_FOUND", message: "Officer not found" });
                    }

                    const [requesterMembership] = await ctx.db
                        .select()
                        .from(member)
                        .where(and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, targetMembership.organizationId),
                            eq(member.status, "ACTIVE")
                        ))
                        .limit(1);

                    if (!requesterMembership ||
                        (requesterMembership.role !== "MANAGER" && requesterMembership.role !== "OWNER")) {
                        throw new TRPCError({ code: "FORBIDDEN" });
                    }

                    // STRICT MODE CHECK
                    if (requesterMembership.activeMode !== "MANAGEMENT") {
                        throw new TRPCError({
                            code: "FORBIDDEN",
                            message: "You must be in Management Mode to view other officers' reports."
                        });
                    }
                }
            }

            // Aggregate data for the date range
            const monthlyData = [];
            let currentYear = input.startYear;
            let currentMonth = input.startMonth;

            while (
                currentYear < input.endYear ||
                (currentYear === input.endYear && currentMonth <= input.endMonth)
            ) {
                const monthData = await PerformanceAnalyticsService.getMonthlyPerformance(
                    targetOfficerId,
                    currentYear,
                    currentMonth
                );
                monthlyData.push(monthData);

                // Move to next month
                currentMonth++;
                if (currentMonth > 11) {
                    currentMonth = 0;
                    currentYear++;
                }
            }

            // Calculate aggregated totals
            const totalChicksIn = monthlyData.reduce((sum, m) => sum + m.chicksIn, 0);
            const totalChicksSold = monthlyData.reduce((sum, m) => sum + m.chicksSold, 0);
            const totalWeight = monthlyData.reduce((sum, m) => sum + m.totalBirdWeight, 0);
            const totalFeed = monthlyData.reduce((sum, m) => sum + m.feedConsumption, 0);

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
            const averagePrice = monthsWithData.length > 0
                ? monthsWithData.reduce((sum, m) => sum + m.averagePrice, 0) / monthsWithData.length
                : 0;

            return {
                monthlyData,
                summary: {
                    totalChicksIn,
                    totalChicksSold,
                    totalWeight,
                    totalFeed,
                    averageSurvivalRate,
                    averageFCR,
                    averageEPI,
                    averagePrice,
                    totalRevenue: totalWeight * averagePrice,
                },
            };
        }),

    /**
     * Get list of available years with performance data
     * Helps users know which years they can view
     */
    getAvailableYears: proProcedure
        .input(z.object({
            officerId: z.string().optional(),
        }))
        .query(async ({ ctx, input }) => {
            let targetOfficerId = input.officerId || ctx.user.id;

            // Same authorization check
            if (input.officerId && input.officerId !== ctx.user.id) {
                if (ctx.user.globalRole !== "ADMIN") {
                    const [targetMembership] = await ctx.db
                        .select()
                        .from(member)
                        .where(and(
                            eq(member.userId, input.officerId),
                            eq(member.status, "ACTIVE")
                        ))
                        .limit(1);

                    if (!targetMembership) {
                        throw new TRPCError({ code: "NOT_FOUND" });
                    }

                    const [requesterMembership] = await ctx.db
                        .select()
                        .from(member)
                        .where(and(
                            eq(member.userId, ctx.user.id),
                            eq(member.organizationId, targetMembership.organizationId),
                            eq(member.status, "ACTIVE")
                        ))
                        .limit(1);

                    if (!requesterMembership ||
                        (requesterMembership.role !== "MANAGER" && requesterMembership.role !== "OWNER")) {
                        throw new TRPCError({ code: "FORBIDDEN" });
                    }

                    // STRICT MODE CHECK
                    if (requesterMembership.activeMode !== "MANAGEMENT") {
                        throw new TRPCError({
                            code: "FORBIDDEN",
                            message: "You must be in Management Mode to view other officers' data."
                        });
                    }
                }
            }

            // Get distinct years from active cycles
            const currentYearsQuery = await ctx.db
                .select({
                    year: sql<number>`EXTRACT(YEAR FROM ${cycles.createdAt})::int`
                })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(eq(farmer.officerId, targetOfficerId));

            // Get distinct years from archived cycles
            const pastYearsQuery = await ctx.db
                .select({
                    year: sql<number>`EXTRACT(YEAR FROM ${cycleHistory.startDate})::int`
                })
                .from(cycleHistory)
                .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
                .where(eq(farmer.officerId, targetOfficerId));

            // Get distinct years from sale events
            const saleYearsQuery = await ctx.db
                .select({
                    year: sql<number>`EXTRACT(YEAR FROM ${saleEvents.saleDate})::int`
                })
                .from(saleEvents)
                .leftJoin(cycles, eq(saleEvents.cycleId, cycles.id))
                .leftJoin(cycleHistory, eq(saleEvents.historyId, cycleHistory.id))
                .leftJoin(farmer, or(
                    eq(cycles.farmerId, farmer.id),
                    eq(cycleHistory.farmerId, farmer.id)
                ))
                .where(eq(farmer.officerId, targetOfficerId));

            // Merge and get unique years
            const yearsSet = new Set<number>();
            currentYearsQuery.forEach(row => {
                if (row.year) yearsSet.add(row.year);
            });
            pastYearsQuery.forEach(row => {
                if (row.year) yearsSet.add(row.year);
            });
            saleYearsQuery.forEach(row => {
                if (row.year) yearsSet.add(row.year);
            });

            const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

            return {
                years: sortedYears,
            };
        }),
});
