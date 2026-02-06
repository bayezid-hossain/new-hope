import { createTRPCRouter } from "../../init";
import { managementAnalyticsRouter } from "./analytics";
import { managementCyclesRouter } from "./cycles";
import { managementFarmersRouter } from "./farmers";
import { managementMembersRouter } from "./members";
import { managementOfficersRouter } from "./officers";
import { managementReportsRouter } from "./reports";


export const managementRouter = createTRPCRouter({
    cycles: managementCyclesRouter,
    farmers: managementFarmersRouter,
    analytics: managementAnalyticsRouter,
    members: managementMembersRouter,
    officers: managementOfficersRouter,
    reports: managementReportsRouter,
});

