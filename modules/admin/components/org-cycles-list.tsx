"use client";


import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Farmer, FarmerHistory } from "@/modules/cycles/types";
import { MobileCycleCard } from "@/modules/cycles/ui/components/cycles/mobile-cycle-card";
import { ActionsCell, HistoryActionsCell } from "@/modules/cycles/ui/components/shared/columns-factory";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bird, ChevronLeft, ChevronRight, Eye, Loader2, RefreshCcw, Search, Skull, Wheat } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useDebounce } from "use-debounce";

// Type for individual cycle items returned from the API
type CycleItem = {
    id: string;
    name: string;
    farmerId: string;
    organizationId: string | null;
    doc: number;
    age: number;
    intake: string | number | null;
    mortality: number;
    status: "active" | "archived" | "deleted";
    createdAt: Date;
    updatedAt: Date;
    farmerName: string;
    farmerMainStock: string | null;
    officerName: string | null;
    endDate: Date | null;
};

// Type for the paginated response from listActive/listPast
type CyclesQueryResult = {
    items: CycleItem[];
    total: number;
    totalPages: number;
};

// --- Sub-components to lighten the main view ---

const StatusBadge = ({ status }: { status: CycleItem["status"] }) => {
    switch (status) {
        case "active":
            return <Badge className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-100 shadow-none font-bold text-[9px] uppercase tracking-wider">Active</Badge>;
        case "deleted":
            return <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 shadow-none font-bold text-[9px] uppercase tracking-wider">Deleted</Badge>;
        default:
            return <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none shadow-none font-bold text-[9px] uppercase tracking-wider">Past</Badge>;
    }
};

const MetricRow = ({ icon: Icon, value, label, valueColor = "text-slate-900" }: { icon: any, value: string | number, label: string, valueColor?: string }) => (
    <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-slate-400" />
        <span className={`text-sm font-bold ${valueColor}`}>{value}</span>
        <span className="text-[10px] text-slate-400 font-normal lowercase">{label}</span>
    </div>
);

const GroupRowActions = ({ cycle, prefix, isAdmin, isManagement, orgId }: { cycle: CycleItem, prefix: string, isAdmin?: boolean, isManagement?: boolean, orgId: string }) => (
    <div className="col-span-1 text-right flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-primary hover:bg-primary/5" asChild>
            <Link href={isAdmin ? `/admin/organizations/${orgId}/cycles/${cycle.id}` : (isManagement ? `/management/cycles/${cycle.id}` : `/cycles/${cycle.id}`)}>
                <Eye className="h-3.5 w-3.5" />
            </Link>
        </Button>
        {cycle.status === "active" ? (
            <ActionsCell cycle={cycle as unknown as Farmer} prefix={prefix} />
        ) : (
            <HistoryActionsCell history={cycle as unknown as FarmerHistory} />
        )}
    </div>
);


export const OrgCyclesList = ({ orgId, isAdmin, isManagement, useOfficerRouter, status = "active", officerId }: {
    orgId: string;
    isAdmin?: boolean;
    isManagement?: boolean;
    useOfficerRouter?: boolean;
    status?: "active" | "past" | "deleted";
    officerId?: string;
}) => {
    const trpc = useTRPC();
    const [viewMode, setViewMode] = useState<"group" | "list">("group");
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 300);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [sortBy, setSortBy] = useState<"name" | "age" | "createdAt" | undefined>(undefined);
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

    // Reset to page 1 when search or status changes
    useEffect(() => {
        setPage(1);
    }, [debouncedSearch, status, officerId]);

    const prefix = isAdmin
        ? `/admin/organizations/${orgId}`
        : isManagement
            ? `/management`
            : ``;

    // Get queryOptions inline to avoid union type callable error
    const queryInput = {
        orgId,
        search: debouncedSearch,
        page,
        pageSize,
        sortBy,
        sortOrder,
        officerId
    };

    const getQueryOptions = () => {
        if (status === "active") {
            if (useOfficerRouter) {
                return trpc.officer.cycles.listActive.queryOptions(queryInput);
            }
            return trpc.management.cycles.listActive.queryOptions(queryInput);
        }

        const historyInput = {
            ...queryInput,
            status: status === "deleted" ? "deleted" as const : "archived" as const
        };

        if (useOfficerRouter) {
            return trpc.officer.cycles.listPast.queryOptions(historyInput as any);
        }
        return (isAdmin ? trpc.admin.cycles.listPast : trpc.management.cycles.listPast).queryOptions(historyInput as any);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawData, isPending } = useQuery({
        ...(getQueryOptions() as any),
    });

    // Cast to proper type for TypeScript
    const data = rawData as CyclesQueryResult | undefined;

    // Extract items from the paginated response
    const cycles = data?.items || [];

    // Group by farmer
    const groupedCycles = cycles.reduce((acc, cycle) => {
        if (!acc[cycle.farmerId]) {
            acc[cycle.farmerId] = {
                farmerId: cycle.farmerId,
                farmerName: cycle.farmerName,
                cycles: []
            };
        }
        acc[cycle.farmerId].cycles.push(cycle);
        return acc;
    }, {} as Record<string, { farmerId: string, farmerName: string, cycles: typeof cycles }>);

    const sortedGroups = Object.values(groupedCycles).sort((a, b) => a.farmerName.localeCompare(b.farmerName));

    // Handle single view mode (flat list) or grouped mode.
    // If not management, we likely just show flat list or if grouped is disabled.
    // For this request, we force grouped view for Management, but maybe keep flat for Admin overview?
    // Actually, Admin overview (OrgCyclesList) likely benefits from grouping too if listing ALL cycles.
    // But let's check user request: "management cycles/page.tsx".
    // We can conditionally render based on `isManagement` but consistent UI is also good.
    // Let's implement grouping as the primary view for this component now since it's cleaner.

    return (
        <div className="flex flex-col h-full bg-slate-50/30">
            <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/50 pb-4 pt-4 px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center max-w-7xl mx-auto w-full">
                    <div className="relative flex-1 w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search by farmer, officer or cycle..."
                            className="pl-10 h-10 bg-slate-100/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all placeholder:text-slate-400 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center bg-slate-200/50 p-1 rounded-xl w-fit">
                        <button
                            onClick={() => setViewMode("group")}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === "group" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            Group
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${viewMode === "list" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                        >
                            Detailed
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-6 max-w-7xl min-h-[500px] mx-auto w-full">
                {isPending ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                        <span className="text-xs font-bold tracking-widest text-slate-400 uppercase">Updating Data...</span>
                    </div>
                ) : cycles.length === 0 ? (
                    <div className="text-center p-12 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm">
                        <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="h-5 w-5 text-slate-300" />
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mb-1">No cycles found</h3>
                        <p className="text-xs">{search ? "Try adjusting your search terms." : "There are currently no production cycles to display."}</p>
                    </div>
                ) : viewMode === "group" ? (
                    <div className="space-y-6">
                        {sortedGroups.map((group) => (
                            <div key={group.farmerId} className="bg-white rounded-2xl border border-slate-200 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] overflow-hidden transition-all hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
                                <div className="px-6 py-4 bg-slate-50/30 border-b border-slate-100 flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <Link
                                            href={isAdmin ? `/admin/organizations/${orgId}/farmers/${group.farmerId}` : (isManagement ? `/management/farmers/${group.farmerId}` : `/farmers/${group.farmerId}`)}
                                            className="font-bold text-slate-900 hover:text-primary transition-colors flex items-center group/title"
                                        >
                                            {group.farmerName}
                                            <span className="mx-2 text-slate-300 font-light opacity-50">|</span>
                                            <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight bg-indigo-50 px-2.5 py-1 rounded-lg">
                                                {group.cycles.length} Cycle{group.cycles.length !== 1 ? 's' : ''}
                                            </span>
                                        </Link>
                                        {group.cycles[0]?.officerName && (
                                            <span className="text-[10px] font-medium text-slate-400 mt-1">
                                                Managed by {group.cycles[0].officerName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="divide-y divide-slate-50">
                                    <div className="hidden md:grid grid-cols-10 gap-4 px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-50/10">
                                        <div className="col-span-2">Growth</div>
                                        <div className="col-span-3">Status & Health</div>
                                        <div className="col-span-2">Consumption</div>
                                        <div className="col-span-2">Timeline</div>
                                        <div className="col-span-1 text-right">Actions</div>
                                    </div>

                                    {group.cycles.map((cycle) => (
                                        <div key={cycle.id} className="group hover:bg-slate-50/50 transition-colors">
                                            <div className="hidden md:grid grid-cols-10 gap-4 px-6 py-4 items-center">
                                                <div className="col-span-2">
                                                    <MetricRow icon={RefreshCcw} value={cycle.age} label={cycle.age > 1 ? "days" : "day"} />
                                                </div>
                                                <div className="col-span-3">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-4">
                                                            <MetricRow icon={Bird} value={cycle.doc.toLocaleString()} label="birds" />
                                                            <StatusBadge status={cycle.status} />
                                                        </div>
                                                        {cycle.mortality > 0 && (
                                                            <div className="flex items-center gap-1.5 text-[10px] text-red-500 font-bold bg-red-50/50 w-fit px-2 py-0.5 rounded-full border border-red-100/30">
                                                                <Skull className="h-3 w-3" />
                                                                {cycle.mortality} deaths
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    <MetricRow icon={Wheat} value={Number(cycle.intake || 0).toFixed(2)} label="bags" valueColor="text-amber-700" />
                                                </div>
                                                <div className="col-span-2">
                                                    <div className="text-[11px] font-medium text-slate-500 flex items-center gap-2">
                                                        <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                        {format(new Date(cycle.createdAt), "MMM d, yyyy")}
                                                    </div>
                                                </div>
                                                <GroupRowActions cycle={cycle} prefix={prefix} isAdmin={isAdmin} isManagement={isManagement} orgId={orgId} />
                                            </div>

                                            <MobileCycleCard
                                                cycle={cycle}
                                                prefix={prefix}
                                                variant="flat"
                                                showName={false}
                                                className="md:hidden"
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader className="bg-slate-50/50">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 h-auto">Farmer</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 h-auto">Status</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 h-auto text-center">Age</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 h-auto">Stocks & Health</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-slate-400 py-4 h-auto text-right">Started</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cycles.map((cycle) => (
                                        <TableRow key={cycle.id} className="hover:bg-slate-50/50 group transition-colors border-slate-50">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <Link href={isAdmin ? `/admin/organizations/${orgId}/farmers/${cycle.farmerId}` : (isManagement ? `/management/farmers/${cycle.farmerId}` : `/farmers/${cycle.farmerId}`)} className="font-bold text-slate-900 group-hover:text-primary transition-colors text-sm">
                                                        {cycle.farmerName}
                                                    </Link>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                                                            {cycle.name}
                                                        </span>
                                                        {cycle.officerName && (
                                                            <>
                                                                <span className="text-[10px] text-slate-300">•</span>
                                                                <span className="text-[10px] text-slate-400 font-medium">
                                                                    {cycle.officerName}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <StatusBadge status={cycle.status} />
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <span className="text-sm font-bold text-slate-700">{cycle.age}</span>
                                                <span className="text-[9px] text-slate-400 ml-1 font-medium lowercase">d</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-4">
                                                        <MetricRow icon={Bird} value={cycle.doc.toLocaleString()} label="birds" />
                                                        <MetricRow icon={Wheat} value={Number(cycle.intake || 0).toFixed(1)} label="bags" valueColor="text-amber-700" />
                                                    </div>
                                                    {cycle.mortality > 0 && (
                                                        <div className="flex items-center gap-1.5 text-[9px] text-red-500 font-bold bg-red-50/30 w-fit px-1.5 py-0.5 rounded-full border border-red-100/20">
                                                            <Skull className="h-2.5 w-2.5" />
                                                            {cycle.mortality} deaths
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-[11px] font-medium text-slate-400">
                                                {format(new Date(cycle.createdAt), "MMM d, y") === format(new Date(), "MMM d, y") ? "Today" : format(new Date(cycle.createdAt), "MMM d, y")}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1 opacity-10 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5" asChild>
                                                        <Link href={isAdmin ? `/admin/organizations/${orgId}/cycles/${cycle.id}` : (isManagement ? `/management/cycles/${cycle.id}` : `/cycles/${cycle.id}`)}>
                                                            <Eye className="h-4 w-4" />
                                                        </Link>
                                                    </Button>
                                                    {cycle.status === "active" ? (
                                                        <ActionsCell cycle={cycle as unknown as Farmer} prefix={prefix} />
                                                    ) : (
                                                        <HistoryActionsCell history={cycle as unknown as FarmerHistory} />
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="md:hidden divide-y divide-slate-100">
                            {cycles.map((cycle) => (
                                <MobileCycleCard
                                    key={cycle.id}
                                    cycle={cycle}
                                    prefix={isAdmin ? `/admin/organizations/${orgId}` : (isManagement ? `/management` : "")}
                                    variant="flat"
                                />
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {data && data.totalPages > 1 && (
                <div className="sticky bottom-0 z-30 bg-white/80 backdrop-blur-md border-t border-slate-200/50 py-4 px-4 sm:px-6">
                    <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
                        <p className="text-xs font-medium text-slate-500">
                            Page <span className="text-slate-900">{page}</span> of <span className="text-slate-900">{data.totalPages}</span>
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setPage(p => Math.max(1, p - 1));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                disabled={page === 1}
                                className="h-8 text-xs font-bold hover:bg-slate-100"
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setPage(p => Math.min(data.totalPages, p + 1));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                disabled={page === data.totalPages}
                                className="h-8 text-xs font-bold hover:bg-slate-100"
                            >
                                Next <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
