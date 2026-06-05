"use client";

import { ManagementGuard } from "@/modules/management/components/management-guard";
import { PricePoliciesView } from "@/modules/management/ui/views/price-policies-view";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export default function PricePoliciesPage() {
    const trpc = useTRPC();

    const { data: statusData } = useQuery(
        trpc.auth.getMyMembership.queryOptions()
    );

    return (
        <ManagementGuard>
            {statusData?.orgId && (
                <PricePoliciesView orgId={statusData.orgId} />
            )}
        </ManagementGuard>
    );
}
