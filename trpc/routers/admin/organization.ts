import { cycles, farmer, member, organization } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";

const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
    if (ctx.user.globalRole !== "ADMIN") {
        throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have permission to access admin resources."
        });
    }
    return next();
});

export const adminOrganizationRouter = createTRPCRouter({
    // 0. Get Org Stats
    getStats: adminProcedure
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

    // Get Organization by ID
    get: adminProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const org = await ctx.db.query.organization.findFirst({
                where: eq(organization.id, input.id),
            });
            return org;
        }),

    // 1. Delete Organization
    delete: adminProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            // Drizzle's cascade rules (defined in schema) will auto-delete members/farmers/cycles
            await ctx.db.delete(organization).where(eq(organization.id, input.id));
            return { success: true };
        }),

    // 2. Update Organization
    update: adminProcedure
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

    // List All Organizations
    getAll: adminProcedure.query(async ({ ctx }) => {
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
    create: adminProcedure
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
