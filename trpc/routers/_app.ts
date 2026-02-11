import { createTRPCRouter } from "../init";
import { adminRouter } from "./admin/admin";
import { aiRouter } from "./ai";
import { authRouter } from "./auth";
import { managementRouter } from "./management/management";
import { managementPerformanceReportsRouter } from "./management/performance-reports";
import { notificationsRouter } from "./notifications";
import { officerRouter } from "./officer/officer";
import { performanceReportsRouter as officerPerformanceReportsRouter } from "./officer/performance-reports";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  ai: aiRouter,
  notifications: notificationsRouter,

  // Role-based routers (Nested)
  // These contain the sub-routers like cycles, farmers, etc.
  admin: adminRouter,
  management: managementRouter,
  officer: officerRouter,

  // Direct access to performance reports (for recent feature changes)
  // These are also available inside the role-based routers but kept here for compatibility
  officerPerformance: officerPerformanceReportsRouter,
  managementPerformance: managementPerformanceReportsRouter,
});

export type AppRouter = typeof appRouter;