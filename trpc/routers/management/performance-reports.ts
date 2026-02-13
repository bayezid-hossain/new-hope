import { db } from "@/db";
import { member, user } from "@/db/schema";
import { PerformanceAnalyticsService } from "@/modules/reports/server/services/performance-analytics-service";
import { createTRPCRouter, managementProcedure } from "@/trpc/init";
import { and, eq } from "drizzle-orm";
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

    getOfficersInOrg: managementProcedure
        .query(async ({ ctx }) => {
            // Get all officers in the current organization
            const officers = await db
                .select({
                    id: user.id,
                    name: user.name,
                    role: member.role,
                })
                .from(member)
                .innerJoin(user, eq(member.userId, user.id))
                .where(and(
                    eq(member.organizationId, ctx.membership?.organizationId ?? ""),
                    eq(member.role, "OFFICER")
                ));

            return officers;
        }),
});
