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
    private static async sendExpoPush(tokens: string[], title: string, message: string, data?: any) {
        if (!tokens.length) return;
        try {
            const chunks = [];
            for (let i = 0; i < tokens.length; i += 100) {
                chunks.push(tokens.slice(i, i + 100));
            }

            for (const chunk of chunks) {
                const messages = chunk.map(token => ({
                    to: token,
                    sound: 'default',
                    title,
                    body: message,
                    data,
                    channelId: 'alerts',
                    priority: 'high',
                }));

                const res = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        Accept: 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messages),
                });
                const resText = await res.text();
                //console.log`[NotificationService] Expo API Response (${res.status}): ${resText}`);
            }
        } catch (error) {
            console.error("Failed to send Expo push notification:", error);
        }
    }

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

            const { user: userTable } = await import("@/db/schema");
            const targetUser = await db.query.user.findFirst({
                where: eq(userTable.id, userId),
                columns: { expoPushToken: true }
            });

            if (targetUser?.expoPushToken) {
                await this.sendExpoPush([targetUser.expoPushToken], title, message, { link, type, metadata });
            }

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
                    role: member.role,
                    expoPushToken: userTable.expoPushToken
                })
                .from(member)
                .innerJoin(userTable, eq(member.userId, userTable.id))
                .where(
                    and(
                        eq(member.organizationId, organizationId!),
                        eq(member.status, "ACTIVE"),
                        eq(member.activeMode, "MANAGEMENT"), // Only send to active managers
                        or(
                            eq(member.role, "OWNER"),
                            eq(member.role, "MANAGER")
                        )
                    )
                );
            //console.log`[NotificationService] Found ${eligibleMembers.length} eligible members with activeMode=MANAGEMENT: ${eligibleMembers.map(m => m.userId).join(', ')}`);

            // 2. Find all global Admins
            const globalAdmins = await db
                .select({
                    userId: userTable.id,
                    globalRole: userTable.globalRole,
                    expoPushToken: userTable.expoPushToken
                })
                .from(userTable)
                .where(
                    and(
                        eq(userTable.globalRole, "ADMIN"),
                        eq(userTable.activeMode, "ADMIN") // Only send to active admins
                    )
                );
            //console.log`[NotificationService] Found ${globalAdmins.length} global admins with activeMode=ADMIN`);

            // 3. Create list of recipients with their "best" link
            const recipients = new Map<string, { link: string | undefined, token: string | null }>();

            // Global Admins get adminLink (or link as fallback)
            globalAdmins.forEach(a => {
                recipients.set(a.userId, { link: adminLink || link, token: a.expoPushToken });
            });

            // Managers get managementLink (or link as fallback)
            eligibleMembers.forEach(m => {
                if (!recipients.has(m.userId)) {
                    recipients.set(m.userId, { link: managementLink || link, token: m.expoPushToken });
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
                link: userLink.link,
                metadata: metadata ? JSON.stringify(metadata) : undefined,
            }));

            await db.insert(notification).values(values);

            // 5. Send Expo push
            const pushTargets = [...new Set(Array.from(recipients.values())
                .filter(r => r.token)
                .map(r => r.token as string))];

            if (pushTargets.length > 0) {
                await this.sendExpoPush(pushTargets, title, message, { type, link: managementLink || adminLink || link, metadata });
            }

            return recipients.size;
        } catch (error) {
            console.error("Failed to broadcast notification:", error);
            return 0;
        }
    }
}
