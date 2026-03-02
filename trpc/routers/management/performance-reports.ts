import { db } from "@/db";
import { member, user } from "@/db/schema";
import { PerformanceAnalyticsService } from "@/modules/reports/server/services/performance-analytics-service";
import { createTRPCRouter, managementProcedure, managementProProcedure } from "@/trpc/init";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

export const managementPerformanceReportsRouter = createTRPCRouter({
    getMonthlyProductionRecord: managementProcedure
        .input(z.object({
            officerId: z.string(),
            year: z.number(),
            month: z.number(), // 0-11
        }))
        .query(async ({ input }) => {
            return await PerformanceAnalyticsService.getMonthlyProductionRecord(
                input.officerId,
                input.year,
                input.month
            );
        }),

    getAnnualPerformance: managementProProcedure
        .input(z.object({
            officerId: z.string(),
            year: z.number().min(2020).max(2100),
        }))
        .query(async ({ input }) => {
            return await PerformanceAnalyticsService.getAnnualPerformance(
                input.officerId,
                input.year
            );
        }),

    getRangeProductionRecords: managementProProcedure
        .input(z.object({
            officerId: z.string(),
            startMonth: z.number().min(0).max(11),
            startYear: z.number().int().min(2000).max(2100),
            endMonth: z.number().min(0).max(11),
            endYear: z.number().int().min(2000).max(2100),
        }))
        .query(async ({ input }) => {
            const { officerId, startMonth, startYear, endMonth, endYear } = input;
            const records = [];

            let currentYear = startYear;
            let currentMonth = startMonth;

            while (
                currentYear < endYear ||
                (currentYear === endYear && currentMonth <= endMonth)
            ) {
                const record = await PerformanceAnalyticsService.getMonthlyProductionRecord(
                    officerId,
                    currentYear,
                    currentMonth
                );
                records.push({
                    month: currentMonth,
                    year: currentYear,
                    monthName: new Date(currentYear, currentMonth).toLocaleString('default', { month: 'long' }),
                    ...record
                });

                currentMonth++;
                if (currentMonth > 11) {
                    currentMonth = 0;
                    currentYear++;
                }
            }

            return records;
        }),

    getOfficersInOrg: managementProcedure
        .query(async ({ ctx }) => {
            return await db
                .select({
                    id: user.id,
                    name: user.name,
                    role: member.role,
                    branchName: user.branchName,
                    mobile: user.mobile,
                })
                .from(member)
                .innerJoin(user, eq(member.userId, user.id))
                .where(eq(member.organizationId, ctx.membership?.organizationId ?? ""))
                .orderBy(asc(user.name));
        }),
});
