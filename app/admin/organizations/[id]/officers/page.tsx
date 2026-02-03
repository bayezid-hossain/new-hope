"use client";

import LoadingState from "@/components/loading-state";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { OfficerAnalytics } from "@/modules/admin/components/officer-analytics";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { useParams } from "next/navigation";

export default function AdminOrgOfficersPage() {
    const params = useParams();
    const orgId = params.id as string;
    const trpc = useTRPC();

    const { data: orgs, isPending } = useQuery(trpc.admin.organizations.getAll.queryOptions());
    const org = orgs?.find(o => o.id === orgId);

    if (isPending) return <LoadingState title="Loading Officers" description="Fetching organization data..." />;
    if (!org) return <div>Organization not found</div>;

    return (
        <AdminGuard>
            <div className="flex flex-col min-h-screen bg-background">
                {/* Premium Page Header */}
                <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-6 sm:px-8">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">{org.name}</span>
                                    <span className="text-muted-foreground/30 text-xs text-[10px]">•</span>
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">System Admin</span>
                                </div>
                                <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase">
                                    Officer Personnel
                                </h1>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8 pb-20">
                    <OfficerAnalytics orgId={orgId} isManagement={false} />
                </div>
            </div>
        </AdminGuard>
    );
}
