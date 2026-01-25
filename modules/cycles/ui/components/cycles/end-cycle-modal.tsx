"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Import Input
import { Label } from "@/components/ui/label"; // Import Label
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface EndCycleModalProps {
  cycleId: string;
  farmerName: string;
  open: boolean;
  intake: number;
  onOpenChange: (open: boolean) => void;
}

export const EndCycleModal = ({
  cycleId,
  farmerName,
  open,
  intake,
  onOpenChange,
}: EndCycleModalProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrg()
  // State to track manual remaining stock
  const [intakeStock, setIntake] = useState<string>(intake?.toString() || "0");

  const endMutation = useMutation(
    trpc.officer.cycles.end.mutationOptions({
      onSuccess: async () => {
        toast.success("Cycle ended successfully");
        // Invalidate both Active (removed) and Past (added) queries
        await queryClient.invalidateQueries(trpc.officer.cycles.listActive.queryOptions({ orgId: orgId! }));
        await queryClient.invalidateQueries(trpc.officer.cycles.listPast.queryOptions({ orgId: orgId! }));
        onOpenChange(false);
        setIntake(intakeStock.toString()); // Reset
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const handleEndCycle = () => {
    // Validate input
    const stockValue = parseFloat(intakeStock.toString());
    if (isNaN(stockValue) || stockValue < 0) {
      toast.error("Please enter a valid intake amount");
      return;
    }

    endMutation.mutate({
      id: cycleId,
      intake: stockValue
    });
  };

  return (
    <ResponsiveDialog
      title="Confirm End Cycle"
      description="Are you sure you want to end this cycle?"
      open={open}
      onOpenChange={onOpenChange}
    >
      <div className="space-y-6 pt-2">
        {/* Warning Box */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p>
            This will archive <strong>{farmerName}</strong>. This action cannot be undone.
          </p>
        </div>

        {/* Input Section */}
        <div className="space-y-2">
          <Label htmlFor="stock">Physical Stock Intake (Bags)</Label>
          <Input
            id="stock"
            type="number"
            step="1.00"
            min="0"
            placeholder={intakeStock.toString()}
            value={intakeStock}
            onChange={(e) => setIntake(e.target.value)}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Enter the actual number of bags physically eaten.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2">
          <Button
            variant="destructive"
            onClick={handleEndCycle}
            disabled={endMutation.isPending}
          >
            {endMutation.isPending ? "Archiving..." : "Confirm & End Cycle"}
          </Button>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={endMutation.isPending}
          >
            Cancel
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
};