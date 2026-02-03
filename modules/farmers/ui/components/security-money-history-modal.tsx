
"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";

interface SecurityMoneyHistoryModalProps {
    farmerId: string;
    farmerName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variant?: "officer" | "management";
    orgId?: string;
}

export function SecurityMoneyHistoryModal({
    farmerId,
    farmerName,
    open,
    onOpenChange,
    variant = "officer",
    orgId
}: SecurityMoneyHistoryModalProps) {
    const trpc = useTRPC();

    // Officer Query
    const { data: officerData, isLoading: officerLoading } = useQuery(
        trpc.officer.farmers.getSecurityMoneyHistory.queryOptions({
            farmerId: farmerId
        }, {
            enabled: open && variant === "officer"
        })
    );

    // Management Query
    const { data: managementData, isLoading: managementLoading } = useQuery(
        trpc.management.farmers.getSecurityMoneyHistory.queryOptions({
            farmerId: farmerId,
            orgId: orgId || ""
        }, {
            enabled: open && variant === "management" && !!orgId
        })
    );

    const data = variant === "officer" ? officerData : managementData;
    const isLoading = variant === "officer" ? officerLoading : managementLoading;

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title={`Security Money History - ${farmerName}`}
            description="Log of all changes to security money."
        >
            <div className="max-h-[60vh] overflow-auto scroll-smooth scrollbar-thin">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : !data || data.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground italic">
                        No history found.
                    </div>
                ) : (
                    <>
                        {/* Mobile View: Cards */}
                        <div className="block sm:hidden space-y-3 pb-4">
                            {data.map((log) => (
                                <div key={log.id} className="p-4 rounded-lg border bg-card text-card-foreground shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="text-sm font-medium">{log.editor?.name || "System"}</p>
                                            <p className="text-xs text-muted-foreground">{format(new Date(log.changedAt), "MMM d, yyyy h:mm a")}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">{Number(log.newAmount).toLocaleString()}</p>
                                            <p className="text-xs text-muted-foreground line-through">{Number(log.previousAmount).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    {log.reason && (
                                        <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
                                            {log.reason}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="hidden sm:block overflow-x-auto pb-4 scrollbar-thin">
                            <Table className="min-w-full">
                                <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md border-b border-border/50">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px] py-3">Date</TableHead>
                                        <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px] py-3">Changed By</TableHead>
                                        <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px] py-3 text-right">Old</TableHead>
                                        <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px] py-3 text-right">New</TableHead>
                                        <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px] py-3">Reason</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((log) => (
                                        <TableRow key={log.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {format(new Date(log.changedAt), "MMM d, yyyy")}
                                            </TableCell>
                                            <TableCell>
                                                {log.editor?.name || "System"}
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {Number(log.previousAmount).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-right font-medium">
                                                {Number(log.newAmount).toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={log.reason || ""}>
                                                {log.reason || "-"}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </div>
        </ResponsiveDialog>
    );
}
