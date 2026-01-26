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
            <div className="p-4 sm:p-8 space-y-8 bg-slate-50/50 min-h-screen">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Wheat className="h-8 w-8 text-primary" />
                        Farmers
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Manage farmers for {org.name}.</p>
                </div>
                <OrgFarmersList orgId={orgId} isAdmin={true} />
            </div>
        </AdminGuard>
    );
}
