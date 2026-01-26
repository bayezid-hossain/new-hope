import { member, user } from "@/db/schema";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "../../init";

export const managementMembersRouter = createTRPCRouter({
    list: protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
            return await ctx.db.select({
                id: member.id,
                userId: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                role: member.role,
                status: member.status,
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

    approve: protectedProcedure
        .input(z.object({
            memberId: z.string()
        }))
        .mutation(async ({ ctx, input }) => {
            const actorId = ctx.user.id;

            const targetMember = await ctx.db.query.member.findFirst({
                where: eq(member.id, input.memberId),
            });

            if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Request not found" });

            const actorMember = await ctx.db.query.member.findFirst({
                where: and(
                    eq(member.userId, actorId),
                    eq(member.organizationId, targetMember.organizationId),
                    eq(member.status, "ACTIVE")
                )
            });

            let isAuthorized = false;
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

    updateRole: protectedProcedure
        .input(z.object({ memberId: z.string(), role: z.enum(["MANAGER", "OFFICER"]) }))
        .mutation(async ({ ctx, input }) => {
            const targetMember = await ctx.db.query.member.findFirst({
                where: eq(member.id, input.memberId),
            });

            if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

            if (targetMember.userId === ctx.user.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You cannot change your own role. Please ask another Manager or Owner."
                });
            }

            await ctx.db.update(member)
                .set({ role: input.role })
                .where(eq(member.id, input.memberId));
            return { success: true };
        }),

    updateStatus: protectedProcedure
        .input(z.object({
            memberId: z.string(),
            status: z.enum(["ACTIVE", "INACTIVE"])
        }))
        .mutation(async ({ ctx, input }) => {
            const actorId = ctx.user.id;

            const targetMember = await ctx.db.query.member.findFirst({
                where: eq(member.id, input.memberId),
            });

            if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

            if (targetMember.userId === actorId) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You cannot change your own membership status."
                });
            }

            const actorMember = await ctx.db.query.member.findFirst({
                where: and(
                    eq(member.userId, actorId),
                    eq(member.organizationId, targetMember.organizationId),
                    eq(member.status, "ACTIVE")
                )
            });

            let isAuthorized = false;
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

    remove: protectedProcedure
        .input(z.object({ memberId: z.string() }))
        .mutation(async ({ ctx, input }) => {
            const targetMember = await ctx.db.query.member.findFirst({
                where: eq(member.id, input.memberId),
            });

            if (!targetMember) throw new TRPCError({ code: "NOT_FOUND", message: "Member not found" });

            if (targetMember.userId === ctx.user.id) {
                throw new TRPCError({
                    code: "FORBIDDEN",
                    message: "You cannot remove yourself from the organization. Please ask an Owner or another Manager."
                });
            }

            await ctx.db.delete(member).where(eq(member.id, input.memberId));
            return { success: true };
        }),
});
