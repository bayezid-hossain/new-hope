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
import { ArchiveFarmerDialog } from "@/modules/farmers/ui/components/archive-farmer-dialog";
import { EditFarmerProfileModal } from "@/modules/farmers/ui/components/edit-farmer-profile-modal";
import { MobileFarmerCard } from "@/modules/farmers/ui/components/mobile-farmer-card";
import { CreateFeedOrderModal } from "@/modules/feed-orders/ui/components/create-feed-order-modal";
import { useTRPC } from "@/trpc/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowRightLeft, Bird, Plus, RefreshCcw, Search, ShoppingCart, Sparkles, Trash2, Wheat, Wrench } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

export default function MainStockPage() {
  const { orgId } = useCurrentOrg();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

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
  const [createFeedOrderModal, setCreateFeedOrderModal] = useState(false);

  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    data: { farmerId: string; farmerName: string; currentStock: number; officerId?: string } | null;
  }>({
    open: false,
    data: null
  });

  const [editingFarmer, setEditingFarmer] = useState<{ id: string, name: string, location?: string | null, mobile?: string | null } | null>(null);
  const [archivingFarmer, setArchivingFarmer] = useState<{ id: string, name: string } | null>(null);

  const handleEdit = useCallback((id: string, name: string, location?: string | null, mobile?: string | null) => {
    setEditingFarmer({ id, name, location, mobile });
  }, []);

  const handleDelete = useCallback((id: string, name: string) => {
    setArchivingFarmer({ id, name });
  }, []);

  const deleteFarmerMutation = useMutation(trpc.officer.farmers.delete.mutationOptions({
    onSuccess: () => {
      toast.success("Farmer profile deleted");
      setArchivingFarmer(null);
      queryClient.invalidateQueries({ queryKey: [["officer", "farmers"]] });
    },
    onError: (err) => {
      toast.error(`Failed to delete: ${err.message}`);
    }
  }));

  if (!orgId) return null;
  if (isPending) return <div className="p-8"><LoadingState title="Stock Information" description="Loading stock information..." /></div>;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex-1">
          <h1 className="text-xl xs:text-2xl font-bold tracking-tight">Main Stock Inventory</h1>
          <p className="text-muted-foreground text-xs xs:text-sm">Centralized feed stock management.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search farmers..."
            className="pl-9 bg-background"
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
          <Button variant="secondary" className="border shadow-sm bg-card hover:bg-muted text-emerald-600 dark:text-emerald-400 h-8 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm" onClick={() => setBulkImportModal(true)}>
            <Sparkles className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Bulk Import</span><span className="sm:hidden">Import</span>
          </Button>
          <Button variant="outline" className="h-8 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm" onClick={() => setCreateFeedOrderModal(true)}>
            <ShoppingCart className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Feed Order</span><span className="sm:hidden">Order</span>
          </Button>
          <Button className="h-8 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm" onClick={() => setCreateModal(true)}>
            <Plus className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Register Farmer</span><span className="sm:hidden">Register</span>
          </Button>
        </div>
      </div>

      {(!data?.items || data.items.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border-2 border-dashed rounded-xl bg-muted/30">
          <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <Wheat className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <h3 className="text-lg font-bold text-foreground">No Stock Inventory</h3>
          <p className="text-muted-foreground text-sm max-w-sm text-center mt-2 mb-6">
            There are no farmers with stock records yet. Register a farmer to start tracking feed inventory.
          </p>
          <Button className="h-8 px-3 text-xs sm:h-10 sm:px-4 sm:text-sm" onClick={() => setCreateModal(true)}>
            <Plus className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" /> <span className="hidden sm:inline">Register First Farmer</span><span className="sm:hidden">Register First</span>
          </Button>
        </div>
      ) : (
        <>
          {/* Main Data Table - Desktop */}
          <div className="hidden sm:block border rounded-md bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Farmer</TableHead>
                  <TableHead>Cycles (Live/Past)</TableHead>
                  <TableHead className="w-[250px]">Stock Overview</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => {
                  const mainStock = row.mainStock || 0;
                  const activeConsumption = row.activeConsumption || 0;
                  const effectiveRemaining = mainStock - activeConsumption;

                  return (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 group">
                          <Link href={`/farmers/${row.id}`} className="font-medium hover:underline hover:text-primary transition-colors">
                            {row.name}
                          </Link>
                          {(!row.location || !row.mobile) && (
                            <span title="Missing location or mobile" className="text-destructive">
                              <AlertCircle className="h-3.5 w-3.5" />
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground/50 hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleEdit(row.id, row.name, row.location, row.mobile);
                            }}
                          >
                            <Wrench className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 text-[10px] uppercase tracking-wider">
                            <Bird className="h-3 w-3" /> {row.activeCyclesCount} / {row.pastCyclesCount}
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {row.activeCycles.map((c: any) => (
                              <Badge key={c.id} variant="secondary" className="text-[9px] font-normal border-border py-0 h-4">
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
                            <span className={`font-bold text-sm ${effectiveRemaining < 3 ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                              {effectiveRemaining.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">current</span>
                            </span>
                          </div>
                          <div className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
                            <span className="text-amber-600 dark:text-amber-400">+ {activeConsumption.toFixed(2)} consumption in active cycles</span>
                            <span className="text-muted-foreground">Total Prov: {mainStock.toFixed(2)}</span>
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
                                officerId: row.officerId,
                                currentStock: mainStock
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
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleDelete(row.id, row.name)}
                          >
                            <Trash2 className="h-4 w-4" />
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
                onEdit={() => handleEdit(row.id, row.name, row.location, row.mobile)}
                onDelete={() => handleDelete(row.id, row.name)}
                actions={
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold rounded-lg border-border text-muted-foreground"
                      onClick={() => setTransferModal({
                        open: true,
                        data: {
                          farmerId: row.id,
                          farmerName: row.name,
                          officerId: row.officerId,
                          currentStock: row.mainStock || 0
                        }
                      })}
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Transfer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-semibold rounded-lg border-border text-muted-foreground"
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
            open={feedModal.open}
            onOpenChange={(v) => setFeedModal(prev => ({ ...prev, open: v }))}
          />
        )}
      </ResponsiveDialog>

      <CreateFarmerModal
        open={createModal}
        onOpenChange={setCreateModal}
      />

      <BulkImportModal
        open={bulkImportModal}
        onOpenChange={setBulkImportModal}
        orgId={orgId}
      />

      <CreateFeedOrderModal
        open={createFeedOrderModal}
        onOpenChange={setCreateFeedOrderModal}
        orgId={orgId}
      />

      {transferModal.open && (
        <TransferStockModal
          open={transferModal.open}
          onOpenChange={(v) => setTransferModal(prev => ({ ...prev, open: v }))}
          sourceFarmerId={transferModal.data?.farmerId || ""}
          sourceFarmerName={transferModal.data?.farmerName || ""}
          currentStock={transferModal.data?.currentStock || 0}
          officerId={(transferModal.data as any)?.officerId}
        />
      )}

      <EditFarmerProfileModal
        farmerId={editingFarmer?.id || ""}
        currentName={editingFarmer?.name || ""}
        currentLocation={editingFarmer?.location}
        currentMobile={editingFarmer?.mobile}
        open={!!editingFarmer}
        onOpenChange={(open) => !open && setEditingFarmer(null)}
      />

      <ArchiveFarmerDialog
        open={!!archivingFarmer}
        onOpenChange={(v) => !v && setArchivingFarmer(null)}
        farmerName={archivingFarmer?.name || ""}
        isPending={deleteFarmerMutation.isPending}
        onConfirm={() => deleteFarmerMutation.mutate({ id: archivingFarmer?.id || "", orgId: orgId! })}
      />

    </div>
  );
}