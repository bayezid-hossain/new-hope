import { cycles, farmer, stockLogs } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";

export const mainStockRouter = createTRPCRouter({

  // 1. DASHBOARD: "Warehouse View"
  getDashboard: protectedProcedure
    .input(z.object({
      orgId: z.string(),
      search: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(10),
    }))
    .query(async ({ ctx, input }) => {
      const { orgId, search, page, pageSize } = input;

      const farmersData = await ctx.db.query.farmer.findMany({
        where: and(
          eq(farmer.organizationId, orgId),
          search ? ilike(farmer.name, `%${search}%`) : undefined
        ),
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: [desc(farmer.createdAt)],
        with: {
          cycles: {
            where: eq(cycles.status, "active"),
            orderBy: [desc(cycles.createdAt)]
          }
        }
      });

      const [total] = await ctx.db.select({ count: sql<number>`count(*)` })
        .from(farmer)
        .where(eq(farmer.organizationId, orgId));

      return {
        items: farmersData.map(f => {
          // --- CALCULATION FIX ---

          // 1. Active Consumption: Feed eaten by cycles that are currently OPEN
          // (These have NOT been deducted from DB mainStock yet)
          const activeConsumption = f.cycles.reduce((sum, c) => sum + (Number(c.intake) || 0), 0);

          // 2. Real Available Stock: Book Balance - Active Consumption
          const remainingStock = f.mainStock - activeConsumption;


          return {
            ...f,
            activeCycles: f.cycles,
            activeCyclesCount: f.cycles.length,

            mainStock: f.mainStock, // Book Balance
            totalConsumed: f.totalConsumed,
            activeConsumption: activeConsumption, // Lifetime usage (for reporting)
            remainingStock: remainingStock, // REAL available stock (for decisions)

            isLowStock:
              remainingStock < 5
          };
        }),
        total: Number(total.count),
        totalPages: Math.ceil(Number(total.count) / pageSize)
      };
    }),

  // 2. GET HISTORY (Ledger)
  getHistory: protectedProcedure
    .input(z.object({ farmerId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Ensure 'stockLogs' is exported from your schema file!
      return await ctx.db.select()
        .from(stockLogs)
        .where(eq(stockLogs.farmerId, input.farmerId))
        .orderBy(desc(stockLogs.createdAt));
    }),

  // 3. ADD STOCK (Ledger Entry Added)
  addStock: protectedProcedure
    .input(z.object({
      farmerId: z.string(),
      amount: z.number().positive(),
      note: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        // A. Update Farmer DB
        await tx.update(farmer)
          .set({
            mainStock: sql`${farmer.mainStock} + ${input.amount}`,
            updatedAt: new Date()
          })
          .where(eq(farmer.id, input.farmerId));

        // B. Add Ledger Entry
        await tx.insert(stockLogs).values({
          farmerId: input.farmerId,
          amount: input.amount.toString(), // Stored as string or decimal
          type: "RESTOCK",
          note: input.note || "Manual Restock",
        });
      });
    }),

  // 4. CREATE FARMER
  createFarmer: protectedProcedure
    .input(z.object({
      name: z.string().min(2),
      orgId: z.string(),
      initialStock: z.number().min(0)
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        const [newFarmer] = await tx.insert(farmer).values({
          name: input.name,
          organizationId: input.orgId,
          officerId: ctx.user.id,
          mainStock: input.initialStock,
        }).returning();

        // Optional: Log initial stock
        if (input.initialStock > 0) {
          await tx.insert(stockLogs).values({
            farmerId: newFarmer.id,
            amount: input.initialStock.toString(),
            type: "INITIAL",
            note: "Initial Stock Assignment"
          });
        }
        return newFarmer;
      });
    }),

  // 5. DEDUCT STOCK (Manual Correction)
  deductStock: protectedProcedure
    .input(z.object({
      farmerId: z.string(),
      amount: z.number().positive(),
      note: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.transaction(async (tx) => {
        // A. Update Farmer DB (Subtract)
        await tx.update(farmer)
          .set({
            mainStock: sql`${farmer.mainStock} - ${input.amount}`,
            updatedAt: new Date()
          })
          .where(eq(farmer.id, input.farmerId));

        // B. Add Ledger Entry (Negative Amount)
        await tx.insert(stockLogs).values({
          farmerId: input.farmerId,
          amount: (-input.amount).toString(), // Negative for deduction
          type: "CORRECTION",
          note: input.note || "Manual Deduction",
        });
      });
    }),
});