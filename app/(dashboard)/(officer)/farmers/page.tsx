"use client";

import LoadingState from "@/components/loading-state";
import ResponsiveDialog from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { AddFeedModal } from "@/modules/cycles/ui/components/mainstock/add-feed-modal";
import { BulkImportModal } from "@/modules/cycles/ui/components/mainstock/bulk-import-modal";
import { CreateFarmerModal } from "@/modules/cycles/ui/components/mainstock/create-farmer-modal";
import { TransferStockModal } from "@/modules/cycles/ui/components/mainstock/transfer-stock-modal";
import { EditFarmerNameModal } from "@/modules/farmers/ui/components/edit-farmer-name-modal";
import { MobileFarmerCard } from "@/modules/farmers/ui/components/mobile-farmer-card";
import { useTRPC } from "@/trpc/client";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRightLeft, Bird, Plus, RefreshCcw, Search, Sparkles, Wheat, Wrench } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useDebounce } from "use-debounce";

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
  const [bulkImportModal, setBulkImportModal] = useState(false);

  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    data: { farmerId: string; farmerName: string; currentStock: number } | null;
  }>({
    open: false,
    data: null
  });

  const [editingFarmer, setEditingFarmer] = useState<{ id: string, name: string } | null>(null);

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
          <Button variant="secondary" className="border shadow-sm bg-white hover:bg-slate-50 text-emerald-600" onClick={() => setBulkImportModal(true)}>
            <Sparkles className="mr-2 h-4 w-4" /> Bulk Import
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
                        <div className="flex items-center gap-2 group">
                          <Link href={`/farmers/${row.id}`} className="font-medium hover:underline hover:text-primary transition-colors">
                            {row.name}
                          </Link>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setEditingFarmer({ id: row.id, name: row.name });
                            }}
                          >
                            <Wrench className="h-3 w-3" />
                          </Button>
                        </div>
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
              <MobileFarmerCard
                key={row.id}
                farmer={row}
                actions={
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold rounded-lg border-slate-200 text-slate-600"
                      onClick={() => setTransferModal({
                        open: true,
                        data: {
                          farmerId: row.id,
                          farmerName: row.name,
                          currentStock: (row.mainStock || 0) - (row.activeConsumption || 0)
                        }
                      })}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Transfer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold rounded-lg border-slate-200 text-slate-600 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all"
                      onClick={() => setFeedModal({ open: true, farmerId: row.id })}
                    >
                      <Wheat className="h-3.5 w-3.5 mr-2" /> Restock
                    </Button>
                  </div>
                }
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

      <BulkImportModal
        open={bulkImportModal}
        onOpenChange={setBulkImportModal}
        orgId={orgId}
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

      {editingFarmer && (
        <EditFarmerNameModal
          farmerId={editingFarmer.id}
          currentName={editingFarmer.name}
          open={!!editingFarmer}
          onOpenChange={(open) => !open && setEditingFarmer(null)}
        />
      )}

    </div>
  );
}