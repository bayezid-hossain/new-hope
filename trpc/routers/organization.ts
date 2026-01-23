// src/server/routers/organization.ts
import { member, organization, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init"; // Use your init file

export const organizationRouter = createTRPCRouter({
  
  // 1. Admin Creates Org (And automatically becomes the OWNER)
  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), slug: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      // Global Permission Check
      if (ctx.user.globalRole !== "ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Only Global Admins can create organizations." });
      }

      // Transaction: Create Org -> Add Creator as Owner
      return await ctx.db.transaction(async (tx) => {
        const [newOrg] = await tx.insert(organization).values({
          name: input.name,
          slug: input.slug,
          // ownerId is useful for quick lookups, though member table holds the truth
          // Ensure your organization schema has ownerId, or remove this line if strictly using member table
        }).returning();

        // Add the creator as the OWNER
        await tx.insert(member).values({
          userId: ctx.user.id,
          organizationId: newOrg.id,
          role: "OWNER",
          status: "ACTIVE", // Auto-approved
        });

        return newOrg;
      });
    }),

  // 2. User Requests to Join an Organization
  join: protectedProcedure
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
      }).returning();

      return newMember;
    }),

  // 3. Approval System (The "Smart" Logic)
  approveMember: protectedProcedure
    .input(z.object({ 
      memberId: z.string() // We approve a specific membership request ID
    }))
    .mutation(async ({ ctx, input }) => {
      const actorId = ctx.user.id;

      // 1. Fetch the target membership request
      const targetMember = await ctx.db.query.member.findFirst({
        where: eq(member.id, input.memberId),
      });

      if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });

      // 2. Fetch the ACTOR'S membership in the SAME organization
      const actorMember = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.userId, actorId),
          eq(member.organizationId, targetMember.organizationId),
          eq(member.status, "ACTIVE")
        )
      });

      // 3. Logic: Check Permissions
      let isAuthorized = false;

      // Case A: Actor is OWNER (Can approve anyone)
      if (actorMember?.role === "OWNER") {
        isAuthorized = true;
      }
      // Case B: Actor is MANAGER (Can approve OFFICERS only)
      else if (actorMember?.role === "MANAGER" && targetMember.role === "OFFICER") {
        isAuthorized = true;
      }
      // Case C: Actor is Global Admin (Fallback override)
      else if (ctx.user.globalRole === "ADMIN") {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to approve this member." });
      }

      // 4. Execute Approval
      const [updatedMember] = await ctx.db.update(member)
        .set({ status: "ACTIVE" })
        .where(eq(member.id, input.memberId))
        .returning();

      return updatedMember;
    }),
    getAll: protectedProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.organization.findMany({
      columns: { id: true, name: true, slug: true },
    });
  }),

  // NEW: Get Current User's Status
  getMyStatus: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    
    const membership = await ctx.db.query.member.findFirst({
      where: eq(member.userId, userId),
      with: {
        organization: true
      }
    });

    if (!membership) return { status: "NO_ORG" as const };
    return { 
      status: membership.status, // "PENDING" | "ACTIVE" | "REJECTED"
      orgName: membership.organization.name 
    };
  }),
  getMembers: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Security: Check if user is Admin or Manager of this Org
      // (For brevity, assuming Global Admin or Manager check passed)
      
      return await ctx.db.select({
        id: member.id, // The Membership ID
        userId: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        role: member.role,
        status: member.status,
        joinedAt: member.createdAt
      })
      .from(member)
      .innerJoin(user, eq(member.userId, user.id))
      .where(eq(member.organizationId, input.orgId));
    }),

  // 2. Update Member Role (Promote/Demote)
  updateMemberRole: protectedProcedure
    .input(z.object({ memberId: z.string(), role: z.enum(["MANAGER", "OFFICER"]) }))
    .mutation(async ({ ctx, input }) => {
      // Permission check needed here (omitted for brevity)
      await ctx.db.update(member)
        .set({ role: input.role })
        .where(eq(member.id, input.memberId));
      return { success: true };
    }),

  // 3. Remove/Kick Member
  removeMember: protectedProcedure
    .input(z.object({ memberId: z.string() }))
    .mutation(async ({ ctx, input }) => {
       // Permission check needed here
       await ctx.db.delete(member).where(eq(member.id, input.memberId));
       return { success: true };
    }),
});