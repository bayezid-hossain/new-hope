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
import { Bird, ChevronLeft, ChevronRight, Eye, LayoutGrid, Loader2, RefreshCcw, Search, Skull, Table as TableIcon, Wheat } from "lucide-react";
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
    birdsSold: number;
    age: number;
    intake: string | number | null;
    mortality: number;
    status: "active" | "archived" | "deleted";
    createdAt: Date;
    updatedAt: Date;
    farmerName: string;
    farmerLocation?: string | null;
    farmerMobile?: string | null;
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
            return null;
        case "deleted":
            return <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/10 shadow-none font-bold text-[9px] uppercase tracking-wider">Deleted</Badge>;
        default:
            return <Badge variant="secondary" className="bg-muted text-muted-foreground border-none shadow-none font-bold text-[9px] uppercase tracking-wider">Past</Badge>;
    }
};

const MetricRow = ({ icon: Icon, value, label, valueColor = "text-foreground" }: { icon: any, value: string | number, label: string, valueColor?: string }) => (
    <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 text-muted-foreground/50" />
        <span className={`text-sm font-bold ${valueColor}`}>{value}</span>
        <span className="text-[10px] text-muted-foreground font-normal lowercase">{label}</span>
    </div>
);

const GroupRowActions = ({ cycle, prefix, isAdmin, isManagement, orgId }: { cycle: CycleItem, prefix: string, isAdmin?: boolean, isManagement?: boolean, orgId: string }) => (
    <div className="col-span-1 text-right flex items-center justify-end gap-1 transition-opacity">
        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground/50 hover:text-primary hover:bg-primary/5" asChild>
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
    const [viewMode, setViewMode] = useState<"group" | "list">("list");
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
        <div className="flex flex-col h-full bg-background">
            <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/50 pb-4 pt-4 px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center max-w-7xl mx-auto w-full">
                    <div className="relative flex-1 w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search by farmer, officer or cycle..."
                            className="pl-10 h-9 sm:h-10 bg-muted/50 border-none shadow-none focus-visible:ring-1 focus-visible:ring-primary/20 transition-all placeholder:text-muted-foreground/50 text-xs sm:text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center bg-muted p-1 rounded-xl w-fit gap-x-2">
                        <Button
                            onClick={() => setViewMode("list")}
                            variant={viewMode === "list" ? "default" : "outline"}
                            size="sm"
                            className="h-8 px-2 text-[10px] xs:h-9 xs:px-3 xs:text-xs sm:h-10 sm:px-4 sm:text-sm shadow-sm transition-all"
                        >
                            <TableIcon className="mr-1.5 h-3 w-3 xs:h-3.5 xs:w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> Detailed
                        </Button>
                        <Button
                            onClick={() => setViewMode("group")}
                            variant={viewMode === "group" ? "default" : "outline"}
                            size="sm"
                            className="h-8 px-2 text-[10px] xs:h-9 xs:px-3 xs:text-xs sm:h-10 sm:px-4 sm:text-sm shadow-sm transition-all"
                        >
                            <LayoutGrid className="mr-1.5 h-3 w-3 xs:h-3.5 xs:w-3.5 sm:mr-2 sm:h-4 sm:w-4" /> Group
                        </Button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-1 sm:p-6 max-w-7xl min-h-[500px] mx-auto w-full">
                {isPending ? (
                    <div className="flex flex-col items-center justify-center p-20 gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                        <span className="text-xs font-bold tracking-widest text-muted-foreground/50 uppercase">Updating Data...</span>
                    </div>
                ) : cycles.length === 0 ? (
                    <div className="text-center p-12 text-muted-foreground bg-card rounded-2xl border border-dashed border-border shadow-sm">
                        <div className="bg-muted w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Search className="h-5 w-5 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground mb-1">No cycles found</h3>
                        <p className="text-xs">{search ? "Try adjusting your search terms." : "There are currently no production cycles to display."}</p>
                    </div>
                ) : viewMode === "group" ? (
                    <div className="space-y-6">
                        {sortedGroups.map((group) => (
                            <div key={group.farmerId} className="bg-card rounded-2xl border border-border shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] overflow-hidden transition-all hover:shadow-[0_8px_20px_-6px_rgba(0,0,0,0.08)]">
                                <div className="px-6 py-4 bg-muted/30 border-b border-border/50 flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <Link
                                            href={isAdmin ? `/admin/organizations/${orgId}/farmers/${group.farmerId}` : (isManagement ? `/management/farmers/${group.farmerId}` : `/farmers/${group.farmerId}`)}
                                            className="font-bold text-foreground hover:text-primary transition-colors flex items-center group/title"
                                        >
                                            {group.farmerName}
                                            <span className="mx-2 text-muted-foreground/30 font-light opacity-50">|</span>
                                            <span className="text-[10px] font-bold text-primary uppercase tracking-tight bg-primary/10 px-2.5 py-1 rounded-lg">
                                                {group.cycles.length} Cycle{group.cycles.length !== 1 ? 's' : ''}
                                            </span>
                                        </Link>
                                        {group.cycles[0]?.officerName && (
                                            <span className="text-[10px] font-medium text-muted-foreground/70 mt-1">
                                                Managed by {group.cycles[0].officerName}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="divide-y divide-border/50">
                                    <div className="hidden md:grid grid-cols-10 gap-4 px-6 py-2.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/10">
                                        <div className="col-span-2">Growth</div>
                                        <div className="col-span-3">Status & Health</div>
                                        <div className="col-span-2">Consumption</div>
                                        <div className="col-span-2">Timeline</div>
                                        <div className="col-span-1 text-right">Actions</div>
                                    </div>

                                    {group.cycles.map((cycle) => (
                                        <div key={cycle.id} className="group hover:bg-muted/30 transition-colors">
                                            <div className="hidden md:grid grid-cols-10 gap-4 px-6 py-4 items-center">
                                                <div className="col-span-2">
                                                    <MetricRow icon={RefreshCcw} value={cycle.age} label={cycle.age > 1 ? "days" : "day"} />
                                                </div>
                                                <div className="col-span-3">
                                                    <div className="flex flex-col gap-1.5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="flex flex-col">
                                                                {cycle.status === "active" ? (
                                                                    <>
                                                                        <MetricRow
                                                                            icon={Bird}
                                                                            value={(Number(cycle.doc || 0)).toLocaleString()}
                                                                            label="initial"
                                                                            valueColor="text-foreground"
                                                                        />
                                                                        <span className="text-[8px] text-muted-foreground ml-4.5 -mt-0.5">live: {(Number(cycle.doc || 0) - Number(cycle.mortality || 0) - Number(cycle.birdsSold || 0)).toLocaleString()}</span>
                                                                    </>
                                                                ) : (
                                                                    <MetricRow
                                                                        icon={Bird}
                                                                        value={(Number(cycle.doc || 0)).toLocaleString()}
                                                                        label="initial"
                                                                        valueColor="text-muted-foreground"
                                                                    />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <StatusBadge status={cycle.status} />
                                                                {cycle.birdsSold > 0 && (
                                                                    <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-bold text-[8px] h-3.5 px-1 uppercase tracking-tighter w-fit">{cycle.birdsSold} Sold</Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {cycle.mortality > 0 && (
                                                            <div className="flex items-center gap-1.5 text-[10px] text-destructive font-bold bg-destructive/10 w-fit px-2 py-0.5 rounded-full border border-destructive/20">
                                                                <Skull className="h-3 w-3" />
                                                                {cycle.mortality} deaths
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="col-span-2">
                                                    <MetricRow icon={Wheat} value={Number(cycle.intake || 0).toFixed(2)} label="bags" valueColor="text-primary" />
                                                </div>
                                                <div className="col-span-2">
                                                    <div className="text-[11px] font-medium text-muted-foreground/70 flex items-center gap-2">
                                                        <div className="w-1 h-1 rounded-full bg-border" />
                                                        {format(new Date(cycle.createdAt), "dd/MM/yyyy")}
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
                    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                        <div className="hidden md:block">
                            <Table>
                                <TableHeader className="bg-muted/50">
                                    <TableRow className="hover:bg-transparent border-none">
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4 h-auto">Farmer</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4 h-auto">Status</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4 h-auto text-center">Age</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4 h-auto">Stocks & Health</TableHead>
                                        <TableHead className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground py-4 h-auto text-right">Started</TableHead>
                                        <TableHead className="w-[80px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cycles.map((cycle) => (
                                        <TableRow key={cycle.id} className="hover:bg-muted/30 group transition-colors border-border/50">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <Link href={isAdmin ? `/admin/organizations/${orgId}/farmers/${cycle.farmerId}` : (isManagement ? `/management/farmers/${cycle.farmerId}` : `/farmers/${cycle.farmerId}`)} className="font-bold text-foreground group-hover:text-primary transition-colors text-sm">
                                                        {cycle.farmerName}
                                                    </Link>
                                                    <div className="flex items-center gap-1.5 mt-0.5">
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">
                                                            {cycle.name}
                                                        </span>
                                                        {cycle.officerName && (
                                                            <>
                                                                <span className="text-[10px] text-muted-foreground/30">•</span>
                                                                <span className="text-[10px] text-muted-foreground/70 font-medium">
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
                                                <span className="text-sm font-bold text-foreground">{cycle.age}</span>
                                                <span className="text-[9px] text-muted-foreground ml-1 font-medium lowercase">d</span>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex flex-col">
                                                            <MetricRow
                                                                icon={Bird}
                                                                value={(Number(cycle.doc || 0)).toLocaleString()}
                                                                label="initial"
                                                                valueColor="text-foreground"
                                                            />
                                                            <span className="text-[8px] text-muted-foreground ml-4.5 -mt-0.5 font-medium">live {(Number(cycle.doc || 0) - Number(cycle.mortality || 0) - Number(cycle.birdsSold || 0)).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <MetricRow icon={Wheat} value={Number(cycle.intake || 0).toFixed(1)} label="bags" valueColor="text-primary" />
                                                            {cycle.birdsSold > 0 && (
                                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-bold text-[8px] h-3.5 px-1 uppercase tracking-tighter w-fit">{cycle.birdsSold} Sold</Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {cycle.mortality > 0 && (
                                                        <div className="flex items-center gap-1.5 text-[9px] text-destructive font-bold bg-destructive/10 w-fit px-1.5 py-0.5 rounded-full border border-destructive/20">
                                                            <Skull className="h-2.5 w-2.5" />
                                                            {cycle.mortality} deaths
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right text-[11px] font-medium text-muted-foreground/60">
                                                {format(new Date(cycle.createdAt), "dd/MM/yyyy") === format(new Date(), "dd/MM/yyyy") ? "Today" : format(new Date(cycle.createdAt), "dd/MM/yyyy")}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center justify-end gap-1 transition-opacity">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/5" asChild>
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
                        <div className="md:hidden divide-y divide-border/30">
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
                <div className="sticky bottom-0 z-30 bg-background/80 backdrop-blur-md border-t border-border/50 py-4 px-4 sm:px-6">
                    <div className="flex items-center justify-between max-w-7xl mx-auto w-full">
                        <p className="text-xs font-medium text-muted-foreground">
                            Page <span className="text-foreground font-bold">{page}</span> of <span className="text-foreground font-bold">{data.totalPages}</span>
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
                                className="h-7 sm:h-8 text-[10px] sm:text-xs font-bold hover:bg-muted"
                            >
                                <ChevronLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" /> Previous
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setPage(p => Math.min(data.totalPages, p + 1));
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                disabled={page === data.totalPages}
                                className="h-7 sm:h-8 text-[10px] sm:text-xs font-bold hover:bg-muted"
                            >
                                Next <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
