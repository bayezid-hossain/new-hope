import { createTRPCRouter } from "../../init";
import { adminCyclesRouter } from "./cycles";
import { adminOfficersRouter } from "./officers";
import { adminOrganizationRouter } from "./organization";
import { adminStatsRouter } from "./stats";

export const adminRouter = createTRPCRouter({
  cycles: adminCyclesRouter,
  organizations: adminOrganizationRouter,
  officers: adminOfficersRouter,
  stats: adminStatsRouter,
});