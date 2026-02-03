"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { OrgCyclesList } from "@/modules/admin/components/org-cycles-list";
import { ManagementGuard } from "@/modules/management/components/management-guard";
import { Bird, History, Trash2 } from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

export default function ManagementCyclesPage() {
    const { orgId } = useCurrentOrg();
    const trpc = useTRPC();

    const { data: activeCount } = useQuery(trpc.management.cycles.listActive.queryOptions({
        orgId: orgId || "",
        pageSize: 1, // Minimize payload
    }));

    const { data: pastCount } = useQuery(trpc.management.cycles.listPast.queryOptions({
        orgId: orgId || "",
        pageSize: 1,
        status: "archived"
    }));

    const { data: deletedCount } = useQuery(trpc.management.cycles.listPast.queryOptions({
        orgId: orgId || "",
        pageSize: 1,
        status: "deleted"
    }));

    return (
        <ManagementGuard>
            <div className="flex-1 space-y-6 overflow-y-auto bg-background min-h-screen pb-10">
                {/* Premium Sticky Header */}
                <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm">
                    <div className="max-w-7xl mx-auto p-4 md:p-8 py-6">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
                                <Bird className="h-5 w-5 md:h-6 md:w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground uppercase mb-0.5">
                                    Cycles
                                </h1>
                                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                                    Production & History
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 md:px-8">
                    <Tabs defaultValue="active" className="w-full space-y-6">
                        <TabsList className="inline-flex h-11 items-center justify-center rounded-xl bg-muted/50 p-1 text-muted-foreground border border-border/50 backdrop-blur-sm">
                            <TabsTrigger value="active" className="rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2">
                                Active
                                {activeCount?.total !== undefined && (
                                    <span className="bg-violet-500/10 text-violet-500 dark:text-violet-400 px-1.5 py-0.5 rounded-full text-[9px] font-bold min-w-[20px] text-center">
                                        {activeCount.total}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="past" className="rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2">
                                <History className="h-3.5 w-3.5" />
                                History
                                {pastCount?.total !== undefined && (
                                    <span className="bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full text-[9px] font-bold min-w-[20px] text-center">
                                        {pastCount.total}
                                    </span>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="deleted" className="rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2">
                                <Trash2 className="h-3.5 w-3.5" />
                                Deleted
                                {deletedCount?.total !== undefined && (
                                    <span className="bg-destructive/10 text-destructive px-1.5 py-0.5 rounded-full text-[9px] font-bold min-w-[20px] text-center">
                                        {deletedCount.total}
                                    </span>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="active" className="mt-0 outline-none">
                            {orgId && <OrgCyclesList orgId={orgId} isManagement={true} status="active" />}
                        </TabsContent>

                        <TabsContent value="past" className="mt-0 outline-none">
                            {orgId && <OrgCyclesList orgId={orgId} isManagement={true} status="past" />}
                        </TabsContent>

                        <TabsContent value="deleted" className="mt-0 outline-none">
                            {orgId && <OrgCyclesList orgId={orgId} isManagement={true} status="deleted" />}
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </ManagementGuard>
    );
}
