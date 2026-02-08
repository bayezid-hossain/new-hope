"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw, Skull } from "lucide-react";
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
                toast.success("Mortality log reverted successfully!");
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
                title="Revert this entry"
            >
                <RotateCcw className="h-3 w-3" />
            </Button>

            <ResponsiveDialog
                open={open}
                onOpenChange={setOpen}
                title="Undo Mortality Entry"
                description="Are you sure you want to undo this mortality log?"
            >
                <div className="space-y-5 py-2">
                    {/* Warning Banner */}
                    <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/30 p-3.5">
                        <div className="shrink-0 rounded-full bg-amber-500/20 p-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="text-sm">
                            <p className="font-semibold text-amber-700 dark:text-amber-300">This action will:</p>
                            <ul className="mt-1 list-disc list-inside text-amber-600/90 dark:text-amber-400/80 space-y-0.5">
                                <li>Restore <span className="font-bold">{amount}</span> birds to the cycle</li>
                                <li>Create a correction log in the history</li>
                                <li>Recalculate feed consumption</li>
                            </ul>
                        </div>
                    </div>

                    {/* Entry Card */}
                    <div className="rounded-xl bg-gradient-to-br from-destructive/5 to-destructive/10 dark:from-destructive/10 dark:to-destructive/5 p-4 border border-destructive/20">
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 rounded-full bg-destructive/20 p-2.5">
                                <Skull className="h-5 w-5 text-destructive" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Entry to Undo</p>
                                <p className="text-2xl font-bold text-destructive tabular-nums">
                                    {amount} <span className="text-base font-medium">Birds</span>
                                </p>
                            </div>
                        </div>
                        {note && (
                            <p className="mt-3 text-sm text-muted-foreground italic border-t border-destructive/10 pt-2.5">
                                &ldquo;{note}&rdquo;
                            </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-1">
                        <Button
                            variant="outline"
                            className="flex-1"
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            className="flex-1 gap-2"
                            onClick={() => mutation.mutate({ logId })}
                            disabled={mutation.isPending}
                        >
                            <RotateCcw className={`h-4 w-4 ${mutation.isPending ? "animate-spin" : ""}`} />
                            {mutation.isPending ? "Undoing..." : "Confirm Undo"}
                        </Button>
                    </div>
                </div>
            </ResponsiveDialog>
        </>
    );
};
