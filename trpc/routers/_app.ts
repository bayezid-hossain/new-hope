import { createTRPCRouter } from "../init";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import { officerRouter } from "./officer-router";
import { organizationRouter } from "./organization";


export const appRouter = createTRPCRouter({
  organization: organizationRouter,
  admin:adminRouter,
  officer:officerRouter,
  auth:authRouter,
  // users: usersRouter,
  // cycles: cyclesRouter,
});

export type AppRouter = typeof appRouter;