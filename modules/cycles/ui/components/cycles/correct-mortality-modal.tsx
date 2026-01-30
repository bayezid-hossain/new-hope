"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface CorrectMortalityModalProps {
    cycleId: string;
    currentMortality: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CorrectMortalityModal = ({
    cycleId,
    currentMortality,
    open,
    onOpenChange
}: CorrectMortalityModalProps) => {
    const [newTotal, setNewTotal] = useState(currentMortality.toString());
    const [reason, setReason] = useState("");

    // Sync state when prop changes or modal opens
    useEffect(() => {
        if (open) {
            setNewTotal(currentMortality.toString());
        }
    }, [currentMortality, open]);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.officer.cycles.correctMortality.mutationOptions({
            onSuccess: async () => {
                toast.success("Mortality Corrected");
                // Invalidate relevant queries
                await Promise.all([
                    queryClient.invalidateQueries(trpc.officer.cycles.getDetails.pathFilter()),
                    queryClient.invalidateQueries(trpc.officer.cycles.listActive.pathFilter()),
                    // Also invalidate admin/manager lists if needed, though usually officer view is sufficient
                    queryClient.invalidateQueries({ queryKey: [["management", "cycles", "listActive"]] }),
                    queryClient.invalidateQueries({ queryKey: [["admin", "cycles", "listActive"]] })
                ]);
                onOpenChange(false);
                setReason("");
            },
            onError: (err) => {
                toast.error(err.message || "Failed to correct mortality");
            }
        })
    );

    const handleSubmit = () => {
        const val = parseInt(newTotal);
        if (isNaN(val) || val < 0) {
            toast.error("Invalid mortality value");
            return;
        }
        if (!reason || reason.length < 3) {
            toast.error("Reason is required (min 3 chars)");
            return;
        }

        mutation.mutate({
            cycleId,
            newTotalMortality: val,
            reason
        });
    };

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Correct Total Mortality"
            description="Update the total mortality count for this cycle. Logic checks will apply."
        >
            <div className="space-y-4 py-4">
                <div className="space-y-2">
                    <Label>New Total Mortality</Label>
                    <Input
                        type="number"
                        value={newTotal}
                        onChange={(e) => setNewTotal(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                        Current recorded total: {currentMortality} birds
                    </p>
                </div>
                <div className="space-y-2">
                    <Label>Reason for Correction</Label>
                    <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Miscount discovered, data entry error"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={mutation.isPending}
                    >
                        {mutation.isPending ? "Saving..." : "Save Correction"}
                    </Button>
                </div>
            </div>
        </ResponsiveDialog>
    );
};
