import { cycleHistory, cycles, farmer, member, organization, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";

// 1. Define the Admin Procedure explicitly here
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // We know ctx.user exists because it inherits from protectedProcedure
  if (ctx.user.globalRole !== "ADMIN") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to access admin resources."
    });
  }
  return next();
});

export const adminRouter = createTRPCRouter({
  // ... existing stats/create procedures ...

  // 1. Delete Organization
  deleteOrganization: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Drizzle's cascade rules (defined in schema) will auto-delete members/farmers/cycles
      await ctx.db.delete(organization).where(eq(organization.id, input.id));
      return { success: true };
    }),

  // 2. Update Organization
  updateOrganization: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().min(2),
      slug: z.string().min(2)
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.update(organization)
        .set({ name: input.name, slug: input.slug })
        .where(eq(organization.id, input.id));
      return { success: true };
    }),
  // Dashboard Stats
  getStats: adminProcedure.query(async ({ ctx }) => {
    const [orgCount] = await ctx.db.select({ count: count() }).from(organization);
    const [userCount] = await ctx.db.select({ count: count() }).from(user);
    const [farmerCount] = await ctx.db.select({ count: count() }).from(farmer);
    const [activeCycles] = await ctx.db.select({ count: count() })
      .from(cycles)
      .where(eq(cycles.status, "active"));

    return {
      orgs: orgCount.count,
      users: userCount.count,
      farmers: farmerCount.count,
      activeCycles: activeCycles.count
    };
  }),

  // List All Organizations
  getAllOrgs: adminProcedure.query(async ({ ctx }) => {
    return await ctx.db.query.organization.findMany({
      orderBy: [desc(organization.createdAt)],
      with: {
        members: {
          limit: 5
        }
      }
    });
  }),

  // Get Farmers for a specific Org
  getOrgFarmers: adminProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.query.farmer.findMany({
        where: eq(farmer.organizationId, input.orgId),
        with: {
          cycles: {
            where: eq(cycles.status, 'active'),
          }
        },
        orderBy: [desc(farmer.createdAt)]
      });
      return data.map(f => ({
        ...f,
        activeCyclesCount: f.cycles.length
      }));
    }),

  // Get Active Cycles for a specific Org
  getOrgCycles: adminProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.select({
        cycle: cycles,
        farmerName: farmer.name,
      })
        .from(cycles)
        .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
        .where(
          and(
            eq(cycles.organizationId, input.orgId),
            eq(cycles.status, "active")
          )
        )
        .orderBy(desc(cycles.createdAt));

      return data.map(d => ({ ...d.cycle, farmerName: d.farmerName }));
    }),

  getOfficerAnalytics: adminProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      // 1. Get all members of the organization who are OFFICERS, MANAGERS, or OWNERS (as they can all manage farmers)
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
        // Fetch farmers managed by this officer in this org
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

  // Create Organization
  createOrganization: adminProcedure
    .input(z.object({
      name: z.string().min(2),
      slug: z.string().min(2)
    }))
    .mutation(async ({ ctx, input }) => {
      const [newOrg] = await ctx.db.insert(organization).values({
        name: input.name,
        slug: input.slug,
      }).returning();

      return newOrg;
    }),
});