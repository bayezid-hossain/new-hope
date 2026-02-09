"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface EditAgeModalProps {
    cycleId: string;
    currentAge: number;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export const EditAgeModal = ({ cycleId, currentAge, open: controlledOpen, onOpenChange: controlledOnOpenChange }: EditAgeModalProps) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = controlledOnOpenChange ?? setInternalOpen;
    const { canEdit } = useCurrentOrg();

    const [newAge, setNewAge] = useState(currentAge.toString());
    const [reason, setReason] = useState("");

    // Sync state when prop changes or modal opens
    useEffect(() => {
        if (open) {
            setNewAge(currentAge.toString());
        }
    }, [currentAge, open]);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.officer.cycles.correctAge.mutationOptions({
            onSuccess: async () => {
                toast.success("Age Updated");
                await queryClient.invalidateQueries(trpc.officer.cycles.getDetails.pathFilter());
                await queryClient.invalidateQueries(trpc.officer.cycles.listActive.pathFilter());
                setOpen(false);
                setReason("");
            },
            onError: (err) => {
                toast.error(err.message || "Failed to update Age");
            }
        })
    );

    const handleSubmit = () => {
        const ageVal = parseInt(newAge);
        if (isNaN(ageVal) || ageVal <= 0) {
            toast.error("Invalid Age value");
            return;
        }
        if (!reason || reason.length < 3) {
            toast.error("Reason is required (min 3 chars)");
            return;
        }

        mutation.mutate({
            cycleId,
            newAge: ageVal,
            reason
        });
    };

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={setOpen}
            title="Edit Cycle Age"
            description="Correct current age of the birds. This will recalculate feed consumption."
        >
            <div className="space-y-4 py-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm rounded-md border border-amber-100 dark:border-amber-800">
                    <div className="flex items-center gap-2 font-semibold">
                        <CalendarClock className="h-4 w-4" />
                        Warning
                    </div>
                    Changing the age shifts the cycle start date. Feed consumption will be completely recalculated based on the new timeline.
                </div>

                <div className="space-y-2">
                    <Label>Correct Age (Days)</Label>
                    <Input
                        type="number"
                        max={34}
                        value={newAge}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            if (val > 34) {
                                toast.error("Maximum age is 34 days");
                                return;
                            }
                            setNewAge(e.target.value);
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <Label>Reason for Change</Label>
                    <Input
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Created late, adjusted start date"
                    />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={mutation.isPending || !canEdit}
                    >
                        {mutation.isPending ? "Saving..." : "Save Change"}
                    </Button>
                </div>
            </div>
        </ResponsiveDialog>
    );
};
