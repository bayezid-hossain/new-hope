import { createTRPCRouter } from "../../init";
import { managementAnalyticsRouter } from "./analytics";
import { managementCyclesRouter } from "./cycles";
import { managementDocOrdersRouter } from "./doc-orders";
import { managementFarmersRouter } from "./farmers";
import { managementFeedOrdersRouter } from "./feed-orders";
import { managementMembersRouter } from "./members";
import { managementOfficersRouter } from "./officers";
import { managementPerformanceReportsRouter } from "./performance-reports";
import { managementPricePoliciesRouter } from "./price-policies";
import { managementReportsRouter } from "./reports";
import { managementSaleOrdersRouter } from "./sale-orders";
import { managementSalesRouter } from "./sales";
import { managementStockRouter } from "./stock";


export const managementRouter = createTRPCRouter({
    cycles: managementCyclesRouter,
    farmers: managementFarmersRouter,
    analytics: managementAnalyticsRouter,
    members: managementMembersRouter,
    officers: managementOfficersRouter,
    reports: managementReportsRouter,
    performanceReports: managementPerformanceReportsRouter,
    feedOrders: managementFeedOrdersRouter,
    docOrders: managementDocOrdersRouter,
    saleOrders: managementSaleOrdersRouter,
    sales: managementSalesRouter,
    stock: managementStockRouter,
    pricePolicies: managementPricePoliciesRouter,
});
