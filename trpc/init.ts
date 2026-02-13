import { db } from "@/db";
import { member, user } from "@/db/schema"; // Import your schema
import { auth } from "@/lib/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import superjson from "superjson";
import { z } from "zod";

export const createTRPCContext = cache(async () => {
  const heads = new Headers(await headers());

  // 1. Get the session from Better Auth
  const sessionData = await auth.api.getSession({
    headers: heads
  });

  // 2. FETCH FULL USER FROM DB (Fixes the type error & ensures fresh data)
  // We do this because the session token might not have 'globalRole' inside it
  const fullUser = sessionData?.user
    ? await db.query.user.findFirst({
      where: eq(user.id, sessionData.user.id)
    })
    : null;

  return {
    db,
    user: fullUser, // <--- This now has the strict Drizzle type including 'globalRole'
    session: sessionData?.session,
    headers: heads,
  };
});

// Initialize tRPC
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

// Protected Middleware
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  // Check if user exists (fetched from DB above)
  if (!ctx.session || !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }

  return next({
    ctx: {
      // Force non-nullable types for the next step
      session: ctx.session,
      user: ctx.user,
    },
  });
});

// Role-based procedures
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.globalRole !== "ADMIN") {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin access required" });
  }
  return next({ ctx });
});

export const proProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  // Admins always have access
  if (ctx.user.globalRole === "ADMIN") {
    return next({ ctx });
  }

  // Check if Pro is enabled
  if (!ctx.user.isPro) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This is a Pro feature. Please request access."
    });
  }

  // Check if subscription has expired
  if (ctx.user.proExpiresAt && ctx.user.proExpiresAt < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your Pro subscription has expired. Please renew to continue using Pro features."
    });
  }

  return next({ ctx });
});

export const officerProcedure = protectedProcedure;

export const orgProcedure = protectedProcedure
  .input(z.object({ orgId: z.string() }))
  .use(async ({ ctx, input, next }) => {
    const membership = await ctx.db.query.member.findFirst({
      where: and(
        eq(member.userId, ctx.user.id),
        eq(member.organizationId, input.orgId),
        eq(member.status, "ACTIVE")
      ),
    });

    if (!membership && ctx.user.globalRole !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not a member of this organization",
      });
    }

    // STRICT MODE CHECK: If a manager is in OFFICER mode, treat them as an officer
    // This affects procedures that use orgProcedure for management tasks
    if (
      membership &&
      membership.activeMode === "OFFICER" &&
      (membership.role === "OWNER" || membership.role === "MANAGER") &&
      ctx.user.globalRole !== "ADMIN"
    ) {
      // NOTE: We allow the procedure to continue, but the 'managementProcedure' 
      // check below will block it if it's explicitly a management-only task.
      // However, for generic org items, we letting them through as an 'officer'.
    }

    return next({
      ctx: {
        ...ctx,
        membership,
      },
    });
  });

/**
 * Management Procedure
 * Strictly requires MANAGEMENT mode and OWNER/MANAGER role
 */
export const managementProcedure = orgProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.globalRole === "ADMIN") return next({ ctx });

  if (ctx.membership?.activeMode !== "MANAGEMENT") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You must be in Management Mode to access this feature",
    });
  }

  if (ctx.membership.role !== "OWNER" && ctx.membership.role !== "MANAGER") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only Managers and Owners can access this feature",
    });
  }

  return next({ ctx });
});
/**
 * Management Pro Procedure
 * Combines management logic (activeMode, role) and pro gating
 */
export const managementProProcedure = managementProcedure.use(async ({ ctx, next }) => {
  // Admins always have access
  if (ctx.user.globalRole === "ADMIN") {
    return next({ ctx });
  }

  // Check if Pro is enabled
  if (!ctx.user.isPro) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This is a Pro feature. Please request access."
    });
  }

  // Check if subscription has expired
  if (ctx.user.proExpiresAt && ctx.user.proExpiresAt < new Date()) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Your Pro subscription has expired. Please renew to continue using Pro features."
    });
  }

  return next({ ctx });
});
