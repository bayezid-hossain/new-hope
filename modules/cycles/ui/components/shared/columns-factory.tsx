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
import { Activity, ArrowUpDown, CalendarDays, Eye, MoreHorizontal, Pencil, Power, RotateCcw, ShoppingCart, Skull, Trash2, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AddMortalityModal } from "../cycles/add-mortality-modal";
import { CorrectMortalityModal } from "../cycles/correct-mortality-modal";
import { EditAgeModal } from "../cycles/edit-age-modal";
import { EditDocModal } from "../cycles/edit-doc-modal";
import { EndCycleModal } from "../cycles/end-cycle-modal";
import { ReopenCycleModal } from "../cycles/reopen-cycle-modal";
import { SellModal } from "../cycles/sell-modal";

interface ColumnsFactoryOptions {
    prefix?: string; // e.g. "/admin" or "/management"
    enableActions?: boolean; // If true, show Add Mortality / End Cycle
    currentId?: string; // For highlighting current cycle
}

// --- Actions Component ---
export const ActionsCell = ({ cycle, prefix }: { cycle: Farmer; prefix?: string }) => {
    const { isPro, canEdit } = useCurrentOrg();
    const [showEndCycle, setShowEndCycle] = useState(false);
    const [showAddMortality, setShowAddMortality] = useState(false);
    const [showEditAge, setShowEditAge] = useState(false);
    const [showEditDoc, setShowEditDoc] = useState(false);
    const [showCorrectMortality, setShowCorrectMortality] = useState(false);
    const [showSellModal, setShowSellModal] = useState(false);

    if (cycle.status === "history") return null;
    if (!canEdit) return null;

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-7 w-7 sm:h-8 sm:w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                        onClick={() => {
                            if (isPro) setShowSellModal(true);
                            else toast.error("Sales tracking is a Pro feature");
                        }}
                        disabled={!isPro}
                        title={!isPro ? "Upgrade to Pro to track sales" : ""}
                        className={!isPro ? "opacity-50 cursor-not-allowed" : "text-primary focus:text-primary"}
                    >
                        <ShoppingCart className="mr-2 h-4 w-4" />
                        {isPro ? "Sell" : "Sell (Pro)"}
                    </DropdownMenuItem>

                    <DropdownMenuSeparator />

                    <DropdownMenuItem onClick={() => setShowAddMortality(true)}>
                        <Skull className="mr-2 h-4 w-4" />
                        Add Mortality
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={() => setShowEditDoc(true)}
                        disabled={cycle.birdsSold > 0}
                        title={cycle.birdsSold > 0 ? "Cannot edit initial birds after sales have started" : ""}
                    >
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit Initial Birds (DOC)
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={() => setShowEditAge(true)}
                        disabled={cycle.birdsSold > 0}
                        title={cycle.birdsSold > 0 ? "Cannot edit age after sales have started" : ""}
                    >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        Edit Age
                    </DropdownMenuItem>

                    <DropdownMenuItem
                        onClick={() => setShowCorrectMortality(true)}
                        title={cycle.birdsSold > 0 ? "Cannot correct mortality after sales have started, you can update it in the next sale report or end the cycle" : ""}
                    >
                        <Wrench className="mr-2 h-4 w-4" />
                        Correct Total Mortality
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

            <SellModal
                cycleId={cycle.id}
                farmerId={cycle.farmerId}
                cycleName={cycle.name}
                farmerName={cycle.farmerName || ""}
                farmerLocation={cycle.farmerLocation}
                farmerMobile={cycle.farmerMobile}
                cycleAge={cycle.age || 0}
                doc={cycle.doc}
                mortality={cycle.mortality || 0}
                birdsSold={cycle.birdsSold || 0}
                intake={cycle.intake || 0}
                open={showSellModal}
                onOpenChange={setShowSellModal}
                startDate={cycle.createdAt}
            />

            <AddMortalityModal
                cycleId={cycle.id}
                farmerName={cycle.name}
                open={showAddMortality}
                onOpenChange={setShowAddMortality}
            />

            <EndCycleModal
                cycleId={cycle.id}
                farmerId={cycle.farmerId}
                cycleName={cycle.name}
                farmerName={cycle.farmerName || cycle.name}
                farmerLocation={cycle.farmerLocation}
                farmerMobile={cycle.farmerMobile}
                age={cycle.age}
                intake={parseFloat(String(cycle.intake || 0))}
                doc={cycle.doc}
                mortality={cycle.mortality || 0}
                birdsSold={cycle.birdsSold || 0}
                startDate={cycle.createdAt}
                open={showEndCycle}
                prefix={prefix}
                onOpenChange={setShowEndCycle}
            />

            <EditDocModal
                cycleId={cycle.id}
                currentDoc={parseInt(String(cycle.doc || 0))}
                open={showEditDoc}
                onOpenChange={setShowEditDoc}
            />

            <EditAgeModal
                cycleId={cycle.id}
                currentAge={cycle.age}
                open={showEditAge}
                onOpenChange={setShowEditAge}
            />

            <CorrectMortalityModal
                cycleId={cycle.id}
                currentMortality={cycle.mortality || 0}
                open={showCorrectMortality}
                onOpenChange={setShowCorrectMortality}
            />
        </>
    );
};

export const HistoryActionsCell = ({ history, prefix }: { history: FarmerHistory; prefix?: string }) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showReopenModal, setShowReopenModal] = useState(false);
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { orgId, canEdit } = useCurrentOrg();

    const isAdmin = prefix?.includes("/admin");

    if (!canEdit) return null;

    const deleteMutation = useMutation(
        (isAdmin ? trpc.admin.cycles.deleteHistory : trpc.officer.cycles.deleteHistory).mutationOptions({
            onSuccess: async () => {
                toast.success(isAdmin ? "Record deleted permanently" : "Record deleted successfully");

                const baseOptions = { orgId: orgId! };
                // Invalidate across ALL routers to ensure all views update
                await Promise.all([
                    queryClient.invalidateQueries(trpc.admin.cycles.listPast.pathFilter()),
                    queryClient.invalidateQueries(trpc.officer.cycles.listPast.pathFilter()),
                    queryClient.invalidateQueries(trpc.management.cycles.listPast.pathFilter()),

                    // Also invalidate active lists just in case
                    queryClient.invalidateQueries(trpc.admin.cycles.listActive.pathFilter()),
                    queryClient.invalidateQueries(trpc.officer.cycles.listActive.pathFilter()),
                    queryClient.invalidateQueries(trpc.management.cycles.listActive.pathFilter()),

                    // Invalidate detailed farmer views
                    queryClient.invalidateQueries(trpc.management.farmers.getManagementHub.queryOptions({ farmerId: history.farmerId, orgId: orgId! })),
                    queryClient.invalidateQueries(trpc.management.farmers.getOrgFarmers.pathFilter()),
                    queryClient.invalidateQueries(trpc.management.farmers.getHistory.queryOptions({ farmerId: history.farmerId, orgId: orgId! })),
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
                        className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 focus:bg-red-50 dark:focus:bg-red-900/20 cursor-pointer"
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
                prefix={prefix}
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
                    className="p-2 sm:p-4 text-xs sm:text-sm font-medium text-foreground hover:underline hover:text-primary transition-colors underline decoration-border"
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
            header: "Birds (Initial/Live)",
            cell: ({ row }) => {
                const doc = parseInt(String(row.original.doc || 0));
                const mortality = parseInt(String(row.original.mortality || 0));
                const birdsSold = parseInt(String(row.original.birdsSold || 0));
                const liveBirds = Math.max(0, doc - mortality - birdsSold);

                return (
                    <div className="flex flex-col">
                        <span className="text-xs sm:text-sm font-bold text-foreground">{doc.toLocaleString()}</span>
                        <span className="text-[10px] text-muted-foreground">Live: {liveBirds.toLocaleString()}</span>
                    </div>
                );
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
                        mortality > 0 ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400" : "bg-muted text-muted-foreground"
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
                            className={cn("p-2 sm:p-4 text-xs sm:text-sm font-medium transition-colors hover:underline hover:text-primary underline decoration-border", (isActive || isCurrent) ? "text-primary font-bold" : "text-foreground")}
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
                        {row.original.status === "deleted" && (
                            <Badge variant="destructive" className="h-5 px-2 text-[10px] uppercase tracking-wider bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-800">
                                Deleted by Officer
                            </Badge>
                        )}
                    </div>
                );
            },
        },
        {
            accessorKey: "doc",
            header: "Birds (Initial/Sold)",
            cell: ({ row }) => {
                const doc = parseInt(String(row.original.doc || 0));
                const sold = parseInt(String(row.original.birdsSold || 0));
                const mortality = parseInt(String(row.original.mortality || 0));
                const remaining = Math.max(0, doc - mortality - sold);

                return (
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs sm:text-sm font-bold text-foreground">{doc.toLocaleString()} Initial</span>
                        </div>
                        <div className="flex items-center gap-1.5 opacity-80">
                            <span className="bg-primary/10 text-primary w-fit rounded px-1 py-0.5 font-mono text-[9px] sm:text-[10px] font-bold">
                                {sold.toLocaleString()} Sold
                            </span>
                            {remaining > 0 && row.original.status !== 'archived' && (
                                <span className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 w-fit rounded px-1 py-0.5 font-mono text-[9px] sm:text-[10px] font-bold">
                                    {remaining.toLocaleString()} Live
                                </span>
                            )}
                        </div>
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
                return <div className="text-right font-mono text-xs sm:text-sm font-medium text-muted-foreground">{val.toFixed(2)}</div>;
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
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                        <CalendarDays className="size-4 opacity-30" />
                        <div className="flex flex-col">
                            <span className="font-medium leading-none text-foreground">{diffDays} {diffDays > 1 ? "days" : "day"}</span>
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
            cell: ({ row }) => <HistoryActionsCell history={row.original} prefix={prefix} />,
        });
    }

    return columns;
};
