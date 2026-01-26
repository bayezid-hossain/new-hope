"use client";

import { useCurrentOrg } from "@/hooks/use-current-org";
import { OrgCyclesList } from "@/modules/admin/components/org-cycles-list";
import { Bird } from "lucide-react";

export default function ManagementCyclesPage() {
    const { orgId } = useCurrentOrg();

    if (!orgId) return null;

    return (
        <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-slate-50/50 min-h-screen">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Bird className="h-8 w-8 text-primary" />
                        Active Cycles
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Monitor all active production cycles across the organization.</p>
                </div>
            </div>

            <OrgCyclesList orgId={orgId} isManagement={true} />
        </div>
    );
}
