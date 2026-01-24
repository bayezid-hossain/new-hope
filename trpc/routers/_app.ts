import { createTRPCRouter } from "../init";
import { adminRouter } from "./admin";
import { authRouter } from "./auth";
import { cyclesRouter } from "./cycle-router";
import { farmersRouter } from "./farmer-router";
import { mainStockRouter } from "./mainstock-router";
import { officerRouter } from "./officer-router";
import { organizationRouter } from "./organization";


export const appRouter = createTRPCRouter({
  organization: organizationRouter,
  admin:adminRouter,
  officer:officerRouter,
  auth:authRouter,
  cycles:cyclesRouter,
  mainstock:mainStockRouter,
  farmers:farmersRouter
  // users: usersRouter,
  // cycles: cyclesRouter,
});

export type AppRouter = typeof appRouter;