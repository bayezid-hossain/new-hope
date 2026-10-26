import {
    deleteReport, getPrefill, getReport, getStandard, listReports, saveReport, type Scope,
} from "@/modules/farmer-visits/server/farmer-visit-service";
import {
    idInputSchema, listInputSchema, prefillInputSchema, saveInputSchema, standardInputSchema,
} from "@/modules/farmer-visits/server/schemas";
import { createTRPCRouter, orgProcedure } from "../../init";

// orgProcedure adds `orgId` to every input and verifies active membership.
const scopeOf = (ctx: { user: { id: string } }, orgId: string): Scope => ({ orgId, officerId: ctx.user.id });

export const officerFarmerVisitsRouter = createTRPCRouter({
    list: orgProcedure
        .input(listInputSchema)
        .query(({ ctx, input }) => listReports(ctx.db, scopeOf(ctx, input.orgId), input)),

    get: orgProcedure
        .input(idInputSchema)
        .query(({ ctx, input }) => getReport(ctx.db, scopeOf(ctx, input.orgId), input.id)),

    getPrefill: orgProcedure
        .input(prefillInputSchema)
        .query(({ ctx, input }) => getPrefill(ctx.db, scopeOf(ctx, input.orgId), input)),

    getStandard: orgProcedure
        .input(standardInputSchema)
        .query(({ ctx, input }) => getStandard(ctx.db, input.age)),

    save: orgProcedure
        .input(saveInputSchema)
        .mutation(({ ctx, input }) =>
            saveReport(ctx.db, scopeOf(ctx, input.orgId), { id: ctx.user.id, name: ctx.user.name }, input)),

    delete: orgProcedure
        .input(idInputSchema)
        .mutation(({ ctx, input }) => deleteReport(ctx.db, scopeOf(ctx, input.orgId), input.id)),
});
