"use client";

import ErrorState from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { MembersList } from "@/modules/admin/components/members-list";
import { ProductionTree } from "@/modules/admin/components/production-tree";
import { SmartWatchdogWidget } from "@/modules/shared/components/smart-watchdog-widget";
import { SupplyChainWidget } from "@/modules/shared/components/supply-chain-widget";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    ArrowLeft,
    Building2,
    Loader2,
    Users
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

export default function OrganizationDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const trpc = useTRPC();

    const orgId = Array.isArray(params.id) ? params.id[0] : params.id;

    const { data: orgs, isPending } = useQuery(trpc.admin.organizations.getAll.queryOptions());
    const org = orgs?.find(o => o.id === orgId);

    if (isPending) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
                <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
                <p className="text-slate-500 font-medium">Loading organization dashboard...</p>
            </div>
        );
    }

    if (!org) {
        return <ErrorState title="Not Found" description="The requested organization does not exist." />;
    }

    return (
        <AdminGuard>
            <div className="flex flex-col min-h-screen bg-slate-50/50">
                {/* Fixed Header */}
                <div className="sticky top-0 z-10 bg-white border-b shadow-sm px-4 py-4 sm:px-8">
                    <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" className="rounded-full" asChild>
                                <Link href="/admin/organizations">
                                    <ArrowLeft className="h-5 w-5 text-slate-500" />
                                </Link>
                            </Button>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                    <Building2 className="h-6 w-6 text-primary" />
                                    {org.name}
                                </h1>
                                <p className="text-xs text-slate-500 font-mono uppercase tracking-widest">{org.slug}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-100 px-3 py-1 font-bold">
                                ACTIVE SYSTEM
                            </Badge>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
                    <OrgOverview org={org} />

                    <div className="space-y-6">
                        <Tabs defaultValue="members" className="w-full">
                            <div className="flex items-center justify-between">
                                <TabsList className="bg-white border shadow-sm p-1 rounded-xl h-auto">
                                    <TabsTrigger value="members" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-semibold">
                                        <Users className="h-4 w-4" />
                                        Members
                                    </TabsTrigger>
                                    <TabsTrigger value="production" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-semibold">
                                        <Activity className="h-4 w-4" />
                                        Production Tree
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <TabsContent value="members" className="mt-4 focus-visible:outline-none">
                                <Card className="border-none shadow-sm overflow-hidden bg-white">
                                    <CardContent className="p-0 sm:p-6">
                                        <MembersList orgId={org.id} />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="production" className="mt-4 focus-visible:outline-none">
                                <div className="rounded-xl border bg-white p-4">
                                    <ProductionTree orgId={org.id} isAdmin={true} />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div>
        </AdminGuard>
    );
}

function OrgOverview({ org }: { org: any }) {
    return (
        <div className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <Card className="border-none shadow-sm group">
                    <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 rounded-2xl bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-all">
                                <Users className="h-6 w-6" />
                            </div>
                            <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none font-bold">Active Org</Badge>
                        </div>
                        <div className="space-y-1">
                            <p className="text-3xl font-bold text-slate-900">{org.members.length}</p>
                            <p className="text-sm font-medium text-slate-500">Total Registered Members</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <SmartWatchdogWidget orgId={org.id} />
                <SupplyChainWidget orgId={org.id} viewMode="ADMIN" />
            </div>
        </div>
    );
}


