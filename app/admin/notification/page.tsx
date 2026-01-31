"use client";

import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { NotificationsView } from "@/modules/notifications/components/notifications-view";

export default function AdminNotificationPage() {
    return (
        <AdminGuard>
            <NotificationsView />
        </AdminGuard>
    );
}
