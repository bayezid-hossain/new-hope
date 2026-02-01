"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface RestoreFarmerModalProps {
    farmerId: string;
    archivedName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
}

export const RestoreFarmerModal = ({
    farmerId,
    archivedName,
    open,
    onOpenChange,
    orgId,
}: RestoreFarmerModalProps) => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    // Parse original name from archived name (OriginalName_SHORTID)
    const lastUnderscoreIndex = archivedName.lastIndexOf("_");
    const originalName = lastUnderscoreIndex !== -1
        ? archivedName.substring(0, lastUnderscoreIndex)
        : archivedName;

    const [name, setName] = useState(originalName);

    useEffect(() => {
        if (open) {
            setName(originalName);
        }
    }, [open, originalName]);

    const restoreMutation = useMutation(
        trpc.management.farmers.restore.mutationOptions({
            onSuccess: () => {
                toast.success("Farmer profile restored successfully");
                queryClient.invalidateQueries({ queryKey: [["management", "farmers"]] });
                queryClient.invalidateQueries({ queryKey: [["management", "farmers", "getManagementHub"]] });
                queryClient.invalidateQueries({ queryKey: [["officer", "farmers"]] });
                onOpenChange(false);
            },
            onError: (error) => toast.error(error.message),
        })
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        restoreMutation.mutate({
            farmerId,
            orgId,
            newName: name.trim().toUpperCase()
        });
    };

    return (
        <ResponsiveDialog
            title="Restore Farmer Profile"
            description="Restore this farmer and all their historical records. You can provide a new name if the original one is already taken by another active farmer."
            open={open}
            onOpenChange={onOpenChange}
        >
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label htmlFor="restore-name">Restore as Name</Label>
                    <Input
                        id="restore-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter farmer name"
                        className="uppercase"
                        autoFocus
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={restoreMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" className="gap-2" disabled={restoreMutation.isPending || !name.trim()}>
                        <RotateCcw className={`h-4 w-4 ${restoreMutation.isPending ? "animate-spin" : ""}`} />
                        {restoreMutation.isPending ? "Restoring..." : "Restore Profile"}
                    </Button>
                </div>
            </form>
        </ResponsiveDialog>
    );
};
