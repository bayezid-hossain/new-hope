"use client";

import { ManagementGuard } from "@/modules/management/components/management-guard";
import { ManagementDashboardView } from "@/modules/management/ui/views/management-dashboard-view";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export default function ManagementPage() {
    const trpc = useTRPC();

    // Fetch user's organization status to get the orgId
    const { data: statusData } = useQuery(
        trpc.auth.getMyMembership.queryOptions()
    );

    return (
        <ManagementGuard>
            {statusData?.orgId && (
                <ManagementDashboardView
                    orgId={statusData.orgId}
                    orgName={statusData.orgName!}
                />
            )}
        </ManagementGuard>
    );
}
