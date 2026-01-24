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
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import { FarmerHistory } from "@/modules/cycles/types";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ColumnDef } from "@tanstack/react-table";
import { Activity, ArrowUpDown, CalendarDays, Eye, MoreHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

// FIX 1: Defined a type that includes the optional status
type HistoryRow = FarmerHistory & { status?: string };

// FIX 2: Explicitly typed the parameter to avoid 'any' error
const isRowActive = (row: HistoryRow) => row.status === 'active';

const ActionsCell = ({ history }: { history: HistoryRow }) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { orgId } = useCurrentOrg();
    // FIX 3: Moved useMutation to the top level (Must be before any return statement)
    const deleteMutation = useMutation(
        trpc.cycles.deleteHistory.mutationOptions({
            onSuccess: async () => {
                toast.success("Record deleted successfully");
                await queryClient.invalidateQueries(trpc.cycles.getPastCycles.queryOptions({ orgId: orgId! }));
                setShowDeleteModal(false);
            },
            onError: (err) => {
                toast.error(err.message || "Failed to delete record");
            }
        })
    );

    // FIX 4: Conditional return happens AFTER hooks are initialized
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
                        className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                        onClick={() => setShowDeleteModal(true)}
                    >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Record
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

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

export const historyColumns: ColumnDef<FarmerHistory>[] = [
    {
        //@ts-ignore - Mapped field
        accessorKey: "cycleName",
        header: ({ column }) => {
            return (
                <Button
                    variant="ghost"
                    onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
                    className="-ml-4 h-8 text-xs sm:text-sm font-medium"
                >
                    Name
                    <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
            );
        },
        cell: ({ row }) => {
            const isActive = isRowActive(row.original as HistoryRow);
            return (
                <div className="flex items-center gap-2">
                    <span className={cn("text-xs sm:text-sm font-medium transition-colors hover:underline hover:text-primary", isActive ? "text-primary font-bold underline" : "text-foreground underline")}>
                        {/* @ts-ignore */}
                        <Link className=" p-2 sm:p-4 text-xs sm:text-sm font-medium text-foreground hover:underline hover:text-primary transition-colors"
                            href={`/farmers/${row.original.farmerId}`}
                        >
                            {row.original.cycleName}
                        </Link>
                    </span>
                    {isActive && (
                        <Badge variant="default" className="h-5 gap-1 px-2 text-[10px] uppercase tracking-wider">
                            <Activity className="size-3" /> Live
                        </Badge>
                    )}
                </div>
            )
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
            <div className="text-xs sm:text-sm font-medium">
                <span className="text-muted-foreground font-normal">
                    {row.getValue("age")} {Number(row.getValue("age")) === 1 ? "day" : "days"}</span>
            </div>
        ),
    },
    {
        accessorKey: "mortality",
        header: "Mortality",
        cell: ({ row }) => {
            const val = row.original.mortality;
            return (
                <Badge
                    variant={val > 0 ? "destructive" : "secondary"}
                    className={cn("font-normal", val === 0 && "bg-muted text-muted-foreground hover:bg-muted")}
                >
                    {val.toLocaleString()}
                </Badge>
            );
        },
    },
    {
        accessorKey: "intake",
        header: () => <div className="text-right text-[10px] sm:text-[11px]">Consumed</div>,
        cell: ({ row }) => {
            // @ts-ignore - Handle data source variations
            const val = parseFloat(row.getValue("intake") || row.original.finalIntake || "0");
            return <div className="text-zinc-700 text-right font-mono text-xs sm:text-sm font-medium">{val.toFixed(2)}</div>;
        },
    },
    {
        accessorKey: "timespan",
        header: "Timespan",
        cell: ({ row }) => {
            const isActive = isRowActive(row.original as HistoryRow);
            // @ts-ignore - Mapped fields
            const start = new Date(row.original.startDate || row.original.createdAt);
            // @ts-ignore - Mapped fields
            const end = row.original.endDate || row.original.updatedAt ? new Date(row.original.endDate || row.original.updatedAt) : new Date();

            if (isActive) {
                return (
                    <div className="bg-primary/10 text-primary flex items-center gap-1 sm:gap-2 rounded-md px-2 py-1 text-xs sm:text-sm">
                        <CalendarDays className="size-4 opacity-50" />
                        <span className="font-medium">Ongoing</span>
                    </div>
                )
            }

            const diffTime = Math.abs(end.getTime() - start.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            const options: Intl.DateTimeFormatOptions = {
                month: 'short',
                day: 'numeric',
                year: '2-digit'
            };

            return (
                <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <CalendarDays className="text-muted-foreground size-4 opacity-50" />
                    <div className="flex flex-col">
                        <span className="font-medium leading-none">
                            {diffDays} {diffDays === 1 ? "day" : "days"}
                        </span>
                        <span className="text-muted-foreground mt-0.5 text-[10px] uppercase tracking-wide">
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
                    <Link href={`/cycles/${row.original.id}`}>
                        <Eye className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
        ),
    },
    {
        id: "actions",
        cell: ({ row }) => <ActionsCell history={row.original as HistoryRow} />,
    },
];