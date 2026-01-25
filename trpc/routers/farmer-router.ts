
import { cycles, farmer, member } from "@/db/schema"; // Ensure 'cycles' is imported if relation exists
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../init";

export const farmersRouter = createTRPCRouter({

  // --- 1. GET MANY (List, Search, Pagination, Autocomplete) ---
  getMany: protectedProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
        search: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(10),
        status: z.enum(["active", "inactive", "archived", "all"]).optional(),
        sortBy: z.string().optional(),
        sortOrder: z.enum(["asc", "desc"]).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { orgId, search, page, pageSize, sortBy, sortOrder } = input;

      // 1. Membership Check (Strict - No Global Admin Bypass)
      let officerFilter = undefined;

      const membership = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.userId, ctx.user.id),
          eq(member.organizationId, orgId ?? ""),
          eq(member.status, "ACTIVE")
        )
      });

      if (!membership) {
        // If not a member, return empty or throw. For getMany, returning empty is often safer/UX friendly than throwing.
        return { items: [], total: 0, totalPages: 0, currentPage: page };
      }

      // 2. Role-Based Logic
      // If Officer => Filter by officerId
      // If Manager/Owner => No filter (See all)
      if (membership.role === "OFFICER") {
        officerFilter = eq(farmer.officerId, ctx.user.id);
      }

      // 3. Build the WHERE clause
      // 3. Build the WHERE clause
      const whereClause = and(
        eq(farmer.organizationId, orgId ?? ""),
        eq(farmer.officerId, ctx.user.id), // STRICT: Only show farmers managed by this user
        search ? or(ilike(farmer.name, `%${search}%`)) : undefined
      );

      // 4. Fetch Data
      const data = await ctx.db.query.farmer.findMany({
        where: whereClause,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: (table, { asc, desc }) => {
          if (sortBy && sortOrder) {
            const column = table[sortBy as keyof typeof table];
            if (column) return sortOrder === "desc" ? desc(column) : asc(column);
          }
          return desc(table.createdAt);
        },
        with: {
          cycles: {
            where: eq(cycles.status, 'active'),
            columns: { id: true }
          }
        }
      });

      // 5. Get Total Count
      const [totalResult] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(farmer)
        .where(whereClause);

      const total = Number(totalResult?.count || 0);

      return {
        items: data.map((f) => ({
          ...f,
          activeCyclesCount: f.cycles.length
        })),
        total,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      };
    }),
  getFarmer: protectedProcedure
    .input(z.object({ farmerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const { farmerId } = input;

      const targetFarmer = await ctx.db.query.farmer.findFirst({
        where: eq(farmer.id, farmerId),
      });

      if (!targetFarmer) return null;

      // 1. Direct Officer check (Fast path)
      if (targetFarmer.officerId === ctx.user.id) return targetFarmer;

      // 2. Manager/Owner check (Must be ACTIVE member in SAME organization)
      const membership = await ctx.db.query.member.findFirst({
        where: and(
          eq(member.userId, ctx.user.id),
          eq(member.organizationId, targetFarmer.organizationId),
          eq(member.status, "ACTIVE"),
          or(eq(member.role, "MANAGER"), eq(member.role, "OWNER"))
        )
      });

      if (membership) return targetFarmer;

      return null;
    }),
});