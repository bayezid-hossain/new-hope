'use client';
import ErrorState from "@/components/error-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
            <div className="flex flex-col min-h-screen bg-background">
                {/* Premium Sticky Header */}
                <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm">
                    <div className="max-w-7xl mx-auto p-4 md:p-8 py-6">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-muted transition-all" asChild>
                                    <Link href="/admin/organizations">
                                        <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                                    </Link>
                                </Button>
                                <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
                                    <Building2 className="h-5 w-5 md:h-6 md:w-6" />
                                </div>
                                <div>
                                    <h1 className="text-xl md:text-2xl font-black tracking-tighter text-foreground uppercase truncate max-w-[200px] sm:max-w-md">
                                        {org.name}
                                    </h1>
                                    <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] opacity-60 font-mono">
                                        {org.slug}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20 px-3 py-1 font-black uppercase tracking-widest text-[10px] rounded-lg">
                                    ACTIVE SYSTEM
                                </Badge>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-8">
                    <OrgOverview org={org} />

                    <div className="space-y-6">
                        <Tabs defaultValue="members" className="w-full space-y-6">
                            <TabsList className="inline-flex h-11 items-center justify-center rounded-xl bg-muted/50 p-1 text-muted-foreground border border-border/50 backdrop-blur-sm">
                                <TabsTrigger value="members" className="rounded-lg px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                                    <Users className="h-3.5 w-3.5 mr-2" />
                                    Members
                                </TabsTrigger>
                                <TabsTrigger value="production" className="rounded-lg px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                                    <Activity className="h-3.5 w-3.5 mr-2" />
                                    Production Tree
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="members" className="mt-0 focus-visible:outline-none">
                                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden p-4 md:p-8">
                                    <MembersList orgId={org.id} />
                                </div>
                            </TabsContent>

                            <TabsContent value="production" className="mt-0 focus-visible:outline-none">
                                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm p-6 overflow-x-auto shadow-sm">
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
                <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group rounded-[2rem]">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 p-5 md:p-6">
                        <span className="text-[10px] md:text-[11px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">Registered Members</span>
                        <div className="p-2.5 rounded-2xl ring-1 ring-border/50 bg-primary/10 text-primary transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
                            <Users className="h-5 w-5 md:h-6 md:w-6" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 md:px-6 pb-5 md:pb-6">
                        <div className="text-3xl md:text-4xl font-black tracking-tighter text-foreground group-hover:translate-x-1 transition-transform">
                            {(org.members || []).length}
                        </div>
                        <p className="mt-2 text-[10px] font-black uppercase text-muted-foreground/40 tracking-widest">Total Active Organization Personnel</p>
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


