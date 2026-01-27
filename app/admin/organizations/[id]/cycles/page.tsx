"use client";

import LoadingState from "@/components/loading-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { OrgCyclesList } from "@/modules/admin/components/org-cycles-list";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Bird, History } from "lucide-react";
import { useParams } from "next/navigation";

export default function AdminOrgCyclesPage() {
    const params = useParams();
    const orgId = params.id as string;
    const trpc = useTRPC();

    const { data: orgs, isPending } = useQuery(trpc.admin.organizations.getAll.queryOptions());
    const org = orgs?.find(o => o.id === orgId);

    if (isPending) return <LoadingState title="Loading Cycles" description="Fetching organization data..." />;
    if (!org) return <div>Organization not found</div>;

    return (
        <AdminGuard>
            <div className="p-4 sm:p-8 space-y-8 bg-slate-50/50 min-h-screen">
                <Tabs defaultValue="active" className="w-full">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                <Bird className="h-8 w-8 text-primary" />
                                Production Cycles
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">Monitor all production cycles for {org.name}.</p>
                        </div>
                        <TabsList className="bg-slate-100 p-1 h-11">
                            <TabsTrigger value="active" className="px-6 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold text-xs">
                                Active Cycles
                            </TabsTrigger>
                            <TabsTrigger value="past" className="px-6 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold text-xs flex items-center gap-2">
                                <History className="h-3.5 w-3.5" />
                                History
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <TabsContent value="active" className="mt-0 outline-none">
                        <OrgCyclesList orgId={orgId} isAdmin={true} status="active" />
                    </TabsContent>

                    <TabsContent value="past" className="mt-0 outline-none">
                        <OrgCyclesList orgId={orgId} isAdmin={true} status="past" />
                    </TabsContent>
                </Tabs>
            </div>
        </AdminGuard>
    );
}
