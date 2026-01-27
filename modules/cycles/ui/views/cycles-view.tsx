'use client';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { OrgCyclesList } from "@/modules/admin/components/org-cycles-list";
import { Bird, History, PlusIcon } from "lucide-react";
import { useState } from "react";
import { CreateCycleModal } from "../components/cycles/create-cycle-modal";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

const CyclesContent = () => {
    const { orgId } = useCurrentOrg();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const trpc = useTRPC();

    const { data: activeCount } = useQuery(trpc.officer.cycles.listActive.queryOptions({
        orgId: orgId || "",
        pageSize: 1, // Minimize payload, we just want the total
    }));

    const { data: pastCount } = useQuery(trpc.officer.cycles.listPast.queryOptions({
        orgId: orgId || "",
        pageSize: 1,
    }));

    if (!orgId) return null;

    return (
        <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-slate-50/50 min-h-screen">
            <Tabs defaultValue="active" className="w-full">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                            <Bird className="h-8 w-8 text-primary" />
                            Production Cycles
                        </h1>
                        <p className="text-slate-500 text-sm mt-1">Manage all your production cycles.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button onClick={() => setIsCreateOpen(true)}>
                            <PlusIcon className="mr-2 size-4" />
                            Start Cycle
                        </Button>
                    </div>
                </div>
                <TabsList className="bg-slate-100 p-1 h-11">
                    <TabsTrigger value="active" className="px-6 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold text-xs flex items-center gap-2">
                        Active Cycles
                        {activeCount?.total !== undefined && (
                            <span className="ml-1 bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full text-[10px] min-w-[20px] text-center">
                                {activeCount.total}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="past" className="px-6 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold text-xs flex items-center gap-2">
                        <History className="h-3.5 w-3.5" />
                        History
                        {pastCount?.total !== undefined && (
                            <span className="ml-1 bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full text-[10px] min-w-[20px] text-center">
                                {pastCount.total}
                            </span>
                        )}
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="active" className="mt-0 outline-none">
                    <OrgCyclesList orgId={orgId} useOfficerRouter={true} status="active" />
                </TabsContent>

                <TabsContent value="past" className="mt-0 outline-none">
                    <OrgCyclesList orgId={orgId} useOfficerRouter={true} status="past" />
                </TabsContent>
            </Tabs>

            <CreateCycleModal open={isCreateOpen} onOpenChange={setIsCreateOpen} onlyMine={true} />
        </div>
    );
};

export const CyclesView = () => {
    return <CyclesContent />;
}