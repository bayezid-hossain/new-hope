
import { cycles, farmer } from "@/db/schema"; // Ensure 'cycles' is imported if relation exists
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

      // 1. Build the WHERE clause
      const whereClause = and(
        // Filter by Organization (safety check: default to empty string if undefined)
        eq(farmer.organizationId, orgId ?? ""),

        // Search Logic: Matches Name OR Phone Number
        search
          ? or(
            ilike(farmer.name, `%${search}%`),

          )
          : undefined
      );

      // 2. Fetch Data
      const data = await ctx.db.query.farmer.findMany({
        where: whereClause,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        orderBy: (table, { asc, desc }) => {
          // Dynamic sorting
          if (sortBy && sortOrder) {
            const column = table[sortBy as keyof typeof table];
            if (column) {
              return sortOrder === "desc" ? desc(column) : asc(column);
            }
          }
          // Default sort: Newest first
          return desc(table.createdAt);
        },
        // Include relations (Optional: helpful for UI counters)
        with: {
          cycles: {
            where: eq(cycles.status, 'active'), // Only fetch active cycles
            columns: { id: true }
          }
        }
      });

      // 3. Get Total Count (for pagination)
      const [totalResult] = await ctx.db
        .select({ count: sql<number>`count(*)` })
        .from(farmer)
        .where(whereClause);

      const total = Number(totalResult?.count || 0);

      return {
        items: data.map((f) => ({
          ...f,
          // Add computed active cycle count for the UI
          activeCyclesCount: f.cycles.length
        })),
        total,
        totalPages: Math.ceil(total / pageSize),
        currentPage: page,
      };
    }),
  getFarmer: protectedProcedure
    .input(
      z.object({
        farmerId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { farmerId } = input;
      const data = await ctx.db.query.farmer.findFirst({
        where: and(eq(farmer.id, farmerId), eq(farmer.officerId, ctx.session.userId)),
      });
      return data;
    }),
});