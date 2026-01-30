import { db } from "@/db";
import { member, notification } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";

export type NotificationType = "INFO" | "WARNING" | "CRITICAL" | "SUCCESS" | "UPDATE";

interface SendNotificationParams {
    userId: string;
    organizationId?: string;
    title: string;
    message: string;
    details?: string;
    type: NotificationType;
    link?: string;
    metadata?: any;
}

export class NotificationService {
    /**
     * Send a single notification to a specific user
     */
    static async send({
        userId,
        organizationId,
        title,
        message,
        details,
        type,
        link,
        metadata
    }: SendNotificationParams) {
        try {
            await db.insert(notification).values({
                userId,
                organizationId,
                title,
                message,
                details,
                type,
                link,
                metadata: metadata ? JSON.stringify(metadata) : undefined,
            });
            return true;
        } catch (error) {
            console.error("Failed to send notification:", error);
            return false;
        }
    }

    /**
     * Send a notification to all Admins and Managers of an organization
     */
    static async sendToOrgManagers({
        organizationId,
        title,
        message,
        details,
        type,
        link,
        metadata
    }: Omit<SendNotificationParams, "userId">) {
        try {
            // 1. Find all eligible members (OWNER or MANAGER)
            const eligibleMembers = await db
                .select({ userId: member.userId })
                .from(member)
                .where(
                    and(
                        eq(member.organizationId, organizationId!),
                        or(
                            eq(member.role, "OWNER"),
                            eq(member.role, "MANAGER")
                        )
                    )
                );

            // 2. Find all global Admins
            const { user } = await import("@/db/schema");
            const globalAdmins = await db
                .select({ userId: user.id })
                .from(user)
                .where(eq(user.globalRole, "ADMIN"));

            // 3. Combine and Deduplicate
            const recipientIds = new Set([
                ...eligibleMembers.map(m => m.userId),
                ...globalAdmins.map(a => a.userId)
            ]);

            if (recipientIds.size === 0) return 0;

            const userIds = Array.from(recipientIds);

            // 2. Batch insert notifications
            // Note: Postgres supports multiple values in one insert, but Drizzle might want array of objects
            const values = userIds.map((userId) => ({
                userId,
                organizationId,
                title,
                message,
                details,
                type,
                link,
                metadata: metadata ? JSON.stringify(metadata) : undefined,
            }));

            await db.insert(notification).values(values);

            return userIds.length;
        } catch (error) {
            console.error("Failed to broadcast notification:", error);
            return 0;
        }
    }
}
