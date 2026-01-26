"use client";

import LoadingState from "@/components/loading-state";
import { OfficerAnalytics } from "@/modules/admin/components/officer-analytics";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users } from "lucide-react";

export default function ManagementOfficersPage() {
    const trpc = useTRPC();

    const { data: statusData, isPending } = useQuery(
        trpc.organization.getMyStatus.queryOptions()
    );

    if (isPending) {
        return <LoadingState title="Loading Officers" description="Fetching organization details..." />;
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

    return (
        <div className="p-4 sm:p-8 space-y-8 bg-slate-50/50 min-h-screen">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <Users className="h-8 w-8 text-primary" />
                    Officer Performance
                </h1>
                <p className="text-slate-500 text-sm mt-1">Monitor the performance and activity of your organization&apos;s officers.</p>
            </div>

            <OfficerAnalytics orgId={statusData.orgId} isManagement={true} />
        </div>
    );
}
