"use client";

import LoadingState from "@/components/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembersList } from "@/modules/admin/components/members-list";
import { OfficerAnalytics } from "@/modules/admin/components/officer-analytics";
import { OrgCyclesList } from "@/modules/admin/components/org-cycles-list";
import { OrgFarmersList } from "@/modules/admin/components/org-farmers-list";
import { ProductionTree } from "@/modules/admin/components/production-tree";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bird, Building2, Scale, Users, Wheat } from "lucide-react";

export default function ManagementPage() {
    const trpc = useTRPC();

    // Fetch user's organization status to get the orgId
    const { data: statusData, isPending } = useQuery(
        trpc.organization.getMyStatus.queryOptions()
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

    return (
        <div className="p-4 sm:p-8 space-y-8 bg-slate-50/50 min-h-screen">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                    <Building2 className="h-8 w-8 text-primary" />
                    Organization Management
                </h1>
                <p className="text-slate-500 text-sm">Oversee {statusData.orgName}'s personnel and production.</p>
            </div>

            <ManagementStats orgId={statusData.orgId} />

            <Tabs defaultValue="members" className="space-y-6">
                <div className="overflow-x-auto pb-2 scrollbar-hide">
                    <TabsList className="inline-flex w-auto bg-white border shadow-sm p-1 rounded-xl h-auto">
                        <TabsTrigger value="members" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold">
                            <Users className="h-4 w-4" />
                            Members
                        </TabsTrigger>
                        <TabsTrigger value="officers" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold">
                            <Activity className="h-4 w-4" />
                            Officer Insights
                        </TabsTrigger>
                        <TabsTrigger value="farmers" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold">
                            <Wheat className="h-4 w-4" />
                            Farmers
                        </TabsTrigger>
                        <TabsTrigger value="production" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold">
                            <Scale className="h-4 w-4" />
                            Production Tree
                        </TabsTrigger>
                        <TabsTrigger value="cycles" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold">
                            <Bird className="h-4 w-4" />
                            Active Cycles
                        </TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="members" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900">Registered Members</h2>
                    </div>
                    <MembersList orgId={statusData.orgId} />
                </TabsContent>

                <TabsContent value="officers" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900">Officer Performance</h2>
                    </div>
                    <OfficerAnalytics orgId={statusData.orgId} isManagement={true} />
                </TabsContent>

                <TabsContent value="farmers" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900">Farmer Network</h2>
                    </div>
                    <OrgFarmersList orgId={statusData.orgId} isManagement={true} />
                </TabsContent>

                <TabsContent value="production" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900">Production Hierarchy</h2>
                    </div>
                    <ProductionTree orgId={statusData.orgId} isManagement={true} />
                </TabsContent>

                <TabsContent value="cycles" className="space-y-4 focus-visible:outline-none focus-visible:ring-0">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-900">Current Production</h2>
                    </div>
                    <OrgCyclesList orgId={statusData.orgId} isManagement={true} />
                </TabsContent>
            </Tabs>
        </div>
    );
}

function ManagementStats({ orgId }: { orgId: string }) {
    const trpc = useTRPC();
    const { data: stats, isPending } = useQuery(trpc.organization.getOrgStats.queryOptions({ orgId }));

    if (isPending) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-32 animate-pulse bg-slate-100 rounded-xl" />;

    const items = [
        { label: "Members", value: stats?.members, icon: Users, gradient: "from-blue-500 to-indigo-600", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
        { label: "Farmers", value: stats?.farmers, icon: Wheat, gradient: "from-amber-400 to-orange-500", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
        { label: "Active Cycles", value: stats?.activeCycles, icon: Activity, gradient: "from-violet-500 to-purple-600", iconBg: "bg-violet-100", iconColor: "text-violet-600" },
    ];

    return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
                <Card key={item.label} className="border-none shadow-sm overflow-hidden relative group">
                    <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${item.gradient}`} />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">{item.label}</CardTitle>
                        <div className={`p-2 rounded-lg ${item.iconBg} ${item.iconColor} group-hover:scale-110 transition-transform`}>
                            <item.icon className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight">{item.value?.toLocaleString() || 0}</div>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold tracking-wider">Organization Total</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
