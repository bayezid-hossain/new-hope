"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RevertTransferButtonProps {
    referenceId: string;
    note?: string | null;
}

export const RevertTransferButton = ({ referenceId, note }: RevertTransferButtonProps) => {
    const [open, setOpen] = useState(false);
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.officer.stock.revertTransfer.mutationOptions({
            onSuccess: async () => {
                toast.success("Transfer reverted successfully");
                await queryClient.invalidateQueries(trpc.officer.stock.getHistory.pathFilter());
                await queryClient.invalidateQueries(trpc.officer.farmers.getDetails.pathFilter());
                setOpen(false);
            },
            onError: (err: any) => {
                toast.error(err.message || "Failed to revert transfer");
            }
        })
    );

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                onClick={() => setOpen(true)}
                title="Revert Transfer"
            >
                <RotateCcw className="h-3.5 w-3.5" />
            </Button>

            <ResponsiveDialog
                open={open}
                onOpenChange={setOpen}
                title="Revert Transfer"
                description="This will reverse both the deducted stock from the sender and the added stock to the receiver. Are you sure?"
            >
                <div className="space-y-4 py-4 px-1">
                    <p className="text-sm text-slate-500">
                        {note || "Linked transaction reversal."}
                    </p>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => mutation.mutate({ referenceId })}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? "Reverting..." : "Revert Both Sides"}
                        </Button>
                    </div>
                </div>
            </ResponsiveDialog>
        </>
    );
};
