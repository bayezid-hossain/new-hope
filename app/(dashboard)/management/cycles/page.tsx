"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { OrgCyclesList } from "@/modules/admin/components/org-cycles-list";
import { ManagementGuard } from "@/modules/management/components/management-guard";
import { Bird, History } from "lucide-react";

export default function ManagementCyclesPage() {
    const { orgId } = useCurrentOrg();

    return (
        <ManagementGuard>
            <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-slate-50/50 min-h-screen">
                <Tabs defaultValue="active" className="w-full">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                                <Bird className="h-8 w-8 text-primary" />
                                Production Cycles
                            </h1>
                            <p className="text-slate-500 text-sm mt-1">Monitor and manage all production cycles across the organization.</p>
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
                        {orgId && <OrgCyclesList orgId={orgId} isManagement={true} status="active" />}
                    </TabsContent>

                    <TabsContent value="past" className="mt-0 outline-none">
                        {orgId && <OrgCyclesList orgId={orgId} isManagement={true} status="past" />}
                    </TabsContent>
                </Tabs>
            </div>
        </ManagementGuard>
    );
}
