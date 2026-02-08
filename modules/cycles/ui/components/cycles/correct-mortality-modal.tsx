"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Edit2, Loader2, Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CorrectMortalityModalProps {
    cycleId: string;
    currentMortality: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CorrectMortalityModal = ({
    cycleId,
    open,
    onOpenChange,
}: CorrectMortalityModalProps) => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [editingLogId, setEditingLogId] = useState<string | null>(null);
    const [editAmount, setEditAmount] = useState<string>("");
    const [editDate, setEditDate] = useState<Date | undefined>(undefined);

    // Fetch Logs
    const { data: cycleData, isLoading } = useQuery(
        trpc.officer.cycles.getDetails.queryOptions(
            { id: cycleId },
            { enabled: open }
        )
    );

    const mortalityLogs =
        cycleData?.logs?.filter((l) => l.type === "MORTALITY") || [];

    // Mutations
    const updateMutation = useMutation(
        trpc.officer.cycles.updateMortalityLog.mutationOptions({
            onSuccess: () => {
                toast.success("Log updated");
                invalidateQueries();
                setEditingLogId(null);
            },
            onError: (err) => toast.error(err.message),
        })
    );

    const deleteMutation = useMutation(
        trpc.officer.cycles.revertCycleLog.mutationOptions({
            onSuccess: () => {
                toast.success("Log reverted");
                invalidateQueries();
            },
            onError: (err) => toast.error(err.message),
        })
    );

    const invalidateQueries = () => {
        queryClient.invalidateQueries(trpc.officer.cycles.getDetails.pathFilter());
        queryClient.invalidateQueries(trpc.officer.cycles.listActive.pathFilter());
    };

    const handleEdit = (log: any) => {
        setEditingLogId(log.id);
        setEditAmount(log.valueChange.toString());
        setEditDate(new Date(log.createdAt));
    };

    const handleSave = () => {
        if (!editingLogId) return;
        const amount = parseInt(editAmount);
        if (isNaN(amount) || amount < 0) {
            toast.error("Invalid amount");
            return;
        }
        updateMutation.mutate({
            logId: editingLogId,
            newAmount: amount,
            newDate: editDate,
            reason: "Correction via Modal",
        });
    };

    const handleDelete = (logId: string) => {
        if (confirm("Are you sure you want to revert this mortality entry?")) {
            deleteMutation.mutate({ logId });
        }
    };

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Manage Mortality History"
            description="View and edit historical mortality records. Feed consumption will be recalculated."
            className="max-w-2xl"
        >
            <div className="space-y-4 py-4">
                {isLoading ? (
                    <div className="flex justify-center p-4">
                        <Loader2 className="animate-spin h-6 w-6" />
                    </div>
                ) : mortalityLogs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                        No mortality logs found.
                    </p>
                ) : (
                    <div className="border rounded-md max-h-[300px] overflow-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date Reported</TableHead>
                                    <TableHead>Recorded Date</TableHead>
                                    <TableHead>Amount</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {mortalityLogs.map((log) => {
                                    const isEditing = editingLogId === log.id;

                                    return (
                                        <TableRow key={log.id}>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {format(new Date(log.createdAt), "dd MMM yyyy")}
                                            </TableCell>
                                            <TableCell>
                                                {isEditing ? (
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant={"outline"}
                                                                size="sm"
                                                                className={cn(
                                                                    "w-[130px] justify-start text-left font-normal",
                                                                    !editDate && "text-muted-foreground"
                                                                )}
                                                            >
                                                                {editDate ? (
                                                                    format(editDate, "dd/MM/yyyy")
                                                                ) : (
                                                                    <span>Pick a date</span>
                                                                )}
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-auto p-0">
                                                            <Calendar
                                                                mode="single"
                                                                selected={editDate}
                                                                onSelect={setEditDate}
                                                                initialFocus
                                                            />
                                                        </PopoverContent>
                                                    </Popover>
                                                ) : (
                                                    format(new Date(log.createdAt), "dd/MM/yyyy")
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {isEditing ? (
                                                    <Input
                                                        type="number"
                                                        className="h-8 w-20"
                                                        value={editAmount}
                                                        onChange={(e) => setEditAmount(e.target.value)}
                                                    />
                                                ) : (
                                                    <span className="font-medium text-red-600">
                                                        +{log.valueChange}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {isEditing ? (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => setEditingLogId(null)}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="default"
                                                            onClick={handleSave}
                                                            disabled={updateMutation.isPending}
                                                        >
                                                            <Save className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-end gap-2">
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            onClick={() => handleEdit(log)}
                                                        >
                                                            <Edit2 className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="text-destructive hover:text-destructive"
                                                            onClick={() => handleDelete(log.id)}
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}
                <div className="flex justify-end pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </div>
            </div>
        </ResponsiveDialog>
    );
};
