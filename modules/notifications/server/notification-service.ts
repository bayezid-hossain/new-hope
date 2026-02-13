import { db } from "@/db";
import { member, notification } from "@/db/schema";
import { and, eq, or } from "drizzle-orm";

export type NotificationType = "INFO" | "WARNING" | "CRITICAL" | "SUCCESS" | "UPDATE" | "SALES";

interface SendNotificationParams {
    userId: string;
    organizationId?: string;
    title: string;
    message: string;
    details?: string;
    type: NotificationType;
    link?: string;
    adminLink?: string;
    managementLink?: string;
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
     * with role-specific dynamic links
     */
    static async sendToOrgManagers({
        organizationId,
        title,
        message,
        details,
        type,
        link,
        adminLink,
        managementLink,
        metadata
    }: Omit<SendNotificationParams, "userId">) {
        try {
            const { user: userTable } = await import("@/db/schema");

            // 1. Find all eligible members (OWNER or MANAGER)
            const eligibleMembers = await db
                .select({
                    userId: member.userId,
                    role: member.role
                })
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
            const globalAdmins = await db
                .select({
                    userId: userTable.id,
                    globalRole: userTable.globalRole
                })
                .from(userTable)
                .where(eq(userTable.globalRole, "ADMIN"));

            // 3. Create list of recipients with their "best" link
            const recipients = new Map<string, string | undefined>();

            // Global Admins get adminLink (or link as fallback)
            globalAdmins.forEach(a => {
                recipients.set(a.userId, adminLink || link);
            });

            // Managers get managementLink (or link as fallback)
            // Note: If they are also Global Admins, the adminLink preference from above sticks 
            // OR we can decide preference. Usually Admin view is more powerful.
            eligibleMembers.forEach(m => {
                if (!recipients.has(m.userId)) {
                    recipients.set(m.userId, managementLink || link);
                }
            });

            if (recipients.size === 0) return 0;

            // 4. Batch insert notifications
            const values = Array.from(recipients.entries()).map(([userId, userLink]) => ({
                userId,
                organizationId,
                title,
                message,
                details,
                type,
                link: userLink,
                metadata: metadata ? JSON.stringify(metadata) : undefined,
            }));

            await db.insert(notification).values(values);

            return recipients.size;
        } catch (error) {
            console.error("Failed to broadcast notification:", error);
            return 0;
        }
    }
}
