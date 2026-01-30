import { createTRPCRouter } from "../init";
import { adminRouter } from "./admin/admin";
import { authRouter } from "./auth";
import { managementRouter } from "./management/management";
import { officerRouter } from "./officer/officer";


import { aiRouter } from "./ai";

import { notificationsRouter } from "./notifications";

export const appRouter = createTRPCRouter({
  admin: adminRouter,
  officer: officerRouter,
  auth: authRouter,
  management: managementRouter,
  ai: aiRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;