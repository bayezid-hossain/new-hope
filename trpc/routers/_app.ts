import { createTRPCRouter } from "../init";
import { adminRouter } from "./admin/admin";
import { authRouter } from "./auth";
import { managementRouter } from "./management/management";
import { officerRouter } from "./officer/officer";


export const appRouter = createTRPCRouter({
  admin: adminRouter,
  officer: officerRouter,
  auth: authRouter,
  management: managementRouter,
});

export type AppRouter = typeof appRouter;