"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Farmer } from "@/modules/cycles/types";
import { ActionsCell } from "@/modules/cycles/ui/components/shared/columns-factory";
import { useTRPC } from "@/trpc/client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, Bird, Eye, Loader2, Search, Skull, Wheat } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDebounce } from "use-debounce";


export const OrgCyclesList = ({ orgId, isAdmin, isManagement, useOfficerRouter }: { orgId: string; isAdmin?: boolean; isManagement?: boolean; useOfficerRouter?: boolean }) => {
    const trpc = useTRPC();
    const [viewMode, setViewMode] = useState<"group" | "list">("group");
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 300);

    // Determine which router to use
    const procedure = useOfficerRouter
        ? trpc.officer.cycles.listActive
        : trpc.management.cycles.listActive;

    const prefix = isAdmin
        ? `/admin/organizations/${orgId}`
        : isManagement
            ? `/management`
            : ``;

    const { data, isLoading } = useQuery({
        ...procedure.queryOptions({

            orgId,
            search: debouncedSearch,
            pageSize: 100,
            sortOrder: "desc" // Default sort, backend handles grouping sort if needed
        }),
        placeholderData: keepPreviousData
    });

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
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search cycles or farmers..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex items-center bg-slate-100 p-1 rounded-lg self-start sm:self-auto">
                    <button
                        onClick={() => setViewMode("group")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === "group" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        Group View
                    </button>
                    <button
                        onClick={() => setViewMode("list")}
                        className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${viewMode === "list" ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                        List View
                    </button>
                </div>
            </div>

            {isLoading && !data ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
            ) : cycles.length === 0 ? (
                <div className="text-center p-8 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed">
                    {search ? "No active cycles match your search." : "No active production cycles found."}
                </div>
            ) : (
                <>
                    {viewMode === "group" ? (
                        <div className="space-y-4">
                            {sortedGroups.map((group) => (
                                <div key={group.farmerId} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="px-4 py-3 bg-slate-50/50 border-b flex justify-between items-center">
                                        <Link
                                            href={isAdmin ? `/admin/organizations/${orgId}/farmers/${group.farmerId}` : (isManagement ? `/management/farmers/${group.farmerId}` : `/farmers/${group.farmerId}`)}
                                            className="font-bold text-slate-900 hover:text-primary hover:underline flex items-center gap-2"
                                        >
                                            {group.farmerName}
                                            <Badge variant="secondary" className="ml-2 font-normal text-xs bg-white border border-slate-200 text-slate-500">
                                                {group.cycles.length} cycle{group.cycles.length !== 1 ? 's' : ''}
                                            </Badge>
                                        </Link>
                                        <Button size="sm" variant="ghost" className="h-8 gap-1 text-slate-500" asChild>
                                            <Link href={isAdmin ? `/admin/organizations/${orgId}/farmers/${group.farmerId}` : (isManagement ? `/management/farmers/${group.farmerId}` : `/farmers/${group.farmerId}`)}>
                                                Details <ArrowRight className="h-3 w-3" />
                                            </Link>
                                        </Button>
                                    </div>
                                    <div className="divide-y divide-slate-100">
                                        {/* Desktop Table Header (Pseudo) */}
                                        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50/20">
                                            <div className="col-span-2">Cycle Name</div>
                                            <div className="col-span-2">Age</div>
                                            <div className="col-span-2">Birds & Mortality</div>
                                            <div className="col-span-2">Consumption</div>
                                            <div className="col-span-2">Started</div>
                                            <div className="col-span-1">Actions</div>
                                        </div>

                                        {group.cycles.map((cycle) => (
                                            <div key={cycle.id} className="group hover:bg-slate-50/50 transition-colors">
                                                {/* Desktop Row */}
                                                <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 items-center">
                                                    <div className="col-span-2 font-medium text-slate-900 flex items-center gap-2">
                                                        <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-none font-bold text-[8px] h-4 w-4 flex items-center justify-center rounded-full p-0 flex-shrink-0">
                                                            <Bird className="h-2.5 w-2.5" />
                                                        </Badge>
                                                        <Link
                                                            href={isAdmin ? `/admin/organizations/${orgId}/cycles/${cycle.id}` : (isManagement ? `/management/cycles/${cycle.id}` : `/cycles/${cycle.id}`)}
                                                            className="hover:text-primary hover:underline underline-offset-2 transition-colors truncate block"
                                                        >
                                                            {cycle.name}
                                                        </Link>
                                                    </div>
                                                    <div className="col-span-2 text-sm font-bold text-slate-700">{cycle.age} <span className="text-[10px] text-slate-400 font-normal lowercase">days</span></div>
                                                    <div className="col-span-2 flex flex-col gap-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-sm font-bold text-slate-900">{cycle.doc.toLocaleString()}</span>
                                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">Birds</span>
                                                        </div>
                                                        {cycle.mortality > 0 && (
                                                            <div className="flex items-center gap-1 text-[9px] text-red-600 font-bold bg-red-50 border border-red-100/50 w-fit px-1.5 py-0.5 rounded-full">
                                                                <Skull className="h-2.5 w-2.5" />
                                                                {cycle.mortality} deaths
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="col-span-2 text-sm font-bold text-amber-700">{Number(cycle.intake || 0).toFixed(2)}</div>
                                                    <div className="col-span-2 text-xs text-slate-500">{format(new Date(cycle.createdAt), "MMM d, yyyy")}</div>
                                                    <div className="col-span-1 text-right flex items-center justify-end gap-1">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors" asChild>
                                                            <Link href={isAdmin ? `/admin/organizations/${orgId}/cycles/${cycle.id}` : (isManagement ? `/management/cycles/${cycle.id}` : `/cycles/${cycle.id}`)}>
                                                                <Eye className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                        <ActionsCell cycle={cycle as unknown as Farmer} prefix={prefix} />
                                                    </div>
                                                </div>

                                                {/* Mobile Row */}
                                                <Link
                                                    href={isAdmin ? `/admin/organizations/${orgId}/cycles/${cycle.id}` : (isManagement ? `/management/cycles/${cycle.id}` : `/cycles/${cycle.id}`)}
                                                    className="block md:hidden p-4 space-y-2 active:bg-slate-50"
                                                >
                                                    <div className="flex justify-between items-start">
                                                        <div className="font-bold text-slate-900">{cycle.name}</div>
                                                        <Badge className="bg-violet-50 text-violet-700 border-violet-100 font-bold text-[9px]">{cycle.age} days</Badge>
                                                    </div>
                                                    <div className="flex justify-between items-center text-xs text-slate-500">
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex items-center gap-1">
                                                                <Bird className="h-3 w-3" />
                                                                {cycle.doc.toLocaleString()}
                                                            </div>
                                                            <div className="flex items-center gap-1 text-amber-600 font-bold">
                                                                <Wheat className="h-3 w-3" />
                                                                {Number(cycle.intake || 0).toFixed(1)}
                                                            </div>
                                                            {cycle.mortality > 0 && (
                                                                <div className="flex items-center gap-1 text-red-600 font-bold bg-red-50 px-1.5 rounded">
                                                                    <Skull className="h-3 w-3" />
                                                                    {cycle.mortality}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div>{format(new Date(cycle.createdAt), "dd MMM")}</div>
                                                    </div>
                                                </Link>
                                                <div className="px-4 pb-4 sm:hidden flex justify-end">
                                                    <ActionsCell cycle={cycle as unknown as Farmer} prefix={prefix} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table (List View) */}
                            <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                                <Table>
                                    <TableHeader className="bg-slate-50/50">
                                        <TableRow>
                                            <TableHead className="font-semibold">Farmer</TableHead>
                                            <TableHead className="font-semibold">Status</TableHead>
                                            <TableHead className="font-semibold text-[11px] uppercase tracking-wider">Age</TableHead>
                                            <TableHead className="font-semibold text-[11px] uppercase tracking-wider">Birds & Mortality</TableHead>
                                            <TableHead className="font-semibold text-right text-[11px] uppercase tracking-wider">Consumption (Bags)</TableHead>
                                            <TableHead className="font-semibold text-right text-[11px] uppercase tracking-wider">Started</TableHead>
                                            <TableHead className="w-[50px] px-6"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {cycles.map((cycle) => (
                                            <TableRow key={cycle.id} className="hover:bg-slate-50/50 group transition-colors">
                                                <TableCell className="text-slate-600 font-medium">
                                                    <Link href={isAdmin ? `/admin/organizations/${orgId}/farmers/${cycle.farmerId}` : (isManagement ? `/management/farmers/${cycle.farmerId}` : `/farmers/${cycle.farmerId}`)} className="hover:text-primary transition-colors cursor-pointer">
                                                        {cycle.farmerName}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-none font-bold text-[10px] uppercase tracking-wider">Active</Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                                        {cycle.age} <span className="text-[10px] text-slate-400 font-normal lowercase">days</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-y-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <Bird className="h-3.5 w-3.5 text-violet-500/70" />
                                                            <span className="text-sm font-bold text-slate-900">{cycle.doc.toLocaleString()}</span>
                                                        </div>
                                                        {cycle.mortality > 0 && (
                                                            <div className="flex items-center gap-1 text-[9px] text-red-600 font-bold bg-red-50 border border-red-100/50 w-fit px-1.5 py-0.5 rounded-full ml-5">
                                                                <Skull className="h-2.5 w-2.5" />
                                                                {cycle.mortality} deaths
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="font-bold text-amber-700">{Number(cycle.intake || 0).toFixed(2)}</div>
                                                </TableCell>
                                                <TableCell className="text-right text-slate-400 text-[11px] font-medium">
                                                    {format(new Date(cycle.createdAt), "MMM d, yyyy")}
                                                </TableCell>
                                                <TableCell className="px-6">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/5 transition-colors" asChild>
                                                            <Link href={isAdmin ? `/admin/organizations/${orgId}/cycles/${cycle.id}` : (isManagement ? `/management/cycles/${cycle.id}` : `/cycles/${cycle.id}`)}>
                                                                <Eye className="h-4 w-4" />
                                                            </Link>
                                                        </Button>
                                                        <ActionsCell cycle={cycle as unknown as Farmer} prefix={prefix} />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile Cards (List View) */}
                            <div className="md:hidden space-y-3">
                                {cycles.map((cycle) => (
                                    <Link href={isAdmin ? `/admin/organizations/${orgId}/cycles/${cycle.id}` : (isManagement ? `/management/cycles/${cycle.id}` : `/cycles/${cycle.id}`)} key={cycle.id} className="block">
                                        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="space-y-0.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <h3 className="font-bold text-slate-900">{cycle.name}</h3>
                                                        <Badge className="bg-violet-100 text-violet-700 border-none font-bold text-[8px] h-4">ACTIVE</Badge>
                                                    </div>
                                                    <p className="text-[10px] text-slate-500 font-medium">Farmer: <span className="text-slate-900 font-bold">{cycle.farmerName}</span></p>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-4 gap-2 py-3 border-y border-slate-50">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Age</span>
                                                    <p className="text-sm font-bold text-slate-900">{cycle.age} <small className="text-[10px] font-normal">d</small></p>
                                                </div>
                                                <div className="space-y-1 text-center">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">DOC</span>
                                                    <div className="flex items-center gap-1 justify-center">
                                                        <Bird className="h-3.5 w-3.5 text-slate-400" />
                                                        <p className="text-sm font-bold text-slate-900">{cycle.doc.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-1 text-center">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Feed</span>
                                                    <div className="flex items-center gap-1 justify-center">
                                                        <Wheat className="h-3.5 w-3.5 text-amber-500" />
                                                        <p className="text-sm font-bold text-amber-700">{Number(cycle.intake || 0).toFixed(1)}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-1 text-right">
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Mortality</span>
                                                    <div className="flex items-center gap-1 justify-end">
                                                        {cycle.mortality > 0 ? (
                                                            <p className="text-sm font-bold text-red-600 bg-red-50 px-2 rounded-full">{cycle.mortality}</p>
                                                        ) : (
                                                            <p className="text-sm font-bold text-slate-300">-</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="pt-2 flex justify-between items-center text-[10px] text-slate-400">
                                                <span className="font-medium">Started {format(new Date(cycle.createdAt), "MMM d, yyyy")}</span>
                                                <span className="flex items-center gap-1 text-primary hover:text-primary/80 font-bold">
                                                    View Details <ArrowRight className="h-3 w-3" />
                                                </span>
                                            </div>
                                            <div className="px-4 pb-4 pt-0 flex justify-end border-t border-slate-50 mt-2">
                                                <div className="pt-2">
                                                    <ActionsCell cycle={cycle as unknown as Farmer} prefix={prefix} />
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
};
