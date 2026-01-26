"use client";

import LoadingState from "@/components/loading-state";
import { ManagementDashboardView } from "@/modules/management/ui/views/management-dashboard-view";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users } from "lucide-react";

export default function ManagementPage() {
    const trpc = useTRPC();

    // Fetch user's organization status to get the orgId
    const { data: statusData, isPending } = useQuery(
        trpc.auth.getMyMembership.queryOptions()
    );

    if (isPending) {
        return <LoadingState title="Loading Management" description="Fetching organization details..." />;
    }

    if (!statusData || !statusData.orgId) {
        return (
            <div className="p-8 text-center shrink-0">
                <Building2 className="size-12 mx-auto text-slate-300 mb-4" />
                <h1 className="text-2xl font-bold text-slate-900">No Organization Found</h1>
                <p className="text-slate-500">You are not currently part of an organization.</p>
            </div>
        );
    }

    // Check if the user is authorized to be here
    const isAuthorized = statusData.role === "OWNER" || statusData.role === "MANAGER";

    if (!isAuthorized) {
        return (
            <div className="p-8 text-center shrink-0">
                <Users className="size-12 mx-auto text-slate-300 mb-4" />
                <h1 className="text-2xl font-bold text-slate-900">Access Denied</h1>
                <p className="text-slate-500">Only Managers and Owners can access organization management.</p>
            </div>
        );
    }

    return <ManagementDashboardView orgId={statusData.orgId} orgName={statusData.orgName} />;
}

