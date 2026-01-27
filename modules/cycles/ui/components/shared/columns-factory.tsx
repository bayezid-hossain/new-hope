"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import { Farmer, FarmerHistory } from "@/modules/cycles/types";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Activity, ArrowUpDown, CalendarDays, Eye, MoreHorizontal, Pencil, Power, RotateCcw, Skull, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AddMortalityModal } from "../cycles/add-mortality-modal";
import { EditDocModal } from "../cycles/edit-doc-modal";
import { EndCycleModal } from "../cycles/end-cycle-modal";
import { ReopenCycleModal } from "../cycles/reopen-cycle-modal";

interface ColumnsFactoryOptions {
    prefix?: string; // e.g. "/admin" or "/management"
    enableActions?: boolean; // If true, show Add Mortality / End Cycle
    currentId?: string; // For highlighting current cycle
}

// --- Actions Component ---
export const ActionsCell = ({ cycle, prefix }: { cycle: Farmer; prefix?: string }) => {
    const [showEndCycle, setShowEndCycle] = useState(false);
    const [showAddMortality, setShowAddMortality] = useState(false);
    const [showEditDoc, setShowEditDoc] = useState(false);

    if (cycle.status === "history") return null;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => setShowAddMortality(true)}>
                        <Skull className="mr-2 h-4 w-4" />
                        Add Mortality
                    </DropdownMenuItem>

                    <DropdownMenuItem onClick={() => setShowEditDoc(true)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Initial Birds (DOC)
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onClick={() => setShowEndCycle(true)}
                        className="text-destructive focus:text-destructive"
                    >
                        <Power className="mr-2 h-4 w-4" />
                        End Cycle
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <AddMortalityModal
                cycleId={cycle.id}
                farmerName={cycle.name}
                open={showAddMortality}
                onOpenChange={setShowAddMortality}
            />

            <EndCycleModal
                cycleId={cycle.id}
                farmerName={cycle.name}
                intake={parseFloat(String(cycle.intake || 0))}
                open={showEndCycle}
                onOpenChange={setShowEndCycle}
            />

            <EditDocModal
                cycleId={cycle.id}
                currentDoc={parseInt(String(cycle.doc || 0))}
                open={showEditDoc}
                onOpenChange={setShowEditDoc}
            />
        </>
    );
};

export const HistoryActionsCell = ({ history }: { history: FarmerHistory }) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showReopenModal, setShowReopenModal] = useState(false);
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { orgId } = useCurrentOrg();

    const deleteMutation = useMutation(
        trpc.admin.cycles.deleteHistory.mutationOptions({
            onSuccess: async () => {
                toast.success("Record deleted successfully");

                const baseOptions = { orgId: orgId! };
                // Invalidate across ALL routers to ensure all views update
                await Promise.all([
                    queryClient.invalidateQueries(trpc.admin.cycles.listPast.queryOptions(baseOptions)),
                    queryClient.invalidateQueries(trpc.officer.cycles.listPast.queryOptions(baseOptions)),
                    queryClient.invalidateQueries(trpc.management.cycles.listPast.queryOptions(baseOptions)),

                    // Also invalidate active lists just in case
                    queryClient.invalidateQueries(trpc.admin.cycles.listActive.queryOptions(baseOptions)),
                    queryClient.invalidateQueries(trpc.officer.cycles.listActive.queryOptions(baseOptions)),
                    queryClient.invalidateQueries(trpc.management.cycles.listActive.queryOptions(baseOptions)),

                    // Invalidate detailed farmer views
                    queryClient.invalidateQueries(trpc.management.farmers.getManagementHub.queryOptions({ farmerId: history.farmerId })),
                    queryClient.invalidateQueries(trpc.management.farmers.getOrgFarmers.queryOptions(baseOptions)),
                ]);
                setShowDeleteModal(false);
            },
            onError: (err: any) => {
                toast.error(err.message || "Failed to delete record");
            }
        })
    );


    // If status is active, show indicator (shouldn't happen in history table usually but duplicate logic from original)
    // @ts-ignore
    if (history.status === 'active') {
        return (
            <div className="w-8 h-8 flex items-center justify-center">
                <span className="sr-only">Active</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
        );
    }

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={() => setShowReopenModal(true)}
                    >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        Reopen Cycle
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                        onClick={() => setShowDeleteModal(true)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Record
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <ReopenCycleModal
                historyId={history.id}
                farmerId={history.farmerId}
                cycleName={history.cycleName}
                open={showReopenModal}
                onOpenChange={setShowReopenModal}
            />

            <ResponsiveDialog
                open={showDeleteModal}
                onOpenChange={setShowDeleteModal}
                title="Delete Record"
                description="Are you sure you want to delete this history record? This action cannot be undone."
            >
                <div className="flex justify-end gap-2 pt-4">
                    <Button
                        variant="outline"
                        onClick={() => setShowDeleteModal(false)}
                        disabled={deleteMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="destructive"
                        className=" text-white"
                        onClick={() => deleteMutation.mutate({ id: history.id })}
                        disabled={deleteMutation.isPending}
                    >
                        {deleteMutation.isPending ? "Deleting..." : "Delete"}
                    </Button>
                </div>
            </ResponsiveDialog>
        </>
    );
};

// --- Active Cycles Columns ---
export const getCycleColumns = ({ prefix = "", enableActions = false }: ColumnsFactoryOptions): ColumnDef<Farmer>[] => {
    const columns: ColumnDef<Farmer>[] = [
        {
            accessorKey: "name",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8 text-xs sm:text-sm font-medium"
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => (
                <Link
                    href={`${prefix}/farmers/${row.original.farmerId}`}
                    className="p-2 sm:p-4 text-xs sm:text-sm font-medium text-foreground hover:underline hover:text-primary transition-colors underline decoration-slate-200"
                >
                    {row.getValue("name")}
                </Link>
            ),
        },
        {
            accessorKey: "age",
            header: "Age",
            cell: ({ row }) => {
                const age = row.getValue("age") as number;
                return (
                    <div className="flex items-center gap-1 text-xs sm:text-sm">
                        <span>{age}</span>
                        <span className="text-muted-foreground">{age > 1 ? "days" : "day"}</span>
                    </div>
                );
            },
        },
        {
            accessorKey: "doc",
            header: "DOC",
            cell: ({ row }) => {
                const amount = parseInt(row.getValue("doc"));
                return <div className="text-xs sm:text-sm text-muted-foreground">{amount.toLocaleString()}</div>;
            },
        },
        {
            accessorKey: "mortality",
            header: "Mortality",
            cell: ({ row }) => {
                const mortality = row.original.mortality;
                return (
                    <div className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-sm font-medium",
                        mortality > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"
                    )}>
                        {mortality > 0 ? '-' : ""}{mortality}
                    </div>
                );
            },
        },
        {
            accessorKey: "intake",
            header: () => <div className="text-right text-[10px] sm:text-[11px]">Consumption (Bags)</div>,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("intake"));
                return <div className="text-right text-xs sm:text-sm text-muted-foreground">{amount.toFixed(2)}</div>;
            },
        },
        {
            id: "details",
            header: () => <div className="text-center text-[10px] sm:text-[11px]">Details</div>,
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10">
                        <Link href={`${prefix}/cycles/${row.original.id}`}>
                            <Eye className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            ),
        },
    ];

    if (enableActions) {
        columns.push({
            id: "actions",
            cell: ({ row }) => <ActionsCell cycle={row.original} prefix={prefix} />,
        });
    }

    return columns;
};

// --- History Columns ---
export const getHistoryColumns = ({ prefix = "", currentId, enableActions = false }: ColumnsFactoryOptions): ColumnDef<FarmerHistory>[] => {
    const columns: ColumnDef<FarmerHistory>[] = [
        {
            accessorKey: "cycleName",
            header: ({ column }) => (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8 text-xs sm:text-sm font-medium"
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            ),
            cell: ({ row }) => {
                // @ts-ignore
                const isActive = row.original.status === 'active';
                const isCurrent = row.original.id === currentId;
                return (
                    <div className={cn("flex items-center gap-2", isCurrent && "bg-primary/5 p-1 rounded-md border border-primary/20")}>
                        <Link
                            className={cn("p-2 sm:p-4 text-xs sm:text-sm font-medium transition-colors hover:underline hover:text-primary underline decoration-slate-200", (isActive || isCurrent) ? "text-primary font-bold" : "text-foreground")}
                            href={`${prefix}/farmers/${row.original.farmerId}`}
                        >
                            {row.original.cycleName}
                        </Link>
                        {isActive && (
                            <Badge variant="default" className="h-5 gap-1 px-2 text-[10px] uppercase tracking-wider">
                                <Activity className="size-3" /> Live
                            </Badge>
                        )}
                        {isCurrent && (
                            <Badge variant="outline" className="h-5 gap-1 px-2 text-[10px] uppercase tracking-wider border-primary text-primary">
                                Current
                            </Badge>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "doc",
            header: "DOC",
            cell: ({ row }) => {
                const amount = parseInt(row.getValue("doc"));
                return (
                    <div className="bg-muted text-muted-foreground w-fit rounded-md px-1.5 py-0.5 font-mono text-[10px] sm:text-xs font-medium">
                        {amount.toLocaleString()}
                    </div>
                );
            },
        },
        {
            accessorKey: "age",
            header: "Cycle Age",
            cell: ({ row }) => (
                <div className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {row.getValue("age")} {Number(row.getValue("age")) === 1 ? "day" : "days"}
                </div>
            ),
        },
        {
            accessorKey: "mortality",
            header: "Mortality",
            cell: ({ row }) => {
                const val = row.original.mortality;
                return (
                    <Badge variant={val > 0 ? "destructive" : "secondary"} className={cn("font-normal", val === 0 && "bg-muted text-muted-foreground hover:bg-muted")}>
                        {val.toLocaleString()}
                    </Badge>
                );
            },
        },
        {
            accessorKey: "intake",
            header: () => <div className="text-right text-[10px] sm:text-[11px]">Consumption (Bags)</div>,
            cell: ({ row }) => {
                // @ts-ignore
                const val = parseFloat(row.getValue("intake") || row.original.finalIntake || "0");
                return <div className="text-right font-mono text-xs sm:text-sm font-medium text-slate-600">{val.toFixed(2)}</div>;
            },
        },
        {
            accessorKey: "timespan",
            header: "Timespan",
            cell: ({ row }) => {
                // @ts-ignore
                const isActive = row.original.status === 'active';
                // @ts-ignore
                const start = new Date(row.original.startDate || row.original.createdAt);
                // @ts-ignore
                const end = row.original.endDate || row.original.updatedAt ? new Date(row.original.endDate || row.original.updatedAt) : new Date();

                if (isActive) {
                    return (
                        <div className="bg-primary/10 text-primary flex items-center gap-1 sm:gap-2 rounded-md px-2 py-1 text-xs sm:text-sm">
                            <CalendarDays className="size-4 opacity-50" />
                            <span className="font-medium">Ongoing</span>
                        </div>
                    );
                }

                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: '2-digit' };

                return (
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500">
                        <CalendarDays className="size-4 opacity-30" />
                        <div className="flex flex-col">
                            <span className="font-medium leading-none text-slate-800">{diffDays} days</span>
                            <span className="mt-1 text-[9px] uppercase tracking-wide opacity-70">
                                {start.toLocaleDateString('en-US', options)} - {end.toLocaleDateString('en-US', options)}
                            </span>
                        </div>
                    </div>
                );
            },
        },
        {
            id: "details",
            header: () => <div className="text-center text-[10px] sm:text-[11px]">Details</div>,
            cell: ({ row }) => (
                <div className="flex justify-center">
                    <Button variant="ghost" size="icon" asChild className="h-8 w-8 text-primary hover:text-primary/80 hover:bg-primary/10">
                        <Link href={`${prefix}/cycles/${row.original.id}`}>
                            <Eye className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            ),
        },
    ];

    if (enableActions) {
        columns.push({
            id: "actions",
            cell: ({ row }) => <HistoryActionsCell history={row.original} />,
        });
    }

    return columns;
};
