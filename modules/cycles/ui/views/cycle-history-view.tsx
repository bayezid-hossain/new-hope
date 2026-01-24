"use client";

import { useCurrentOrg } from "@/hooks/use-current-org";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { historyColumns } from "@/modules/cycles/ui/components/history/history-columns";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { FarmerHistory } from "../../types";
import { MobileCycleCard } from "../components/cycles/mobile-cycle-card";


export const CycleHistoryView = () => {
    const { orgId } = useCurrentOrg();
    const trpc = useTRPC();

    const { data, isLoading, isError } = useQuery(
        trpc.cycles.getPastCycles.queryOptions({
            orgId: orgId!,
            pageSize: 50,
        })
    );

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    if (isError) {
        return <div className="text-destructive text-center p-8">Failed to load history</div>;
    }

    return (
        <div className="space-y-6 p-4 md:p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Cycle History</h2>
                    <p className="text-muted-foreground">
                        A complete archive of all production cycles across the organization.
                    </p>
                </div>
            </div>

            <div className={`hidden sm:block rounded-xl border bg-card text-card-foreground shadow-sm`}>
                <DataTable
                    columns={historyColumns}
                    data={(data?.items || []) as unknown as FarmerHistory[]}
                />
            </div>

            <div className="sm:hidden space-y-3">
                {data?.items.length ? (
                    data.items.map((cycle: any) => (
                        <MobileCycleCard key={cycle.id} cycle={cycle} />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-medium italic">
                        No history found
                    </div>
                )}
            </div>
        </div>
    );
};