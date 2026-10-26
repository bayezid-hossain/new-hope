import { TRPCError } from "@trpc/server";
import {
    cycleSummary, deleteReport, getPrefill, getReport, getStandard, listReports, saveReport, type Scope,
} from "@/modules/farmer-visits/server/farmer-visit-service";
import {
    cycleSummaryInputSchema, idInputSchema, listInputSchema, prefillInputSchema, saveInputSchema, standardInputSchema,
} from "@/modules/farmer-visits/server/schemas";
import { createTRPCRouter, managementProProcedure } from "../../init";

const scopeOf = (orgId: string): Scope => ({ orgId });

// View-only managers can read but not write (same rule as price policies).
const assertCanEdit = (ctx: { user: { globalRole: string | null }; membership?: { accessLevel: string } | null }) => {
    if (ctx.user.globalRole === "ADMIN") return;
    if (ctx.membership?.accessLevel !== "EDIT") {
        throw new TRPCError({ code: "FORBIDDEN", message: "You need edit access to manage farmer visit reports." });
    }
};

export const managementFarmerVisitsRouter = createTRPCRouter({
    list: managementProProcedure
        .input(listInputSchema)
        .query(({ ctx, input }) => listReports(ctx.db, scopeOf(input.orgId), input)),

    get: managementProProcedure
        .input(idInputSchema)
        .query(({ ctx, input }) => getReport(ctx.db, scopeOf(input.orgId), input.id)),

    getPrefill: managementProProcedure
        .input(prefillInputSchema)
        .query(({ ctx, input }) => getPrefill(ctx.db, scopeOf(input.orgId), input)),

    cycleSummary: managementProProcedure
        .input(cycleSummaryInputSchema)
        .query(({ ctx, input }) => cycleSummary(ctx.db, scopeOf(input.orgId), input)),

    getStandard: managementProProcedure
        .input(standardInputSchema)
        .query(({ ctx, input }) => getStandard(ctx.db, input.age)),

    save: managementProProcedure
        .input(saveInputSchema)
        .mutation(({ ctx, input }) => {
            assertCanEdit(ctx as any);
            return saveReport(ctx.db, scopeOf(input.orgId), { id: ctx.user.id, name: ctx.user.name }, input);
        }),

    delete: managementProProcedure
        .input(idInputSchema)
        .mutation(({ ctx, input }) => {
            assertCanEdit(ctx as any);
            return deleteReport(ctx.db, scopeOf(input.orgId), input.id);
        }),
});
