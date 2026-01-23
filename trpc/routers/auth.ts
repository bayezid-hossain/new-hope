// src/server/routers/auth.ts
import { createTRPCRouter, publicProcedure } from "../init";

export const authRouter = createTRPCRouter({
  getSession: publicProcedure.query(({ ctx }) => {
    // We simply return the context data we already fetched in init.ts
    return { 
      session: ctx.session, 
      user: ctx.user // This contains the 'globalRole' from Drizzle
    };
  }),
});