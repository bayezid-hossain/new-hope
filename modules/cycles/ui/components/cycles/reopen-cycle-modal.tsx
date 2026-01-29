"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface ReopenCycleModalProps {
    historyId: string;
    farmerId?: string;
    cycleName: string;
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export const ReopenCycleModal = ({ historyId, farmerId, cycleName, trigger, open: controlledOpen, onOpenChange: controlledOnOpenChange }: ReopenCycleModalProps) => {
    const [internalOpen, setInternalOpen] = useState(false);
    const open = controlledOpen ?? internalOpen;
    const setOpen = controlledOnOpenChange ?? setInternalOpen;

    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { orgId } = useCurrentOrg();

    const mutation = useMutation(
        trpc.officer.cycles.reopenCycle.mutationOptions({
            onSuccess: async () => {
                toast.success("Cycle reopened successfully");
                const baseOptions = { orgId: orgId! };
                // Invalidate across ALL routers to ensure all views update
                await Promise.all([
                    queryClient.invalidateQueries(trpc.admin.cycles.listPast.queryOptions(baseOptions)),
                    queryClient.invalidateQueries(trpc.officer.cycles.listPast.queryOptions(baseOptions)),
                    queryClient.invalidateQueries(trpc.management.cycles.listPast.queryOptions(baseOptions)),

                    queryClient.invalidateQueries(trpc.admin.cycles.listActive.queryOptions(baseOptions)),
                    queryClient.invalidateQueries(trpc.officer.cycles.listActive.queryOptions(baseOptions)),
                    queryClient.invalidateQueries(trpc.management.cycles.listActive.queryOptions(baseOptions)),

                    // Invalidate detailed farmer views
                    queryClient.invalidateQueries(trpc.officer.farmers.getDetails.pathFilter()),
                    farmerId ? queryClient.invalidateQueries(trpc.management.farmers.getManagementHub.queryOptions({ farmerId, orgId: orgId! })) : Promise.resolve(),
                    queryClient.invalidateQueries(trpc.management.farmers.getOrgFarmers.queryOptions(baseOptions)),
                ]);
                setOpen(false);
            },
            onError: (err: any) => {
                toast.error(err.message || "Failed to reopen cycle");
            }
        })
    );

    return (
        <>
            {controlledOpen === undefined && (
                trigger ? (
                    <div onClick={() => setOpen(true)}>{trigger}</div>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setOpen(true)}
                    >
                        <RotateCcw className="h-4 w-4" />
                        Reopen Cycle
                    </Button>
                )
            )}

            <ResponsiveDialog
                open={open}
                onOpenChange={setOpen}
                title="Reopen Cycle"
                description={`Are you sure you want to reopen "${cycleName}"?`}
            >
                <div className="space-y-4 py-4">
                    <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-sm text-amber-900">
                        <p className="font-semibold">Important Notes:</p>
                        <ul className="list-disc ml-4 mt-2 space-y-1">
                            <li>This will restore the cycle to "Active" status.</li>
                            <li>The feed consumption recorded at end of cycle will be **added back** to the farmer's main stock.</li>
                            <li>Audit logs will track this reopening.</li>
                        </ul>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                        <Button
                            className="bg-primary text-white"
                            onClick={() => mutation.mutate({ historyId })}
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? "Reopening..." : "Confirm Reopen"}
                        </Button>
                    </div>
                </div>
            </ResponsiveDialog>
        </>
    );
};
