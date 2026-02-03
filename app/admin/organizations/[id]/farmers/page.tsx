"use client";

import LoadingState from "@/components/loading-state";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { OrgFarmersList } from "@/modules/admin/components/org-farmers-list";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Wheat } from "lucide-react";
import { useParams } from "next/navigation";

export default function AdminOrgFarmersPage() {
    const params = useParams();
    const orgId = params.id as string;
    const trpc = useTRPC();

    const { data: orgs, isPending } = useQuery(trpc.admin.organizations.getAll.queryOptions());
    const org = orgs?.find(o => o.id === orgId);

    if (isPending) return <LoadingState title="Loading Farmers" description="Fetching organization data..." />;
    if (!org) return <div>Organization not found</div>;

    return (
        <AdminGuard>
            <div className="w-full space-y-6 bg-background min-h-screen">
                <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm">
                    <div className="max-w-7xl mx-auto p-4 md:p-8 py-6">
                        <div className="flex flex-col gap-1">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                                <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                                    <Wheat className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                                </div>
                                Farmers
                            </h1>
                            <p className="text-muted-foreground text-sm font-medium italic mt-1 ml-1">
                                Manage farmers for {org.name}.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto p-4 md:p-8 pt-0">
                    <OrgFarmersList orgId={orgId} isAdmin={true} />
                </div>
            </div>
        </AdminGuard>
    );
}
