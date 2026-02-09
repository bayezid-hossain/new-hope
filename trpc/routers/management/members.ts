import { member, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, orgProcedure } from "../../init";

export const managementMembersRouter = createTRPCRouter({
    list: orgProcedure
        .query(async ({ ctx, input }) => {
            return await ctx.db.select({
                id: member.id,
                userId: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                role: member.role,
                status: member.status,
                accessLevel: member.accessLevel,
                joinedAt: member.createdAt
            })
                .from(member)
                .innerJoin(user, eq(member.userId, user.id))
                .where(
                    and(
                        eq(member.organizationId, input.orgId),
                        sql`${member.userId} != ${ctx.user.id}`
                    )
                );
        }),

    approve: orgProcedure
        .input(z.object({
            memberId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const actorId = ctx.user.id;
            const actorMember = ctx.membership;

            const targetMember = await ctx.db.query.member.findFirst({
                where: eq(member.id, input.memberId),
            });

            if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });

            // Ensure target is in the same organization as the orgId provided
            if (targetMember.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Member belongs to a different organization" });
            }

            let isAuthorized = false;
            // Managers (even in VIEW mode) can approve members
            if (actorMember?.role === "OWNER") isAuthorized = true;
            else if (actorMember?.role === "MANAGER" && targetMember.role === "OFFICER") isAuthorized = true;
            else if (ctx.user.globalRole === "ADMIN") isAuthorized = true;

            if (!isAuthorized) {
                throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to approve this member." });
            }

            const [updatedMember] = await ctx.db.update(member)
                .set({ status: "ACTIVE" })
                .where(eq(member.id, input.memberId))
                .returning();

            return updatedMember;
        }),

    updateRole: orgProcedure
        .input(z.object({ memberId: z.string(), role: z.enum(["MANAGER", "OFFICER"]) }))
        .mutation(async ({ ctx, input }) => {
            const actorMember = ctx.membership;

            const targetMember = await ctx.db.query.member.findFirst({
                where: eq(member.id, input.memberId),
            });

            if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

            if (targetMember.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Member belongs to a different organization" });
            }

            if (targetMember.userId === ctx.user.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You cannot change your own role. Please ask another Manager or Owner."
                });
            }

            // Authorization
            let isAuthorized = false;
            if (actorMember?.role === "OWNER") isAuthorized = true;
            else if (ctx.user.globalRole === "ADMIN") isAuthorized = true;

            if (!isAuthorized) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Only Owners can change roles." });
            }

            await ctx.db.update(member)
                .set({ role: input.role })
                .where(eq(member.id, input.memberId));
            return { success: true };
        }),

    updateAccess: orgProcedure
        .input(z.object({
            memberId: z.string(),
            accessLevel: z.enum(["VIEW", "EDIT"])
        }))
        .mutation(async ({ ctx, input }) => {
            const actorMember = ctx.membership;

            const targetMember = await ctx.db.query.member.findFirst({
                where: eq(member.id, input.memberId),
            });

            if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

            if (targetMember.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Member belongs to a different organization" });
            }

            // Only allow changing access for Managers. Officers are always EDIT.
            if (targetMember.role === "OFFICER") {
                throw new TRPCError({ code: "BAD_REQUEST", message: "Officers always have EDIT access." });
            }

            if (targetMember.userId === ctx.user.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You cannot change your own access level."
                });
            }

            let isAuthorized = false;
            if (actorMember?.role === "OWNER") isAuthorized = true;
            else if (ctx.user.globalRole === "ADMIN") isAuthorized = true;

            if (!isAuthorized) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Only Owners can change access levels." });
            }

            await ctx.db.update(member)
                .set({ accessLevel: input.accessLevel })
                .where(eq(member.id, input.memberId));

            return { success: true };
        }),

    updateStatus: orgProcedure
        .input(z.object({
            memberId: z.string(),
            status: z.enum(["ACTIVE", "INACTIVE"])
        }))
        .mutation(async ({ ctx, input }) => {
            const actorMember = ctx.membership;

            const targetMember = await ctx.db.query.member.findFirst({
                where: eq(member.id, input.memberId),
            });

            if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

            if (targetMember.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Member belongs to a different organization" });
            }

            if (targetMember.userId === ctx.user.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You cannot change your own membership status."
                });
            }

            let isAuthorized = false;
            // Managers (even VIEW) can update status of Officers? 
            // Logic says Managers can generally manage status.
            if (actorMember?.role === "OWNER" || actorMember?.role === "MANAGER") isAuthorized = true;
            else if (ctx.user.globalRole === "ADMIN") isAuthorized = true;

            if (!isAuthorized) {
                throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to change member status." });
            }

            await ctx.db.update(member)
                .set({ status: input.status })
                .where(eq(member.id, input.memberId));

            return { success: true };
        }),

    remove: orgProcedure
        .input(z.object({ memberId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const actorMember = ctx.membership;
            const targetMember = await ctx.db.query.member.findFirst({
                where: eq(member.id, input.memberId),
            });

            if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

            if (targetMember.organizationId !== input.orgId) {
                throw new TRPCError({ code: "FORBIDDEN", message: "Member belongs to a different organization" });
            }

            if (targetMember.userId === ctx.user.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You cannot remove yourself from the organization. Please ask an Owner or another Manager."
                });
            }

            let isAuthorized = false;
            if (actorMember?.role === "OWNER") isAuthorized = true;
            else if (actorMember?.role === "MANAGER" && targetMember.role === "OFFICER") isAuthorized = true;
            else if (ctx.user.globalRole === "ADMIN") isAuthorized = true;

            if (!isAuthorized) {
                throw new TRPCError({ code: "FORBIDDEN", message: "You do not have permission to remove this member." });
            }

            await ctx.db.delete(member).where(eq(member.id, input.memberId));
            return { success: true };
        }),
});
