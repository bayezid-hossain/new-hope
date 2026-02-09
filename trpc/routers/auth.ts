
// src/server/routers/auth.ts
import { member } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../init";

export const authRouter = createTRPCRouter({
  getSession: publicProcedure.query(({ ctx }) => {
    // We simply return the context data we already fetched in init.ts
    return {
      session: ctx.session,
      user: {
        ...ctx.user,
        activeMode: ctx?.user?.activeMode
      }
    };
  }),

  // 1. User Requests to Join an Organization
  joinOrganization: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      role: z.enum(["MANAGER", "OFFICER"]) // User requests a specific role
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Check if already a member (pending or active)
      const existingMember = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.userId, userId),
          eq(member.organizationId, input.orgId)
        )
      });

      if (existingMember) {
        throw new TRPCError({ code: "CONFLICT", message: "You have already joined or requested to join this organization." });
      }

      // Create PENDING membership
      const [newMember] = await ctx.db.insert(member).values({
        userId: userId,
        organizationId: input.orgId,
        role: input.role,
        status: "PENDING",
        accessLevel: input.role === "OFFICER" ? "EDIT" : "VIEW",
      }).returning();

      return newMember;
    }),

  // 2. Get Current User's Status
  getMyMembership: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;

    const membership = await ctx.db.query.member.findFirst({
      where: eq(member.userId, userId),
      with: {
        organization: true
      }
    });

    if (!membership) return {
      status: "NO_ORG" as const,
      orgId: null,
      role: null,
      isPro: ctx.user.isPro,
      proExpiresAt: ctx.user.proExpiresAt,
      activeMode: undefined,
      accessLevel: undefined
    };

    return {
      status: membership.status, // "PENDING" | "ACTIVE" | "REJECTED"
      orgName: membership.organization.name,
      orgId: membership.organizationId,
      role: membership.role,
      activeMode: membership.activeMode,
      accessLevel: membership.accessLevel,
      isPro: ctx.user.isPro,
      proExpiresAt: ctx.user.proExpiresAt
    };
  }),

  // 3. List all organizations (for joining)
  listOrganizations: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.organization.findMany({
      columns: { id: true, name: true, slug: true },
    });
  }),

  // Update Global Mode (for System Admin)
  updateGlobalMode: protectedProcedure
    .input(z.object({ mode: z.enum(["ADMIN", "USER"]) }))
    .mutation(async ({ ctx, input }) => {
      const { user: userTable } = await import("@/db/schema");
      await ctx.db.update(userTable)
        .set({ activeMode: input.mode })
        .where(eq(userTable.id, ctx.user.id));
      return { success: true };
    }),

  // Update Org Mode (for Manager/Owner)
  updateOrgMode: protectedProcedure
    .input(z.object({ mode: z.enum(["MANAGEMENT", "OFFICER"]) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(member)
        .set({ activeMode: input.mode })
        .where(eq(member.userId, ctx.user.id)); // Assumes one org for now as per getMyMembership
      return { success: true };
    }),
});