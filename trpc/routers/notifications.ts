
import { db } from "@/db";
import { notification } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";

export const notificationsRouter = createTRPCRouter({
    list: protectedProcedure
        .input(
            z.object({
                limit: z.number().min(1).max(100).default(20),
                cursor: z.number().nullish(), // Using offset-based for simpler pagination or use ID based if necessary
                search: z.string().optional(),
                unreadOnly: z.boolean().optional(),
            })
        )
        .query(async ({ ctx, input }) => {
            const { limit, cursor, search, unreadOnly } = input;
            const offset = cursor || 0;

            const conditions: any[] = [eq(notification.userId, ctx.user.id)];

            if (unreadOnly) {
                conditions.push(eq(notification.isRead, false));
            }

            if (search) {
                conditions.push(
                    or(
                        ilike(notification.title, `%${search}%`),
                        ilike(notification.message, `%${search}%`)
                    )
                );
            }

            const items = await db
                .select()
                .from(notification)
                .where(and(...conditions))
                .orderBy(desc(notification.createdAt))
                .limit(limit + 1)
                .offset(offset);

            let nextCursor: typeof cursor | undefined = undefined;
            if (items.length > limit) {
                items.pop();
                nextCursor = offset + limit;
            }

            return {
                items,
                nextCursor,
            };
        }),

    getUnreadCount: protectedProcedure
        .query(async ({ ctx }) => {
            const result = await db
                .select({ count: sql<number>`count(*)` })
                .from(notification)
                .where(
                    and(
                        eq(notification.userId, ctx.user.id),
                        eq(notification.isRead, false)
                    )
                );
            return { count: Number(result[0]?.count || 0) };
        }),

    markAsRead: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await db
                .update(notification)
                .set({ isRead: true })
                .where(
                    and(
                        eq(notification.id, input.id),
                        eq(notification.userId, ctx.user.id)
                    )
                );
            return { success: true };
        }),

    markAllAsRead: protectedProcedure
        .mutation(async ({ ctx }) => {
            await db
                .update(notification)
                .set({ isRead: true })
                .where(eq(notification.userId, ctx.user.id));
            return { success: true };
        }),

    delete: protectedProcedure
        .input(z.object({ id: z.string() }))
        .mutation(async ({ ctx, input }) => {
            await db
                .delete(notification)
                .where(
                    and(
                        eq(notification.id, input.id),
                        eq(notification.userId, ctx.user.id)
                    )
                );
            return { success: true };
        }),

    getDetails: protectedProcedure
        .input(z.object({ id: z.string() }))
        .query(async ({ ctx, input }) => {
            const item = await db.query.notification.findFirst({
                where: and(
                    eq(notification.id, input.id),
                    eq(notification.userId, ctx.user.id)
                )
            });
            return item;
        }),
});
