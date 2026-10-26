import {
    cycleSummary, deleteReport, getPrefill, getReport, getStandard, listReports, saveReport, type Scope,
} from "@/modules/farmer-visits/server/farmer-visit-service";
import {
    cycleSummaryInputSchema, idInputSchema, listInputSchema, prefillInputSchema, saveInputSchema, standardInputSchema,
} from "@/modules/farmer-visits/server/schemas";
import { createTRPCRouter, orgProProcedure } from "../../init";

// orgProProcedure adds `orgId` to every input and verifies active membership.
const scopeOf = (ctx: { user: { id: string } }, orgId: string): Scope => ({ orgId, officerId: ctx.user.id });

export const officerFarmerVisitsRouter = createTRPCRouter({
    list: orgProProcedure
        .input(listInputSchema)
        .query(({ ctx, input }) => listReports(ctx.db, scopeOf(ctx, input.orgId), input)),

    get: orgProProcedure
        .input(idInputSchema)
        .query(({ ctx, input }) => getReport(ctx.db, scopeOf(ctx, input.orgId), input.id)),

    getPrefill: orgProProcedure
        .input(prefillInputSchema)
        .query(({ ctx, input }) => getPrefill(ctx.db, scopeOf(ctx, input.orgId), input)),

    cycleSummary: orgProProcedure
        .input(cycleSummaryInputSchema)
        .query(({ ctx, input }) => cycleSummary(ctx.db, scopeOf(ctx, input.orgId), input)),

    getStandard: orgProProcedure
        .input(standardInputSchema)
        .query(({ ctx, input }) => getStandard(ctx.db, input.age)),

    save: orgProProcedure
        .input(saveInputSchema)
        .mutation(({ ctx, input }) =>
            saveReport(ctx.db, scopeOf(ctx, input.orgId), { id: ctx.user.id, name: ctx.user.name }, input)),

    delete: orgProProcedure
        .input(idInputSchema)
        .mutation(({ ctx, input }) => deleteReport(ctx.db, scopeOf(ctx, input.orgId), input.id)),
});
