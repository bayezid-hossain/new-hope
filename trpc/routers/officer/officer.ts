import { createTRPCRouter } from "../../init";
import { officerCyclesRouter } from "./cycles";
import { officerFarmersRouter } from "./farmers";
import { officerStockRouter } from "./stock";

export const officerRouter = createTRPCRouter({
    cycles: officerCyclesRouter,
    farmers: officerFarmersRouter,
    stock: officerStockRouter,
});
