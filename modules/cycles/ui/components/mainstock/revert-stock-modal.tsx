"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface EditStockLogModalProps {
    log: {
        id: string;
        type: string;
        amount: string | number;
        note?: string | null;
    };
}

export const EditStockLogModal = ({ log }: EditStockLogModalProps) => {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState(log.amount.toString());
    const [note, setNote] = useState(log.note || "");
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.officer.stock.correctStockLog.mutationOptions({
            onSuccess: async () => {
                toast.success("Transaction corrected");
                await queryClient.invalidateQueries(trpc.officer.stock.getHistory.pathFilter());
                await queryClient.invalidateQueries(trpc.officer.farmers.getDetails.pathFilter());
                setOpen(false);
            },
            onError: (err) => {
                toast.error(err.message || "Failed to correct transaction");
            }
        })
    );

    const isEditable = log.type !== "CYCLE_CLOSE";

    if (!isEditable) return null;

    const handleSave = () => {
        const amountVal = parseFloat(amount);
        if (isNaN(amountVal)) {
            toast.error("Invalid amount");
            return;
        }

        mutation.mutate({
            logId: log.id,
            newAmount: amountVal,
            note: note || undefined
        });
    };

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                onClick={() => setOpen(true)}
                title="Edit Transaction"
            >
                <Pencil className="h-3.5 w-3.5" />
            </Button>

            <ResponsiveDialog
                open={open}
                onOpenChange={setOpen}
                title="Edit Transaction"
                description="Fix a typo in the amount or note. The farmer's total stock will be adjusted by the difference."
            >
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Amount (Bags)</Label>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="e.g. 10"
                        />
                        <p className="text-[10px] text-muted-foreground italic">
                            Original count: {log.amount} bags
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label>Note / Reason</Label>
                        <Input
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            placeholder="Reason for correction"
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            className="bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            onClick={handleSave}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? "Saving..." : "Save Corrections"}
                        </Button>
                    </div>
                </div>
            </ResponsiveDialog>
        </>
    );
};

interface RevertStockModalProps {
    logId: string;
    amount: number | string;
    note?: string | null;
}

export const RevertStockModal = ({ logId, amount, note }: RevertStockModalProps) => {
    const [open, setOpen] = useState(false);
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.officer.stock.revertStockLog.mutationOptions({
            onSuccess: async () => {
                toast.success("Transaction reverted");
                await queryClient.invalidateQueries(trpc.officer.stock.getHistory.pathFilter());
                await queryClient.invalidateQueries(trpc.officer.farmers.getDetails.pathFilter());
                setOpen(false);
            },
            onError: (err) => {
                toast.error(err.message || "Failed to revert transaction");
            }
        })
    );

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-rose-500 dark:text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                onClick={() => setOpen(true)}
                title="Revert Transaction"
            >
                <RotateCcw className="h-3.5 w-3.5" />
            </Button>

            <ResponsiveDialog
                open={open}
                onOpenChange={setOpen}
                title="Revert Transaction"
                description="This will create a correction entry to negate this transaction. Are you sure?"
            >
                <div className="space-y-4 py-4 px-1">
                    <div className="rounded-md bg-muted/30 p-3 text-sm border border-border/50">
                        <p className="font-medium text-foreground">Entry to Revert:</p>
                        <div className="flex justify-between mt-1 text-muted-foreground">
                            <span>Amount</span>
                            <span className="font-mono font-bold">{amount} Bags</span>
                        </div>
                        <p className="text-xs text-muted-foreground/70 mt-1 italic">{note || "No note"}</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => mutation.mutate({ logId })}
                            disabled={mutation.isPending}
                            className="text-destructive-foreground hover:bg-destructive/90 transition-colors"
                        >
                            {mutation.isPending ? "Reverting..." : "Confirm Revert"}
                        </Button>
                    </div>
                </div>
            </ResponsiveDialog>
        </>
    );
};
