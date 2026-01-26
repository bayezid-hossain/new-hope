'use client';
import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { OrgCyclesList } from "@/modules/admin/components/org-cycles-list";
import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { CreateCycleModal } from "../components/cycles/create-cycle-modal";

const CyclesContent = () => {
    const { orgId } = useCurrentOrg();
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    if (!orgId) return null;

    return (
        <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-slate-50/50 min-h-screen">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900">Active Cycles</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage all your active production cycles.</p>
                </div>
                <Button onClick={() => setIsCreateOpen(true)}>
                    <PlusIcon className="mr-2 size-4" />
                    Start Cycle
                </Button>
            </div>

            <OrgCyclesList
                orgId={orgId}
                useOfficerRouter={true}
            />

            <CreateCycleModal open={isCreateOpen} onOpenChange={setIsCreateOpen} onlyMine={true} />
        </div>
    );
};

export const CyclesView = () => {
    return <CyclesContent />;
}