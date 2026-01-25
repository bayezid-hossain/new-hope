import { cycleHistory, cycles, farmer, member, organization, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init"; // Use your init file

export const organizationRouter = createTRPCRouter({
  // NEW: Get Stats for a specific organization
  getOrgStats: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [memberCount] = await ctx.db.select({ count: count() })
        .from(member)
        .where(eq(member.organizationId, input.orgId));

      const [farmerCount] = await ctx.db.select({ count: count() })
        .from(farmer)
        .where(eq(farmer.organizationId, input.orgId));

      const [activeCycles] = await ctx.db.select({ count: count() })
        .from(cycles)
        .where(and(eq(cycles.organizationId, input.orgId), eq(cycles.status, "active")));

      return {
        members: memberCount.count,
        farmers: farmerCount.count,
        activeCycles: activeCycles.count
      };
    }),

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

    if (!membership) return { status: "NO_ORG" as const, orgId: null, role: null };

    return {
      status: membership.status, // "PENDING" | "ACTIVE" | "REJECTED"
      orgName: membership.organization.name,
      orgId: membership.organizationId, // <--- ADD THIS
      role: membership.role // <--- Useful for permission checks later
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

  // Update Member Status (Active/Inactive)
  updateMemberStatus: protectedProcedure
    .input(z.object({
      memberId: z.string(),
      status: z.enum(["ACTIVE", "INACTIVE"])
    }))
    .mutation(async ({ ctx, input }) => {
      const actorId = ctx.user.id;

      // 1. Fetch target membership
      const targetMember = await ctx.db.query.member.findFirst({
        where: eq(member.id, input.memberId),
      });

      if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

      // 2. Fetch actor's membership
      const actorMember = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.userId, actorId),
          eq(member.organizationId, targetMember.organizationId),
          eq(member.status, "ACTIVE")
        )
      });

      // 3. Permission Check
      let isAuthorized = false;
      if (actorMember?.role === "OWNER" || actorMember?.role === "MANAGER") {
        isAuthorized = true;
      }
      else if (ctx.user.globalRole === "ADMIN") {
        isAuthorized = true;
      }

      if (!isAuthorized) {
        throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to change member status." });
      }

      // 4. Update Status
      await ctx.db.update(member)
        .set({ status: input.status })
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

  getOfficerAnalytics: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const officers = await ctx.db.query.member.findMany({
        where: and(
          eq(member.organizationId, input.orgId),
          eq(member.status, "ACTIVE")
        ),
        with: {
          user: true
        }
      });

      const analytics = await Promise.all(officers.map(async (m) => {
        const managedFarmers = await ctx.db.query.farmer.findMany({
          where: and(
            eq(farmer.officerId, m.userId),
            eq(farmer.organizationId, input.orgId)
          )
        });

        const farmerIds = managedFarmers.map(f => f.id);

        if (farmerIds.length === 0) {
          return {
            officerId: m.userId,
            name: m.user.name,
            email: m.user.email,
            role: m.role,
            farmersCount: 0,
            activeCycles: 0,
            pastCycles: 0,
            totalDoc: 0,
            totalIntake: 0,
            totalMortality: 0
          };
        }

        const activeBatch = await ctx.db.select({
          totalDoc: sql<number>`sum(${cycles.doc})`,
          totalIntake: sql<number>`sum(${cycles.intake})`,
          totalMortality: sql<number>`sum(${cycles.mortality})`,
          count: sql<number>`count(*)`
        })
          .from(cycles)
          .where(
            and(
              eq(cycles.organizationId, input.orgId),
              sql`${cycles.farmerId} IN ${farmerIds}`,
              eq(cycles.status, "active")
            )
          );

        const pastBatch = await ctx.db.select({
          totalDoc: sql<number>`sum(${cycleHistory.doc})`,
          totalIntake: sql<number>`sum(${cycleHistory.finalIntake})`,
          totalMortality: sql<number>`sum(${cycleHistory.mortality})`,
          count: sql<number>`count(*)`
        })
          .from(cycleHistory)
          .where(
            and(
              eq(cycleHistory.organizationId, input.orgId),
              sql`${cycleHistory.farmerId} IN ${farmerIds}`
            )
          );

        return {
          officerId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          farmersCount: managedFarmers.length,
          activeCycles: Number(activeBatch[0]?.count || 0),
          pastCycles: Number(pastBatch[0]?.count || 0),
          totalDoc: Number(activeBatch[0]?.totalDoc || 0) + Number(pastBatch[0]?.totalDoc || 0),
          totalIntake: Number(activeBatch[0]?.totalIntake || 0) + Number(pastBatch[0]?.totalIntake || 0),
          totalMortality: Number(activeBatch[0]?.totalMortality || 0) + Number(pastBatch[0]?.totalMortality || 0)
        };
      }));

      return analytics;
    }),
});
