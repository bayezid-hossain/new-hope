import { db } from "@/db";
import { featureRequest, member, organization, user } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, createTRPCRouter } from "../../init";
import { adminCyclesRouter } from "./cycles";
import { adminOfficersRouter } from "./officers";
import { adminOrganizationRouter } from "./organization";
import { adminStatsRouter } from "./stats";

export const adminRouter = createTRPCRouter({
  cycles: adminCyclesRouter,
  organizations: adminOrganizationRouter,
  officers: adminOfficersRouter,
  stats: adminStatsRouter,

  listFeatureRequests: adminProcedure
    .query(async () => {
      const requests = await db
        .select({
          id: featureRequest.id,
          feature: featureRequest.feature,
          status: featureRequest.status,
          createdAt: featureRequest.createdAt,
          updatedAt: featureRequest.updatedAt,
          organizationName: sql<string>`(
            SELECT ${organization.name} FROM ${organization}
            JOIN ${member} ON ${member.organizationId} = ${organization.id}
            WHERE ${member.userId} = ${user.id}
            LIMIT 1
          )`.as("organization_name"),
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            isPro: user.isPro,
            proExpiresAt: user.proExpiresAt,
          },
        })
        .from(featureRequest)
        .leftJoin(user, eq(featureRequest.userId, user.id))
        .orderBy(desc(featureRequest.status));

      return requests;
    }),

  approveFeatureRequest: adminProcedure
    .input(z.object({
      requestId: z.string(),
      months: z.number().min(1).max(12).default(1)
    }))
    .mutation(async ({ input }) => {
      const [req] = await db
        .select()
        .from(featureRequest)
        .where(eq(featureRequest.id, input.requestId))
        .limit(1);

      if (!req) throw new Error("Request not found");

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + input.months);

      await db.transaction(async (tx) => {
        await tx
          .update(user)
          .set({ isPro: true, proExpiresAt: expiresAt })
          .where(eq(user.id, req.userId));

        await tx
          .update(featureRequest)
          .set({ status: "APPROVED", updatedAt: new Date() })
          .where(eq(featureRequest.id, input.requestId));
      });

      return { success: true, expiresAt };
    }),

  revokeFeatureRequest: adminProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ input }) => {
      const [req] = await db
        .select()
        .from(featureRequest)
        .where(eq(featureRequest.id, input.requestId));

      if (!req) throw new Error("Request not found");

      await db.transaction(async (tx) => {
        await tx
          .update(user)
          .set({ isPro: false, proExpiresAt: null })
          .where(eq(user.id, req.userId));

        await tx
          .update(featureRequest)
          .set({ status: "REJECTED", updatedAt: new Date() })
          .where(eq(featureRequest.id, input.requestId));
      });

      return { success: true };
    }),

  // Direct subscription management (without feature request)
  grantPro: adminProcedure
    .input(z.object({
      userId: z.string(),
      months: z.number().min(1).max(12)
    }))
    .mutation(async ({ input }) => {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + input.months);

      await db
        .update(user)
        .set({ isPro: true, proExpiresAt: expiresAt })
        .where(eq(user.id, input.userId));

      return { success: true, expiresAt };
    }),

  extendPro: adminProcedure
    .input(z.object({
      userId: z.string(),
      additionalMonths: z.number().min(1).max(12)
    }))
    .mutation(async ({ input }) => {
      // Get current user
      const [targetUser] = await db
        .select()
        .from(user)
        .where(eq(user.id, input.userId));

      if (!targetUser) throw new Error("User not found");

      // Calculate new expiration: extend from current expiry or from now
      const baseDate = targetUser.proExpiresAt && targetUser.proExpiresAt > new Date()
        ? targetUser.proExpiresAt
        : new Date();

      const newExpiresAt = new Date(baseDate);
      newExpiresAt.setMonth(newExpiresAt.getMonth() + input.additionalMonths);

      await db
        .update(user)
        .set({ isPro: true, proExpiresAt: newExpiresAt })
        .where(eq(user.id, input.userId));

      return { success: true, expiresAt: newExpiresAt };
    }),

  revokePro: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .update(user)
        .set({ isPro: false, proExpiresAt: null })
        .where(eq(user.id, input.userId));

      return { success: true };
    }),
});