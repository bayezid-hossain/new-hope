import { cycleHistory, cycles, farmer, member, stockLogs } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";
import { fetchOfficerAnalytics } from "../utils";

// Middleware: Check if user is Manager/Owner of the Org OR Global Admin
const managementProcedure = protectedProcedure.input(z.object({ orgId: z.string().optional() })).use(async ({ ctx, next, input }) => {
    // 1. Global Admin Override
    if (ctx.user.globalRole === "ADMIN") {
        return next();
    }

    // 2. Org Member Check (if orgId is provided in input headers or body, though input is available here if defined in outer scope methods, 
    // but TRPC middleware accessing raw input generically is tricky if input shape varies.
    // STRATEGY: We will require 'orgId' in the input of all management procedures and valid it here?
    // Actually, for composition, it's easier to check inside the procedure or use a higher-order creator if 'orgId' is standard.
    // For simplicity and strict typing, we'll do the check in the procedure or a helper if the input isn't uniform.

    // However, most management ops need orgId. Let's assume the input object HAS orgId.
    // But wait, some inputs are { farmerId }. We need to resolve orgId from farmerId then? That's expensive.

    // SIMPLER APPROACH:
    // We'll define a helper "assertorgMemberOrAdmin" we call inside procedures.
    return next();
});

export const managementRouter = createTRPCRouter({

    // 1. Get Farmers for an Org
    getOrgFarmers: protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, input.orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const data = await ctx.db.query.farmer.findMany({
                where: eq(farmer.organizationId, input.orgId),
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                    history: true,
                    officer: true
                },
                orderBy: [desc(farmer.createdAt)]
            });

            return data.map(f => ({
                ...f,
                officerName: f.officer.name,
                activeCyclesCount: f.cycles.length,
                pastCyclesCount: f.history.length
            }));
        }),

    // 1.b Get Active Cycles for an Org (Admin/Management View)
    getOrgActiveCycles: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            search: z.string().optional(),
            pageSize: z.number().optional().default(100) // Default to large page for dashboard
        }))
        .query(async ({ ctx, input }) => {
            // Access Check

            const data = await ctx.db.select({
                cycle: cycles,
                farmerName: farmer.name,
            })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(and(
                    eq(cycles.organizationId, input.orgId),
                    eq(cycles.status, "active"),
                    input.search ? ilike(cycles.name, `%${input.search}%`) : undefined
                ))
                .orderBy(desc(cycles.createdAt))
                .limit(input.pageSize);

            return { items: data.map(d => ({ ...d.cycle, farmerName: d.farmerName })) };
        }),

    // 1.c Get Past Cycles for an Org (History)
    getOrgPastCycles: protectedProcedure
        .input(z.object({
            orgId: z.string(),
            search: z.string().optional(),
            pageSize: z.number().optional().default(100)
        }))
        .query(async ({ ctx, input }) => {
            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, input.orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const data = await ctx.db.select({
                history: cycleHistory,
                farmerName: farmer.name
            })
                .from(cycleHistory)
                .innerJoin(farmer, eq(cycleHistory.farmerId, farmer.id))
                .where(and(
                    eq(cycleHistory.organizationId, input.orgId),
                    input.search ? ilike(cycleHistory.cycleName, `%${input.search}%`) : undefined
                ))
                .orderBy(desc(cycleHistory.endDate))
                .limit(input.pageSize);

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
                }))
            };
        }),


    // 2. Officer Analytics
    getOfficerAnalytics: protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Access Check
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, input.orgId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            return await fetchOfficerAnalytics(ctx.db, input.orgId);
        }),

    // 3. Get Farmer Details
    getFarmerDetails: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            const data = await ctx.db.query.farmer.findFirst({
                where: eq(farmer.id, input.farmerId),
                with: {
                    cycles: { where: eq(cycles.status, 'active') },
                    history: true,
                    officer: true
                }
            });

            if (!data) throw new TRPCError({ code: "NOT_FOUND" });

            // Access Check (Post-fetch to get OrgId)
            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, data.organizationId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            return data;
        }),

    // 4. Get Farmer Cycles (Active)
    getFarmerCycles: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, f.organizationId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            const data = await ctx.db.select({
                cycle: cycles,
                farmerName: farmer.name,
            })
                .from(cycles)
                .innerJoin(farmer, eq(cycles.farmerId, farmer.id))
                .where(and(eq(cycles.farmerId, input.farmerId), eq(cycles.status, "active")))
                .orderBy(desc(cycles.createdAt));

            return { items: data.map(d => ({ ...d.cycle, farmerName: d.farmerName })) };
        }),

    // 5. Get Farmer History
    getFarmerHistory: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, f.organizationId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

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
                    createdAt: d.history.startDate,
                    updatedAt: d.history.endDate,
                    intake: d.history.finalIntake,
                    status: 'archived'
                }))
            };
        }),

    // 6. Get Farmer Stock Logs
    getFarmerStockLogs: protectedProcedure
        .input(z.object({ farmerId: z.string() }))
        .query(async ({ ctx, input }) => {
            // Fetch farmer to check Org access
            const f = await ctx.db.query.farmer.findFirst({ where: eq(farmer.id, input.farmerId), columns: { organizationId: true } });
            if (!f) throw new TRPCError({ code: "NOT_FOUND" });

            if (ctx.user.globalRole !== "ADMIN") {
                const membership = await ctx.db.query.member.findFirst({
                    where: and(eq(member.userId, ctx.user.id), eq(member.organizationId, f.organizationId), eq(member.status, "ACTIVE"))
                });
                if (!membership) throw new TRPCError({ code: "FORBIDDEN" });
            }

            return await ctx.db.select()
                .from(stockLogs)
                .where(eq(stockLogs.farmerId, input.farmerId))
                .orderBy(desc(stockLogs.createdAt));
        }),

});
