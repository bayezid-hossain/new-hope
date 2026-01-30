"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

interface EditFarmerNameModalProps {
    farmerId: string;
    currentName: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const EditFarmerNameModal = ({
    farmerId,
    currentName,
    open,
    onOpenChange,
}: EditFarmerNameModalProps) => {
    const trpc = useTRPC();
    const { orgId } = useCurrentOrg();
    const queryClient = useQueryClient();
    const [name, setName] = useState(currentName);

    const updateMutation = useMutation(
        trpc.officer.farmers.updateName.mutationOptions({
            onSuccess: () => {
                toast.success("Farmer name updated successfully");
                queryClient.invalidateQueries(trpc.officer.farmers.getDetails.queryOptions({ farmerId }));
                queryClient.invalidateQueries(trpc.officer.farmers.listWithStock.queryOptions({ orgId: orgId! }));
                queryClient.invalidateQueries(trpc.officer.cycles.listActive.queryOptions({ orgId: orgId! }));
                // Invalidate admin queries too just in case
                queryClient.invalidateQueries(trpc.admin.cycles.listActive.queryOptions({ orgId: orgId! }));
                // Invalidate farmer lists (Officer, Management, Admin)
                queryClient.invalidateQueries({ queryKey: [["management", "farmers", "getMany"]] });
                queryClient.invalidateQueries({ queryKey: [["management", "farmers", "getOrgFarmers"]] });
                queryClient.invalidateQueries({ queryKey: [["officer", "farmers", "getMany"]] });
                onOpenChange(false);
            },
            onError: (error) => toast.error(error.message),
        })
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        updateMutation.mutate({
            id: farmerId,
            name: name.trim(),
            orgId: orgId!
        });
    };

    return (
        <ResponsiveDialog
            title="Edit Farmer Name"
            description="Update the name of this farmer. This will be reflected across all records."
            open={open}
            onOpenChange={onOpenChange}
        >
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Farmer Name</Label>
                    <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter farmer name"
                        className="uppercase"
                    />
                </div>

                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={updateMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={updateMutation.isPending || !name.trim() || name === currentName}>
                        {updateMutation.isPending ? "Saving..." : "Save Changes"}
                    </Button>
                </div>
            </form>
        </ResponsiveDialog>
    );
};
