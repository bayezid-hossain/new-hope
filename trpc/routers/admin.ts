import { cycles, farmer, organization, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { count, desc, eq } from "drizzle-orm";
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