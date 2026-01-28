import { db } from "@/db";
import { user } from "@/db/schema"; // Import your schema
import { auth } from "@/lib/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { cache } from "react";
import superjson from "superjson";

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

// Role-based procedures (currently aliases, can be enhanced later)
export const officerProcedure = protectedProcedure;