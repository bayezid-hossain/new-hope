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

    return next({
      ctx: {
        ...ctx,
        membership,
      },
    });
  });