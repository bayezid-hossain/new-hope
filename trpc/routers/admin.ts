import { cycleHistory, cycles, farmer, organization, stockLogs, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";
import { fetchOfficerAnalytics } from "./utils";

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
          },
          history: true
        },
        orderBy: [desc(farmer.createdAt)]
      });
      return data.map(f => ({
        ...f,
        activeCyclesCount: f.cycles.length,
        pastCyclesCount: f.history.length
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
      return await fetchOfficerAnalytics(ctx.db, input.orgId);
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

  // Get Farmer Details for Admin Dashboard (No restriction)
  getFarmerDetails: adminProcedure
    .input(z.object({ farmerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.query.farmer.findFirst({
        where: eq(farmer.id, input.farmerId),
        with: {
          cycles: {
            where: eq(cycles.status, 'active')
          },
          history: true,
          officer: true
        }
      });
      return data;
    }),

  // active cycles for specific farmer (admin view)
  getFarmerCycles: adminProcedure
    .input(z.object({ farmerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.select({
        cycle: cycles,
        farmerName: farmer.name,
      })
        .from(cycles)
        .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
        .where(
          and(
            eq(cycles.farmerId, input.farmerId),
            eq(cycles.status, "active")
          )
        )
        .orderBy(desc(cycles.createdAt));

      return { items: data.map(d => ({ ...d.cycle, farmerName: d.farmerName })) };
    }),

  // history for specific farmer (admin view)
  getFarmerHistory: adminProcedure
    .input(z.object({ farmerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.select({
        history: cycleHistory,
        farmerName: farmer.name
      })
        .from(cycleHistory)
        .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
        .where(eq(cycleHistory.farmerId, input.farmerId))
        .orderBy(desc(cycleHistory.endDate));

      return {
        items: data.map(d => ({
          ...d.history,
          name: d.history.cycleName,
          farmerName: d.farmerName,
          organizationId: d.history.organizationId || "",
          createdAt: d.history.startDate, // legacy mapping if needed
          updatedAt: d.history.endDate,
          intake: d.history.finalIntake,
          status: 'archived'
        }))
      };
    }),

  getFarmerStockLogs: adminProcedure
    .input(z.object({ farmerId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Ensure 'stockLogs' is exported from your schema file!
      return await ctx.db.select()
        .from(stockLogs) // Ensure this is imported in this file
        .where(eq(stockLogs.farmerId, input.farmerId))
        .orderBy(desc(stockLogs.createdAt));
    }),
});