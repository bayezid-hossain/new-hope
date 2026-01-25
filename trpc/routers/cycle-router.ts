import { cycleHistory, cycleLogs, cycles, farmer, member, stockLogs } from "@/db/schema";
import { updateCycleFeed } from "@/modules/cycles/server/services/feed-service";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { TRPCError } from "@trpc/server";
import { and, asc, count, desc, eq, ilike, sql } from "drizzle-orm";
import { z } from "zod";

// --- SCHEMAS ---

const cycleSearchSchema = z.object({
  search: z.string().optional(),
  page: z.number().default(1),
  pageSize: z.number().default(10),
  status: z.enum(["active", "archived"]).default("active"),
  orgId: z.string(),
  farmerId: z.string().optional(),
  sortBy: z.enum(["name", "age", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// REMOVED: inputFeed from creation schema
const cycleInsertSchema = z.object({
  name: z.string().min(1),
  farmerId: z.string(),
  orgId: z.string(),
  doc: z.number().int().positive(),
  age: z.number().int().default(0),
});

const addMortalitySchema = z.object({
  id: z.string(),
  amount: z.number().int().positive(),
  reason: z.string().optional(),
});

export const cyclesRouter = createTRPCRouter({

  // 1. Get Active Cycles (Filtered by Officer/Manager)
  getActiveCycles: protectedProcedure
    .input(cycleSearchSchema)
    .query(async ({ ctx, input }) => {
      const { search, page, pageSize, sortBy, sortOrder, orgId, farmerId } = input;
      const offset = (page - 1) * pageSize;

      // Membership check (Always applied, even for Global Admins in this "User View")
      let memberCheck = undefined;

      const membership = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.userId, ctx.user.id),
          eq(member.organizationId, orgId),
          eq(member.status, "ACTIVE")
        )
      });

      // If user uses this route, they MUST be a member of the org.
      // Even Global Admins need to be "in" the org to see "My Cycles" context.
      if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization" });

      if (membership.role === "OFFICER") {
        memberCheck = eq(farmer.officerId, ctx.user.id);
      }
      // Managers/Owners can see everything in the org

      const whereClause = and(
        eq(cycles.organizationId, orgId),
        eq(cycles.status, "active"),
        memberCheck,
        farmerId ? eq(cycles.farmerId, farmerId) : undefined,
        search ? ilike(cycles.name, `%${search}%`) : undefined,
      );

      let orderByClause = desc(cycles.createdAt);
      if (sortBy === "name") orderByClause = sortOrder === "asc" ? asc(cycles.name) : desc(cycles.name);
      if (sortBy === "age") orderByClause = sortOrder === "asc" ? asc(cycles.age) : desc(cycles.age);

      const data = await ctx.db.select({
        cycle: cycles,
        farmerName: farmer.name,
      })
        .from(cycles)
        .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset(offset);

      const [total] = await ctx.db.select({ count: count() })
        .from(cycles)
        .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
        .where(whereClause);

      return {
        items: data.map(d => ({ ...d.cycle, farmerName: d.farmerName })),
        total: total.count,
        totalPages: Math.ceil(total.count / pageSize)
      };
    }),

  // 2. Get Past Cycles (History)
  getPastCycles: protectedProcedure
    .input(cycleSearchSchema)
    .query(async ({ ctx, input }) => {
      const { search, page, pageSize, sortBy, sortOrder, orgId, farmerId } = input;
      const offset = (page - 1) * pageSize;

      // Membership check
      let memberCheck = undefined;

      const membership = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.userId, ctx.user.id),
          eq(member.organizationId, orgId),
          eq(member.status, "ACTIVE")
        )
      });

      if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "Not a member of this organization" });

      if (membership.role === "OFFICER") {
        memberCheck = eq(farmer.officerId, ctx.user.id);
      }

      const whereClause = and(
        eq(cycleHistory.organizationId, orgId),
        memberCheck,
        farmerId ? eq(cycleHistory.farmerId, farmerId) : undefined,
        search ? ilike(cycleHistory.cycleName, `%${search}%`) : undefined
      );

      let orderByClause = desc(cycleHistory.endDate);
      if (sortBy === "name") orderByClause = sortOrder === "asc" ? asc(cycleHistory.cycleName) : desc(cycleHistory.cycleName);
      if (sortBy === "age") orderByClause = sortOrder === "asc" ? asc(cycleHistory.age) : desc(cycleHistory.age);
      if (sortBy === "createdAt") orderByClause = sortOrder === "asc" ? asc(cycleHistory.startDate) : desc(cycleHistory.startDate);

      const data = await ctx.db.select({
        history: cycleHistory,
        farmerName: farmer.name
      })
        .from(cycleHistory)
        .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
        .where(whereClause)
        .orderBy(orderByClause)
        .limit(pageSize)
        .offset(offset);

      const [total] = await ctx.db.select({ count: count() })
        .from(cycleHistory)
        .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
        .where(whereClause);
      return {
        items: data.map(d => ({
          ...d.history,
          name: d.history.cycleName,
          farmerName: d.farmerName,
          organizationId: d.history.organizationId || "",
          createdAt: d.history.startDate,
          updatedAt: d.history.endDate,
          intake: d.history.finalIntake,
          status: 'archived'
        })),
        total: total.count,
        totalPages: Math.ceil(total.count / pageSize)
      };
    }),


  // 2. Sync Feed (Calculates Intake)
  // This updates 'intake' on the cycle, which effectively "consumes" from the main stock view
  syncFeed: protectedProcedure.mutation(async ({ ctx }) => {
    const activeCycles = await ctx.db.query.cycles.findMany({
      where: eq(cycles.status, "active")
    });

    const results = await Promise.all(
      activeCycles.map(cycle => updateCycleFeed(cycle, ctx.user.id))
    );

    const validUpdates = results.filter(r => r !== null);

    return {
      success: true,
      updatedCount: validUpdates.length,
    };
  }),

  // 3. Create Cycle (Simplified)
  create: protectedProcedure
    .input(cycleInsertSchema)
    .mutation(async ({ input, ctx }) => {

      // A. Check for Duplicates


      // B. Insert Cycle (No inputFeed logic needed)
      const [newCycle] = await ctx.db.insert(cycles).values({
        name: input.name,
        farmerId: input.farmerId,
        organizationId: input.orgId,
        doc: input.doc,
        age: input.age,
        // Calculate start date based on age
        createdAt: input.age > 1
          ? new Date(new Date().setDate(new Date().getDate() - (input.age - 1)))
          : new Date()
      }).returning();

      // C. Log Cycle Start
      await ctx.db.insert(cycleLogs).values({
        cycleId: newCycle.id,
        userId: ctx.user.id,
        type: "NOTE",
        valueChange: 0,
        note: `Cycle started. Initial Age: ${input.age}, Birds: ${input.doc}`
      });

      // D. Trigger first feed sync (calculates initial intake if age > 0)
      await updateCycleFeed(newCycle, ctx.user.id, true);

      return newCycle;
    }),

  // 4. End Cycle (Archive)
  end: protectedProcedure
    .input(z.object({
      id: z.string(),
      intake: z.number().positive(),
      // REMOVED: remainingStock input. 
      // In a shared pool, you don't "return" stock, you just stop eating.
    }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.db.transaction(async (tx) => {
        // A. Get Active Cycle
        const [activeCycle] = await tx.select().from(cycles).where(eq(cycles.id, input.id));
        if (!activeCycle) throw new TRPCError({ code: "NOT_FOUND" });

        // B. Create History Record
        // We set 'input' and 'remaining' to 0 because these concepts apply to the Farmer now, not the Cycle.
        // The crucial stat is 'finalIntake' (Total Consumed).
        const [history] = await tx.insert(cycleHistory).values({
          cycleName: activeCycle.name,
          farmerId: activeCycle.farmerId,
          organizationId: activeCycle.organizationId,
          doc: activeCycle.doc,
          finalIntake: input.intake || 0,

          mortality: activeCycle.mortality,
          age: activeCycle.age,
          startDate: activeCycle.createdAt,
          endDate: new Date(),
          status: "archived"
        }).returning();

        // C. Re-link Logs
        await tx.update(cycleLogs)
          .set({ historyId: history.id, cycleId: null })
          .where(eq(cycleLogs.cycleId, activeCycle.id));

        // D. Add Closing Log and Stock Ledger Entry
        await tx.insert(cycleLogs).values({
          historyId: history.id,
          userId: ctx.user.id,
          type: "NOTE",
          valueChange: 0,
          note: `Cycle Ended. Total Consumption: ${(activeCycle.intake || 0).toFixed(2)} bags.`
        });

        await tx.update(farmer).set({ updatedAt: new Date(), mainStock: sql`${farmer.mainStock} - ${input.intake || 0}`, totalConsumed: sql`${farmer.totalConsumed} + ${input.intake || 0}` }).where(eq(farmer.id, activeCycle.farmerId));

        // Create Stock Log for Ledger Completeness
        if (input.intake > 0) {
          await tx.insert(stockLogs).values({
            farmerId: activeCycle.farmerId,
            amount: (-input.intake).toString(), // Negative for deduction
            type: "CYCLE_CLOSE",
            referenceId: history.id,
            note: `Cycle "${activeCycle.name}" Ended. (Started: ${activeCycle.createdAt.toISOString().split('T')[0]}). Consumed: ${input.intake} bags.`
          });
        }

        await tx.delete(cycles).where(eq(cycles.id, input.id));

        return { success: true };
      });
    }),

  // REMOVED: addFeed (Use mainStock.addStock instead)

  // 5. Add Mortality
  addMortality: protectedProcedure
    .input(addMortalitySchema)
    .mutation(async ({ input, ctx }) => {
      const [current] = await ctx.db.select().from(cycles).where(eq(cycles.id, input.id));
      if (!current) throw new TRPCError({ code: "NOT_FOUND" });

      const [updated] = await ctx.db.update(cycles)
        .set({
          mortality: sql`${cycles.mortality} + ${input.amount}`,
          updatedAt: new Date(),
        })
        .where(eq(cycles.id, input.id))
        .returning();

      await ctx.db.insert(cycleLogs).values({
        cycleId: input.id,
        userId: ctx.user.id,
        type: "MORTALITY",
        valueChange: input.amount,
        previousValue: current.mortality,
        newValue: current.mortality + input.amount,
        note: input.reason || "Reported Death"
      });

      return updated;
    }),

  // 6. Get Details
  getDetails: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {

      // Try finding ACTIVE Cycle
      const activeCycle = await ctx.db.query.cycles.findFirst({
        where: eq(cycles.id, input.id),
        with: {
          farmer: true, // Fetch Farmer to see Main Stock context
        }
      });

      if (activeCycle) {
        const logs = await ctx.db.select().from(cycleLogs)
          .where(eq(cycleLogs.cycleId, activeCycle.id))
          .orderBy(desc(cycleLogs.createdAt));

        const history = await ctx.db.select().from(cycleHistory)
          .where(eq(cycleHistory.farmerId, activeCycle.farmerId))
          .orderBy(desc(cycleHistory.endDate));

        const otherActiveCycles = await ctx.db.select().from(cycles)
          .where(and(eq(cycles.farmerId, activeCycle.farmerId), sql`${cycles.id} != ${activeCycle.id}`))
          .orderBy(desc(cycles.createdAt));

        return {
          type: 'active',
          data: activeCycle,
          logs,
          history: [
            ...otherActiveCycles.map(c => ({
              ...c,
              cycleName: c.name,
              startDate: c.createdAt,
              endDate: null,
              finalIntake: c.intake,
              status: 'active'
            })),
            ...history.map(h => ({ ...h, status: 'archived' }))
          ],
          farmerContext: {
            mainStock: activeCycle.farmer.mainStock,
            name: activeCycle.farmer.name
          }
        };
      }

      // Try finding HISTORY
      const historyRecord = await ctx.db.query.cycleHistory.findFirst({
        where: eq(cycleHistory.id, input.id),
        with: { farmer: true }
      });

      if (!historyRecord) throw new TRPCError({ code: "NOT_FOUND" });

      const logs = await ctx.db.select().from(cycleLogs)
        .where(eq(cycleLogs.historyId, historyRecord.id))
        .orderBy(desc(cycleLogs.createdAt));

      // NEW: Fetch Active Cycles for this farmer to show in "Other Cycles"
      const activeCycles = await ctx.db.select().from(cycles)
        .where(eq(cycles.farmerId, historyRecord.farmerId))
        .orderBy(desc(cycles.createdAt));

      // Fetch other history records
      const otherHistory = await ctx.db.select().from(cycleHistory)
        .where(and(eq(cycleHistory.farmerId, historyRecord.farmerId), sql`${cycleHistory.id} != ${historyRecord.id}`))
        .orderBy(desc(cycleHistory.endDate));

      return {
        type: 'history',
        data: historyRecord,
        logs,
        history: [
          ...activeCycles.map(c => ({
            ...c,
            cycleName: c.name,
            startDate: c.createdAt,
            endDate: null,
            finalIntake: c.intake,
            status: 'active'
          })),
          ...otherHistory.map(h => ({ ...h, status: 'archived' }))
        ],
        farmerContext: {
          mainStock: historyRecord.farmer.mainStock,
          name: historyRecord.farmer.name
        }
      };
    }),

  // 7. Delete History
  deleteHistory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Cascade delete should handle logs if foreign keys are set up correctly
      await ctx.db.delete(cycleHistory).where(eq(cycleHistory.id, input.id));
      return { success: true };
    }),
});