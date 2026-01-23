import { cycles, farmer } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";

export const officerRouter = createTRPCRouter({
  
  // 1. Create a Unique Farmer (Scoped to Officer)
  createFarmer: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      phone: z.string().min(1),
      location: z.string().optional(),
      orgId: z.string() 
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id; // Fixed: Context is ctx.auth.user

      // Optional: Add logic here to verify user belongs to input.orgId
      
      const [newFarmer] = await ctx.db.insert(farmer).values({
        name: input.name,
        organizationId: input.orgId,
        officerId: userId, // Automatically assigned
      }).returning(); // Fixed: Added .returning()

      return newFarmer;
    }),

  // 2. Get ONLY My Farmers
  getMyFarmers: protectedProcedure
    .input(z.object({ orgId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      return await ctx.db.query.farmer.findMany({
        where: and(
          eq(farmer.organizationId, input.orgId),
          eq(farmer.officerId, userId) 
        ),
        with: {
          cycles: true
        }
      });
    }),

  // 3. Create Cycle (Must assign to one of MY farmers)
  createCycle: protectedProcedure
    .input(z.object({
      farmerId: z.string(),
      orgId: z.string(),
      name: z.string().min(1),
      doc: z.number().int().positive(),
      inputFeed: z.number().positive(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;

      // Validation: Ensure the farmer belongs to this officer
      const ownerCheck = await ctx.db.query.farmer.findFirst({
        where: and(
          eq(farmer.id, input.farmerId),
          eq(farmer.officerId, userId)
        )
      });

      if (!ownerCheck) {
        throw new TRPCError({ 
          code: "FORBIDDEN", 
          message: "You cannot assign a cycle to a farmer you do not manage." 
        });
      }

      // Create Cycle
      const [newCycle] = await ctx.db.insert(cycles).values({
        name: input.name,
        farmerId: input.farmerId,
        organizationId: input.orgId,
        doc: input.doc,
        inputFeed: input.inputFeed,
        status: 'active'
      }).returning(); // Fixed: Added .returning()

      return newCycle;
    })
});