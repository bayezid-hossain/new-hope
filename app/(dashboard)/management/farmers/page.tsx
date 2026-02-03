"use client";

import LoadingState from "@/components/loading-state";
import { OrgFarmersList } from "@/modules/admin/components/org-farmers-list";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users, Wheat } from "lucide-react";

export default function ManagementFarmersPage() {
    const trpc = useTRPC();

    const { data: statusData, isPending } = useQuery(
        trpc.auth.getMyMembership.queryOptions()
    );

    if (isPending) {
        return <LoadingState title="Loading Farmers" description="Fetching organization details..." />;
    }

    if (!statusData || !statusData.orgId) {
        return (
            <div className="p-8 text-center shrink-0">
                <Building2 className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                <h1 className="text-2xl font-bold text-foreground">No Organization Found</h1>
                <p className="text-muted-foreground">You are not currently part of an organization.</p>
            </div>
        );
    }

    const isAuthorized = statusData.role === "OWNER" || statusData.role === "MANAGER";

    if (!isAuthorized) {
        return (
            <div className="p-8 text-center shrink-0">
                <Users className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
                <p className="text-muted-foreground">Only Managers and Owners can access organization management.</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-8 space-y-8 bg-background min-h-screen">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    <Wheat className="h-8 w-8 text-primary" />
                    Farmer Network
                </h1>
                <p className="text-muted-foreground text-sm mt-1">Manage and oversee all farmers within {statusData.orgName}.</p>
            </div>

            <OrgFarmersList orgId={statusData.orgId} isManagement={true} />
        </div>
    );
}
