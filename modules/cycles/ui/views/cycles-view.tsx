'use client';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { OrgCyclesList } from "@/modules/admin/components/org-cycles-list";
import { Bird, History, PlusIcon, Sparkles } from "lucide-react";
import { useState } from "react";
import { BulkCycleImportModal } from "../components/cycles/bulk-cycle-import-modal";
import { CreateCycleModal } from "../components/cycles/create-cycle-modal";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

const CyclesContent = () => {
    const { orgId } = useCurrentOrg();
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [isBulkOpen, setIsBulkOpen] = useState(false);
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
        <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-background min-h-screen">
            <Tabs defaultValue="active" className="w-full">
                <div className="flex flex-col items-start gap-4 mb-6 xs:justify-between xs:gap-0 xs:gap-y-4">
                    <div>
                        <h1 className="text-xl xs:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Bird className="h-6 w-6 xs:h-8 xs:w-8 text-primary" />
                            Production Cycles
                        </h1>
                        <p className="text-muted-foreground text-xs xs:text-sm mt-1">Manage all your production cycles.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 w-full xs:w-auto xs:flex xs:items-center">
                        <Button
                            onClick={() => setIsCreateOpen(true)}
                            className="h-9 px-3 text-xs xs:h-10 xs:px-4 xs:text-sm shadow-sm w-full xs:w-auto"
                        >
                            <PlusIcon className="mr-1.5 h-3.5 w-3.5 xs:mr-2 xs:h-4 xs:w-4" />
                            Start Cycle
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setIsBulkOpen(true)}
                            className="h-9 px-3 text-xs xs:h-10 xs:px-4 xs:text-sm border-purple-200 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 shadow-sm transition-all w-full xs:w-auto"
                        >
                            <Sparkles className="mr-1.5 h-3.5 w-3.5 xs:mr-2 xs:h-4 xs:w-4 text-purple-500" />
                            Bulk Import
                        </Button>
                    </div>
                </div>
                <TabsList className="bg-muted p-1 h-9 xs:h-11">
                    <TabsTrigger value="active" className="px-3 xs:px-6 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold text-[10px] xs:text-xs flex items-center gap-1 xs:gap-2">
                        Active Cycles
                        {activeCount?.total !== undefined && (
                            <span className="ml-1 bg-primary/20 text-primary px-1.5 py-0.5 rounded-full text-[10px] min-w-[20px] text-center">
                                {activeCount.total}
                            </span>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="past" className="px-3 xs:px-6 data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold text-[10px] xs:text-xs flex items-center gap-1 xs:gap-2">
                        <History className="h-3 w-3 xs:h-3.5 xs:w-3.5" />
                        History
                        {pastCount?.total !== undefined && (
                            <span className="ml-1 bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full text-[10px] min-w-[20px] text-center">
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
            <BulkCycleImportModal open={isBulkOpen} onOpenChange={setIsBulkOpen} orgId={orgId} />
        </div>
    );
};

export const CyclesView = () => {
    return <CyclesContent />;
}
