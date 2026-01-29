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
          },
        })
        .from(featureRequest)
        .leftJoin(user, eq(featureRequest.userId, user.id))
        .orderBy(desc(featureRequest.createdAt));

      return requests;
    }),

  approveFeatureRequest: adminProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ input }) => {
      // 1. Get the request
      const [req] = await db
        .select()
        .from(featureRequest)
        .where(eq(featureRequest.id, input.requestId))
        .limit(1);

      if (!req) throw new Error("Request not found");

      // 2. Update User and Request
      await db.transaction(async (tx) => {
        await tx
          .update(user)
          .set({ isPro: true })
          .where(eq(user.id, req.userId));

        await tx
          .update(featureRequest)
          .set({ status: "APPROVED" })
          .where(eq(featureRequest.id, input.requestId));
      });

      return { success: true };
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
        // Revoke pro access
        await tx
          .update(user)
          .set({ isPro: false })
          .where(eq(user.id, req.userId));

        // Mark request as rejected
        await tx
          .update(featureRequest)
          .set({ status: "REJECTED" })
          .where(eq(featureRequest.id, input.requestId));
      });

      return { success: true };
    }),
});