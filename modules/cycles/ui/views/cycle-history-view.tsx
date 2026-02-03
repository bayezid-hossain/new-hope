"use client";

import { Input } from "@/components/ui/input";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { useTRPC } from "@/trpc/client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { useDebounce } from "use-debounce";
import { FarmerHistory } from "../../types";
import { MobileCycleCard } from "../components/cycles/mobile-cycle-card";
import { getHistoryColumns } from "../components/shared/columns-factory";


export const CycleHistoryView = ({ activeCycleId }: { activeCycleId?: string }) => {
    const { orgId } = useCurrentOrg();
    const trpc = useTRPC();
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 300);

    const { data, isLoading, isError } = useQuery({
        ...trpc.officer.cycles.listPast.queryOptions({
            orgId: orgId!,
            search: debouncedSearch,
            pageSize: 50,
        }),
        placeholderData: keepPreviousData
    });

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
                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search farmer name..."
                        className="pl-9 bg-muted/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground/50 text-sm"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className={`hidden sm:block rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden`}>
                <div className="max-h-[600px] overflow-y-auto">
                    <DataTable
                        columns={getHistoryColumns({ enableActions: true, currentId: activeCycleId })}
                        data={(data?.items || []) as unknown as FarmerHistory[]}
                    />
                </div>
            </div>

            <div className="sm:hidden space-y-3">
                {data?.items.length ? (
                    data.items.map((cycle: any) => (
                        <MobileCycleCard key={cycle.id} cycle={cycle} />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground font-medium italic">
                        No history found
                    </div>
                )}
            </div>
        </div>
    );
};