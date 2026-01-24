"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Plus, RefreshCcw, Wheat } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
// Ensure these paths match your file structure
import LoadingState from "@/components/loading-state";
import { AddFeedModal } from "@/modules/cycles/ui/components/mainstock/add-feed-modal";
import { CreateFarmerModal } from "@/modules/cycles/ui/components/mainstock/create-farmer-modal";
import { TransferStockModal } from "@/modules/cycles/ui/components/mainstock/transfer-stock-modal";

export default function MainStockPage() {
  const { orgId } = useCurrentOrg();
  const trpc = useTRPC();

  const { data, isPending, refetch, isRefetching } = useQuery(
    trpc.mainstock.getDashboard.queryOptions({
      orgId: orgId!,
      page: 1,
      pageSize: 50
    }, { enabled: !!orgId })
  );

  const [feedModal, setFeedModal] = useState<{ open: boolean; farmerId: string | null }>({
    open: false,
    farmerId: null
  });

  const [createModal, setCreateModal] = useState(false);

  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    data: { farmerId: string; farmerName: string; currentStock: number } | null;
  }>({
    open: false,
    data: null
  });

  if (!orgId) return null;
  if (isPending) return <div className="p-8"><LoadingState title="Stock Information" description="Loading stock information..." /></div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Main Stock Inventory</h1>
          <p className="text-muted-foreground">Manage centralized feed stock for all farmers.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isRefetching}
            title="Sync Data"
          >
            <RefreshCcw className={`h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => setCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Register Farmer
          </Button>
        </div>
      </div>

      {/* Main Data Table */}
      <div className="border rounded-md bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Farmer</TableHead>
              <TableHead>Active Cycles</TableHead>
              <TableHead className="w-[300px]">Main Stock Usage</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.items.map((row) => {
              // Ensure we fallback to 0 safely
              const consumed = row.totalConsumed || 0;
              const remainingStock = row.mainStock || 0;
              const percentUsed = remainingStock > 0 ? (consumed / remainingStock) * 100 : 0;
              const total = Number(remainingStock) + Number(consumed);
              return (
                <TableRow key={row.id}>
                  <TableCell>
                    <Link href={`/farmers/${row.id}`} className="font-medium hover:underline hover:text-primary transition-colors">
                      {row.name}
                    </Link>
                  </TableCell>

                  <TableCell>
                    <div className="grid grid-cols-2 gap-2">
                      {row.activeCycles.map((c: any) => (
                        <Badge key={c.id} variant="secondary" className="text-xs font-normal border-gray-200 justify-center">
                          {/* Adjust 'c.name' if your schema uses 'cycleId' or similar */}
                          Cycle <span className="text-muted-foreground ml-1">(Age: {c.age})</span>
                        </Badge>
                      ))}
                      {row.activeCycles.length === 0 && <span className="text-muted-foreground text-xs italic col-span-2">No active cycles</span>}
                    </div>
                  </TableCell>

                  <TableCell>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">
                          {/* ✅ FIXED: Added .toFixed(1) and fallback */}
                          Consumed: <span className="text-foreground font-medium">{consumed.toFixed(1)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Total: <span className="text-foreground font-medium">{total.toFixed(1)}</span>
                        </span>
                        <span className="text-muted-foreground">
                          Active: <span className="text-foreground font-medium">{row.activeConsumption.toFixed(1)}</span>
                        </span>

                      </div>
                      <Progress
                        value={percentUsed}
                        className={percentUsed > 90 ? "bg-red-500" : percentUsed > 75 ? "bg-amber-500" : "bg-primary"}
                      />
                    </div>
                  </TableCell>

                  <TableCell className="text-right">
                    {/* ✅ FIXED: Added .toFixed(1) */}
                    <div className={`text-lg font-bold tabular-nums ${row.isLowStock ? "text-red-600" : "text-green-600"}`}>
                      {row.remainingStock.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Bags Available</div>
                  </TableCell>

                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setTransferModal({
                          open: true,
                          data: {
                            farmerId: row.id,
                            farmerName: row.name,
                            currentStock: row.remainingStock
                          }
                        })}
                      >
                        <ArrowRightLeft className="h-4 w-4 mr-2" /> Transfer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFeedModal({ open: true, farmerId: row.id })}
                      >
                        <Wheat className="h-4 w-4 mr-2" /> Restock
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* --- DIALOGS --- */}

      <ResponsiveDialog
        open={feedModal.open}
        onOpenChange={(v) => setFeedModal(prev => ({ ...prev, open: v }))}
        title="Restock Inventory"
        description="Add bags of feed to the farmer's main warehouse."
      >
        {feedModal.farmerId && (
          <AddFeedModal
            id={feedModal.farmerId}
            // Pass open state if your component needs it, otherwise just ID is usually enough
            open={feedModal.open}
            onOpenChange={(v) => setFeedModal(prev => ({ ...prev, open: v }))}
          />
        )}
      </ResponsiveDialog>

      {/* ✅ FIXED: Removed double wrapping. CreateFarmerModal already has ResponsiveDialog inside it */}
      <CreateFarmerModal
        open={createModal}
        onOpenChange={setCreateModal}
      />

      {transferModal.data && (
        <TransferStockModal
          open={transferModal.open}
          onOpenChange={(v) => setTransferModal(prev => ({ ...prev, open: v }))}
          sourceFarmerId={transferModal.data.farmerId}
          sourceFarmerName={transferModal.data.farmerName}
          currentStock={transferModal.data.currentStock}
        />
      )}

    </div>
  );
}