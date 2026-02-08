"use client";

import { useLoading } from "@/components/providers/loading-provider";
import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ShoppingCart, XCircle } from "lucide-react";
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

  const [intakeStock, setIntake] = useState<string>(intake?.toString() || "0");
  const [showSellModal, setShowSellModal] = useState(false);
  const [confirmNoSale, setConfirmNoSale] = useState(false);

  // Reset confirmation state when modal opens/closes
  useEffect(() => {
    if (open) {
      setIntake(intake?.toString() || "0");
      setConfirmNoSale(false);
    }
  }, [intake, open]);

  const { showLoading } = useLoading();
  const endMutation = useMutation(
    trpc.officer.cycles.end.mutationOptions({
      onSuccess: async () => {
        toast.success("Cycle ended successfully");

        const baseOptions = { orgId: orgId! };

        await Promise.all([
          queryClient.invalidateQueries(trpc.officer.cycles.listActive.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.officer.cycles.listPast.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.management.cycles.listActive.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.management.cycles.listPast.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.admin.cycles.listActive.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.admin.cycles.listPast.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.management.farmers.getOrgFarmers.queryOptions(baseOptions)),
        ]);

        onOpenChange(false);
        setIntake(intakeStock.toString());
        setConfirmNoSale(false);
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const handleEndCycle = () => {
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

          {/* No Sale Confirmation Warning */}
          {confirmNoSale && (
            <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/10 dark:bg-amber-500/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-start gap-3">
                <div className="shrink-0 rounded-full bg-amber-500/20 p-2">
                  <XCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-semibold text-amber-700 dark:text-amber-300">No Sale Report!</p>
                  <p className="text-sm text-amber-600/90 dark:text-amber-400/80 mt-1">
                    You are about to end this cycle <strong>without recording a sale</strong>. This means:
                  </p>
                  <ul className="mt-2 list-disc list-inside text-sm text-amber-600/90 dark:text-amber-400/80 space-y-0.5">
                    <li>No revenue will be recorded</li>
                    <li>Profit calculations will show zero income</li>
                    <li>Birds will be marked as unaccounted</li>
                  </ul>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setConfirmNoSale(false)}
                  disabled={endMutation.isPending}
                >
                  Go Back
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  onClick={handleEndCycle}
                  disabled={endMutation.isPending}
                >
                  {endMutation.isPending ? "Archiving..." : "Yes, End Anyway"}
                </Button>
              </div>
            </div>
          )}

          {/* Buttons (Hide when confirming no sale) */}
          {!confirmNoSale && (
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
                onClick={() => setConfirmNoSale(true)}
                disabled={endMutation.isPending}
                className="text-white"
              >
                End Without Sale
              </Button>
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={endMutation.isPending}
              >
                Cancel
              </Button>
            </div>
          )}
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
