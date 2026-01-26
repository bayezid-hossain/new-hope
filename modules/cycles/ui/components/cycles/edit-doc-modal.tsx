"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface EditDocModalProps {
    cycleId: string;
    currentDoc: number;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export const EditDocModal = ({ cycleId, currentDoc, open: controlledOpen, onOpenChange: controlledOnOpenChange }: EditDocModalProps) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = controlledOnOpenChange ?? setInternalOpen;

    const [newDoc, setNewDoc] = useState(currentDoc.toString());
    const [reason, setReason] = useState("");

    // Sync state when prop changes or modal opens
    useEffect(() => {
        if (open) {
            setNewDoc(currentDoc.toString());
        }
    }, [currentDoc, open]);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const mutation = useMutation(
        trpc.officer.cycles.correctDoc.mutationOptions({
            onSuccess: async () => {
                toast.success("DOC Updated");
                await queryClient.invalidateQueries(trpc.officer.cycles.getDetails.pathFilter());
                await queryClient.invalidateQueries(trpc.officer.cycles.listActive.pathFilter());
                setOpen(false);
                setReason("");
            },
            onError: (err) => {
                toast.error(err.message || "Failed to update DOC");
            }
        })
    );

    const handleSubmit = () => {
        const docVal = parseInt(newDoc);
        if (isNaN(docVal) || docVal <= 0) {
            toast.error("Invalid DOC value");
            return;
        }
        if (!reason || reason.length < 3) {
            toast.error("Reason is required (min 3 chars)");
            return;
        }

        mutation.mutate({
            cycleId,
            newDoc: docVal,
            reason
        });
    };

    return (
        <>
            {!controlledOpen && (
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 ml-2 text-slate-400 hover:text-primary hover:bg-primary/10"
                    onClick={() => setOpen(true)}
                    title="Edit Initial Birds (DOC)"
                >
                    <Pencil className="h-3 w-3" />
                </Button>
            )}

            <ResponsiveDialog
                open={open}
                onOpenChange={setOpen}
                title="Edit DOC (Initial Birds)"
                description="Correct the initial bird count if it was entered incorrectly."
            >
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Correct Bird Count</Label>
                        <Input
                            type="number"
                            value={newDoc}
                            onChange={(e) => setNewDoc(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Reason for Change</Label>
                        <Input
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="e.g. Typo during creation"
                        />
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleSubmit}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? "Saving..." : "Save Change"}
                        </Button>
                    </div>
                </div>
            </ResponsiveDialog>
        </>
    );
};
