"use client";

import LoadingState from "@/components/loading-state";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { OrgCyclesList } from "@/modules/admin/components/org-cycles-list";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Bird } from "lucide-react";
import { useParams } from "next/navigation";

export default function AdminOrgCyclesPage() {
    const params = useParams();
    const orgId = params.id as string;
    const trpc = useTRPC();

    const { data: orgs, isPending } = useQuery(trpc.admin.getAllOrgs.queryOptions());
    const org = orgs?.find(o => o.id === orgId);

    if (isPending) return <LoadingState title="Loading Cycles" description="Fetching organization data..." />;
    if (!org) return <div>Organization not found</div>;

    return (
        <AdminGuard>
            <div className="p-4 sm:p-8 space-y-8 bg-slate-50/50 min-h-screen">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Bird className="h-8 w-8 text-primary" />
                        Active Cycles
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Monitor active production cycles for {org.name}.</p>
                </div>
                <OrgCyclesList orgId={orgId} isAdmin={true} />
            </div>
        </AdminGuard>
    );
}
