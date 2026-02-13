
"use client";

import { ManagementGuard } from "@/modules/management/components/management-guard";
import { ManagementReportsView } from "@/modules/management/ui/views/management-reports-view";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export default function ManagementReportsPage() {
    const trpc = useTRPC();

    const { data: statusData } = useQuery(
        trpc.auth.getMyMembership.queryOptions()
    );

    return (
        <ManagementGuard>
            {statusData?.orgId && (
                <ManagementReportsView
                    orgId={statusData.orgId}
                />
            )}
        </ManagementGuard>
    );
}
