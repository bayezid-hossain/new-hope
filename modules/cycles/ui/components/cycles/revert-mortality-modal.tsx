"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RevertMortalityModalProps {
    logId: string;
    amount: number;
    note?: string | null;
}

export const RevertMortalityModal = ({ logId, amount, note }: RevertMortalityModalProps) => {
    const [open, setOpen] = useState(false);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.officer.cycles.revertCycleLog.mutationOptions({
            onSuccess: async () => {
                toast.success("Mortality log reverted");
                await queryClient.invalidateQueries(trpc.officer.cycles.getDetails.pathFilter());
                setOpen(false);
            },
            onError: (err) => {
                toast.error(err.message || "Failed to revert log");
            }
        })
    );

    return (
        <>
            <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 ml-auto transition-colors"
                onClick={() => setOpen(true)}
                title="Revert Change"
            >
                <RotateCcw className="h-3 w-3" />
            </Button>

            <ResponsiveDialog
                open={open}
                onOpenChange={setOpen}
                title="Revert Mortality Log"
                description="This will undo the mortality entry and creating a correction log."
            >
                <div className="space-y-4 py-4">
                    <div className="rounded-md bg-muted/30 p-3 text-sm border border-border/50">
                        <p className="font-medium text-foreground">Entry to Revert:</p>
                        <div className="flex justify-between mt-1 text-muted-foreground font-medium">
                            <span>Mortality</span>
                            <span className="font-mono font-bold text-destructive">-{amount} Birds</span>
                        </div>
                        <p className="text-xs text-muted-foreground/70 mt-1 italic">{note || "No note"}</p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            variant="destructive"
                            onClick={() => mutation.mutate({ logId })}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? "Reverting..." : "Confirm Revert"}
                        </Button>
                    </div>
                </div>
            </ResponsiveDialog>
        </>
    );
};
