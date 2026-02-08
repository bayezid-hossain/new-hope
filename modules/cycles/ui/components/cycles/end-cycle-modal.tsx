"use client";

import { useLoading } from "@/components/providers/loading-provider";
import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input"; // Import Input
import { Label } from "@/components/ui/label"; // Import Label
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ShoppingCart } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SellModal } from "./sell-modal";

interface EndCycleModalProps {
  cycleId: string;
  cycleName: string;
  farmerName: string;
  farmerLocation?: string | null;
  farmerMobile?: string | null;
  startDate: Date;
  open: boolean;
  age: number;
  intake: number;
  doc: number;
  mortality: number;
  birdsSold: number;
  prefix?: string;
  onOpenChange: (open: boolean) => void;
}

export const EndCycleModal = ({
  cycleId,
  cycleName,
  farmerName,
  startDate,
  farmerLocation,
  farmerMobile,
  open,
  age,
  intake,
  doc,
  mortality,
  birdsSold,
  prefix,
  onOpenChange,
}: EndCycleModalProps) => {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrg()
  // State to track manual remaining stock
  const [intakeStock, setIntake] = useState<string>(intake?.toString() || "0");
  const [showSellModal, setShowSellModal] = useState(false);

  // Sync state when prop changes or modal opens
  useEffect(() => {
    if (open) {
      setIntake(intake?.toString() || "0");
    }
  }, [intake, open]);

  const { showLoading } = useLoading();
  const endMutation = useMutation(
    trpc.officer.cycles.end.mutationOptions({
      onSuccess: async () => {
        toast.success("Cycle ended successfully");

        const baseOptions = { orgId: orgId! };

        // Invalidate both Active (removed) and Past (added) queries across all routers
        await Promise.all([
          queryClient.invalidateQueries(trpc.officer.cycles.listActive.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.officer.cycles.listPast.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.management.cycles.listActive.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.management.cycles.listPast.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.admin.cycles.listActive.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.admin.cycles.listPast.queryOptions(baseOptions)),

          // Invalidate Organization/Farmer summary lists
          queryClient.invalidateQueries(trpc.management.farmers.getOrgFarmers.queryOptions(baseOptions)),
        ]);

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
    <>
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
              variant="default"
              onClick={() => {
                onOpenChange(false);
                setShowSellModal(true);
              }}
              disabled={endMutation.isPending}
              className="gap-2"
            >
              <ShoppingCart className="h-4 w-4" />
              Record Sale & End
            </Button>
            <Button
              variant="destructive"
              onClick={handleEndCycle}
              disabled={endMutation.isPending}
              className="text-white"
            >
              {endMutation.isPending ? "Archiving..." : "End Without Sale"}
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

      <SellModal
        cycleId={cycleId}
        cycleName={cycleName}
        startDate={startDate}
        farmerName={farmerName}
        cycleAge={age}
        farmerLocation={farmerLocation}
        farmerMobile={farmerMobile}
        doc={doc}
        mortality={mortality}
        birdsSold={birdsSold}
        intake={intake}
        open={showSellModal}
        onOpenChange={setShowSellModal}
      />
    </>
  );
};