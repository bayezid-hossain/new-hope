import { createTRPCRouter } from "../init";
import { adminRouter } from "./admin/admin";
import { authRouter } from "./auth";
import { farmersRouter } from "./farmer-router";
import { mainStockRouter } from "./mainstock-router";
import { managementRouter } from "./management/management";
import { officerRouter } from "./officer/officer";
import { organizationRouter } from "./organization";


export const appRouter = createTRPCRouter({
  organization: organizationRouter,
  admin: adminRouter,
  officer: officerRouter,
  auth: authRouter,
  mainstock: mainStockRouter,
  farmers: farmersRouter,
  management: managementRouter,
  // users: usersRouter,
  // cycles: cyclesRouter,
});

export type AppRouter = typeof appRouter;