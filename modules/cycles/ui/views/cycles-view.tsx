"use client";

import ErrorState from "@/components/error-state";
import LoadingState from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { SortingState } from "@tanstack/react-table";
import { PlusIcon, RefreshCw, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

// 👇 Assuming you have similar hooks/components for Cycles
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useCyclesFilters } from "../../hooks/use-cycles-filters";
import { CreateCycleModal } from "../components/cycles/create-cycle-modal";
import { DataTable } from "../components/data-table";

import { MobileCycleCard } from "../components/cycles/mobile-cycle-card";
import { getCycleColumns } from "../components/shared/columns-factory";


const CyclesContent = () => {
    // 1. Hook State (mirrors useFarmersFilters)
    const [filters, setFilters] = useCyclesFilters();
    const [sorting, setSorting] = useState<SortingState>([]);
    const [isCreateOpen, setIsCreateOpen] = useState(false);

    // 2. Local state for immediate input feedback
    const [searchTerm, setSearchTerm] = useState(filters.search || "");

    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { orgId } = useCurrentOrg()
    // 3. Debounce Effect
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (searchTerm !== filters.search) {
                setFilters({
                    search: searchTerm,
                    page: 1
                });
            }
        }, 300);

        return () => clearTimeout(timeoutId);
    }, [searchTerm, filters.search, setFilters]);

    // 4. Query with placeholderData
    const { data, isLoading, isError, isFetching, refetch } = useQuery({
        ...trpc.officer.cycles.listActive.queryOptions({
            ...filters, // Keep filters spread for pagination/search
            orgId: orgId!,
            // status: "active", // Implied by procedure
            sortOrder: sorting[0]?.desc ? "desc" : "asc"
        }),
        placeholderData: keepPreviousData,
    });

    // 5. Manual Refresh Handler (Replaces specific Sync mutation if not needed)
    const handleRefresh = async () => {
        await queryClient.invalidateQueries(trpc.officer.cycles.listActive.queryOptions({ orgId: orgId! }));
        await refetch();
        toast.success("Cycles refreshed");
    };

    // Initial Loading State
    if (isLoading) {
        return <LoadingState title="Loading" description="Loading cycles..." />;
    }

    // Error State
    if (!data) {
        return <ErrorState title="Error" description="Failed to load cycles" />;
    }

    return (
        <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4 bg-white pt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-2xl font-bold tracking-tight">Active Cycles</h1>

                <div className="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
                    {/* Search Input Container */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search cycle or farmer..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-8 pr-8"
                        />
                        {/* Clear Button */}
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm("")}
                                className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground focus:outline-none"
                                aria-label="Clear search"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button
                            variant="outline"
                            className="flex-1 sm:flex-none"
                            onClick={handleRefresh}
                            disabled={isFetching}
                        >
                            <RefreshCw className={`mr-2 size-4 ${isFetching ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>

                        <Button className="flex-1 sm:flex-none" onClick={() => setIsCreateOpen(true)}>
                            <PlusIcon className="mr-2 size-4" />
                            Start Cycle
                        </Button>
                    </div>
                </div>
            </div>

            {/* Table Area - Desktop */}
            <div className={`hidden sm:block transition-opacity duration-200 ${isFetching ? "opacity-60" : "opacity-100"}`}>
                <DataTable
                    data={data.items}
                    columns={getCycleColumns({ enableActions: true })}
                    sorting={sorting}
                    onSortingChange={setSorting}
                />
            </div>

            {/* Card Area - Mobile */}
            <div className={`sm:hidden space-y-3 transition-opacity duration-200 ${isFetching ? "opacity-60" : "opacity-100"}`}>
                {data.items.length > 0 ? (
                    data.items.map((cycle) => (
                        <MobileCycleCard key={cycle.id} cycle={cycle} />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                        <div className="bg-white p-3 rounded-full shadow-sm mb-2">
                            <Search className="h-6 w-6 opacity-20" />
                        </div>
                        <p className="text-sm font-medium italic">No active cycles found</p>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ page: Math.max(1, filters.page - 1) })}
                    disabled={filters.page === 1 || isFetching}
                >
                    Previous
                </Button>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ page: filters.page + 1 })}
                    disabled={filters.page >= data.totalPages || isFetching}
                >
                    Next
                </Button>
            </div>

            <CreateCycleModal open={isCreateOpen} onOpenChange={setIsCreateOpen} />
        </div>
    );
};

export const CyclesView = () => {
    return <CyclesContent />;
}