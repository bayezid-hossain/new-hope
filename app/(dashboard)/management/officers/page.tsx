"use client";

import LoadingState from "@/components/loading-state";
import { OfficerAnalytics } from "@/modules/admin/components/officer-analytics";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users } from "lucide-react";

export default function ManagementOfficersPage() {
    const trpc = useTRPC();

    const { data: statusData, isPending } = useQuery(
        trpc.auth.getMyMembership.queryOptions()
    );

    if (isPending) {
        return <LoadingState title="Loading Officers" description="Fetching organization details..." />;
    }

    if (!statusData || !statusData.orgId) {
        return (
            <div className="p-8 text-center shrink-0 flex flex-col items-center justify-center min-h-[300px]">
                <div className="p-4 rounded-2xl bg-muted/50 text-muted-foreground mb-4">
                    <Building2 className="size-12" />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground">No Organization Found</h1>
                <p className="text-muted-foreground text-sm mt-1">You are not currently part of an organization.</p>
            </div>
        );
    }

    const isAuthorized = statusData.role === "OWNER" || statusData.role === "MANAGER";

    if (!isAuthorized) {
        return (
            <div className="p-8 text-center shrink-0 flex flex-col items-center justify-center min-h-[300px]">
                <div className="p-4 rounded-2xl bg-destructive/10 text-destructive mb-4">
                    <Users className="size-12" />
                </div>
                <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground">Access Denied</h1>
                <p className="text-muted-foreground text-sm mt-1">Only Managers and Owners can access organization management.</p>
            </div>
        );
    }

    return (
        <div className="flex-1 space-y-6 overflow-y-auto bg-background min-h-screen pb-10">
            {/* Premium Sticky Header */}
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm">
                <div className="max-w-7xl mx-auto p-4 md:p-8 py-6">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
                            <Users className="h-5 w-5 md:h-6 md:w-6" />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground uppercase mb-0.5">
                                Officers
                            </h1>
                            <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                                Performance & Activity
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8">
                <OfficerAnalytics orgId={statusData.orgId} isManagement={true} />
            </div>
        </div>
    );
}
