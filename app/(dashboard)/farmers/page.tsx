"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Bird, Plus, RefreshCcw, Search, Wheat } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
// Ensure these paths match your file structure
import LoadingState from "@/components/loading-state";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AddFeedModal } from "@/modules/cycles/ui/components/mainstock/add-feed-modal";
import { CreateFarmerModal } from "@/modules/cycles/ui/components/mainstock/create-farmer-modal";
import { TransferStockModal } from "@/modules/cycles/ui/components/mainstock/transfer-stock-modal";
import { ChevronRight } from "lucide-react";
import { useDebounce } from "use-debounce";

// --- Mobile Stock Card Component ---
const MobileStockCard = ({
  row,
  onTransfer,
  onRestock
}: {
  row: any;
  onTransfer: (data: any) => void;
  onRestock: (id: string) => void;
}) => {
  const mainStock = row.mainStock || 0;
  const activeConsumption = row.activeConsumption || 0;
  const effectiveRemaining = mainStock - activeConsumption;
  const percentUsed = mainStock > 0 ? (activeConsumption / mainStock) * 100 : 0;


  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden active:bg-slate-50 transition-colors">
      <CardContent className="p-4 space-y-4">
        {/* Header: Name & Quick Stock */}
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <Link href={`/farmers/${row.id}`} className="group flex items-center gap-1.5 focus:outline-none">
              <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors underline decoration-slate-200 underline-offset-4">{row.name}</h3>
              <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </div>

        {/* Active Cycles Summary */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-[10px] uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded-full">
            <Bird className="h-3 w-3" /> {row.activeCyclesCount} / {row.activeCyclesCount + row.pastCyclesCount} Live
          </div>
        </div>

        {/* Individual Cycles Badges */}
        <div className="flex flex-wrap gap-1.5">
          {row.activeCycles.length > 0 ? (
            row.activeCycles.map((c: any) => (
              <Badge key={c.id} variant="secondary" className="bg-slate-100/80 text-slate-600 border-slate-200/60 font-medium text-[10px] px-2 py-0 h-5">
                Cycle (Age: {c.age})
              </Badge>
            ))
          ) : (
            <div className="text-[10px] font-medium text-slate-400 italic">No active cycles</div>
          )}
        </div>

        {/* Progress Section */}
        <div className="space-y-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
          <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
            <span className="text-slate-500">Current Consumption</span>
            <span className={percentUsed > 90 ? "text-red-600" : "text-primary"}>{percentUsed.toFixed(0)}% Used</span>
          </div>
          <div className="flex h-2 w-full bg-slate-200 rounded-full overflow-hidden">
            <div className="bg-amber-500 h-full" style={{ width: `${Math.min(percentUsed, 100)}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 text-[10px]">
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold uppercase">Consump.</span>
              <span className="font-bold text-amber-600">+{activeConsumption.toFixed(1)}</span>
            </div>
            <div className="flex justify-between border-l border-slate-200 pl-2">
              <span className="text-slate-400 font-bold uppercase">Total Prov.</span>
              <span className="font-bold text-slate-700">{mainStock.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs font-semibold rounded-lg border-slate-200 text-slate-600"
            onClick={() => onTransfer({
              farmerId: row.id,
              farmerName: row.name,
              currentStock: effectiveRemaining
            })}
          >
            <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Transfer
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs font-semibold rounded-lg border-slate-200 text-slate-600 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all"
            onClick={() => onRestock(row.id)}
          >
            <Wheat className="h-3.5 w-3.5 mr-2" /> Restock
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function MainStockPage() {
  const { orgId } = useCurrentOrg();
  const trpc = useTRPC();

  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebounce(search, 300);

  const { data, isPending, refetch, isRefetching } = useQuery({
    ...trpc.officer.farmers.listWithStock.queryOptions({
      orgId: orgId!,
      search: debouncedSearch,
      page: 1,
      pageSize: 50
    }, { enabled: !!orgId }),
    placeholderData: keepPreviousData
  });

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
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Main Stock Inventory</h1>
          <p className="text-muted-foreground">Manage centralized feed stock for all farmers.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search farmers..."
            className="pl-9 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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

      {(!data?.items || data.items.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-xl bg-slate-50/50">
          <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
            <Wheat className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No Stock Inventory</h3>
          <p className="text-slate-500 text-sm max-w-sm text-center mt-2 mb-6">
            There are no farmers with stock records yet. Register a farmer to start tracking feed inventory.
          </p>
          <Button onClick={() => setCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" /> Register First Farmer
          </Button>
        </div>
      ) : (
        <>
          {/* Main Data Table - Desktop */}
          <div className="hidden sm:block border rounded-md bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Farmer</TableHead>
                  <TableHead>Cycles (Live/Total)</TableHead>
                  <TableHead className="w-[250px]">Stock Overview</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => {
                  // Ensure we fallback to 0 safely
                  const consumed = row.totalConsumed || 0;
                  const mainStock = row.mainStock || 0;
                  const activeConsumption = row.activeConsumption || 0;
                  const effectiveRemaining = mainStock - activeConsumption;
                  // Calculate percentage of MAIN stock that is actively consumed
                  const percentUsed = mainStock > 0 ? (activeConsumption / mainStock) * 100 : 0;

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link href={`/farmers/${row.id}`} className="font-medium hover:underline hover:text-primary transition-colors">
                          {row.name}
                        </Link>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-[10px] uppercase tracking-wider">
                            <Bird className="h-3 w-3" /> {row.activeCyclesCount} / {row.activeCyclesCount + row.pastCyclesCount} Live
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {row.activeCycles.map((c: any) => (
                              <Badge key={c.id} variant="secondary" className="text-[9px] font-normal border-gray-200 py-0 h-4">
                                Age: {c.age}d
                              </Badge>
                            ))}
                          </div>
                          {row.activeCycles.length === 0 && <span className="text-muted-foreground text-[10px] italic">No active cycles</span>}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold text-sm ${effectiveRemaining < 3 ? "text-red-600" : "text-slate-900"}`}>
                              {effectiveRemaining.toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">current</span>
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
                            <span className="text-amber-600/90">+ {activeConsumption.toFixed(1)} consumption in active cycles</span>
                            <span className="text-slate-400">Total Prov: {mainStock.toFixed(1)}</span>
                          </div>
                        </div>
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
                                currentStock: effectiveRemaining
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

          {/* Main Data Cards - Mobile */}
          <div className="sm:hidden space-y-4">
            {data.items.map((row) => (
              <MobileStockCard
                key={row.id}
                row={row}
                onTransfer={(transferData) => setTransferModal({ open: true, data: transferData })}
                onRestock={(farmerId) => setFeedModal({ open: true, farmerId })}
              />
            ))}
          </div>
        </>
      )}

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