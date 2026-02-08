"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Farmer } from "@/modules/cycles/types";
import { CreateCycleModal } from "@/modules/cycles/ui/components/cycles/create-cycle-modal";
import { MobileCycleCard } from "@/modules/cycles/ui/components/cycles/mobile-cycle-card";
import { SalesHistoryCard } from "@/modules/cycles/ui/components/cycles/sales-history-card";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { AddFeedModal } from "@/modules/cycles/ui/components/mainstock/add-feed-modal";
import { EditStockLogModal } from "@/modules/cycles/ui/components/mainstock/revert-stock-modal";
import { RevertTransferButton } from "@/modules/cycles/ui/components/mainstock/revert-transfer-button";
import { TransferStockModal } from "@/modules/cycles/ui/components/mainstock/transfer-stock-modal";
import { getCycleColumns, getHistoryColumns } from "@/modules/cycles/ui/components/shared/columns-factory";

import { ArchiveFarmerDialog } from "@/modules/farmers/ui/components/archive-farmer-dialog";
import { EditFarmerProfileModal } from "@/modules/farmers/ui/components/edit-farmer-profile-modal";
import { EditSecurityMoneyModal } from "@/modules/farmers/ui/components/edit-security-money-modal";
import { FarmerNavigation } from "@/modules/farmers/ui/components/farmer-navigation";
import { SecurityMoneyHistoryModal } from "@/modules/farmers/ui/components/security-money-history-modal";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  History,
  MoreVertical,
  Pencil,
  Scale,
  ShoppingCart,
  Trash2,
  Wheat
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";


// --- Types ---

type StockLog = {
  id: string;
  amount: string | number;
  type: string;
  note: string | null;
  referenceId: string | null;
  createdAt: string | Date | null;
};

// --- Sub-components for better organization ---

const ActiveCyclesSection = ({ isLoading, data }: { isLoading: boolean, data: any }) => (
  <div className="space-y-4">
    {isLoading ? (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    ) : data?.items.length > 0 ? (
      <>
        <div className="hidden sm:block">
          <DataTable
            columns={getCycleColumns({ enableActions: true })}
            data={(data?.items || []) as Farmer[]}
          />
        </div>
        <div className="sm:hidden space-y-3">
          {data?.items.map((cycle: any) => (
            <MobileCycleCard key={cycle.id} cycle={cycle} />
          ))}
        </div>
      </>
    ) : (
      <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground font-medium italic">
        No active cycles found for this farmer
      </div>
    )}
  </div>
);

const ArchivedCyclesSection = ({ isLoading, isError, data }: { isLoading: boolean, isError: boolean, data: any }) => (
  <div className="space-y-4">
    {isLoading ? (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    ) : isError ? (
      <div className="text-destructive text-center p-8">Failed to load history</div>
    ) : data?.items.length > 0 ? (
      <>
        <div className="hidden sm:block">
          <DataTable
            columns={getHistoryColumns({ enableActions: true })}
            data={data?.items as any[] || []}
          />
        </div>
        <div className="sm:hidden space-y-3">
          {data?.items.map((cycle: any) => (
            <MobileCycleCard key={cycle.id} cycle={cycle} />
          ))}
        </div>
      </>
    ) : (
      <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground font-medium italic">
        No archived history found for this farmer
      </div>
    )}
  </div>
);

const SalesHistorySection = ({ farmerId }: { farmerId: string }) => (
  <div className="space-y-4">
    <SalesHistoryCard farmerId={farmerId} />
  </div>
);

const StockLedgerSection = ({ isLoading, data, mainStock }: { isLoading: boolean, data: any, mainStock: number }) => (
  <div className="space-y-4">
    {isLoading ? (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    ) : (
      <StockLedgerTable logs={data as unknown as StockLog[] || []} mainStock={mainStock} />
    )}
  </div>
);


export default function FarmerDetails() {
  const trpc = useTRPC();
  const router = useRouter();
  const { orgId } = useCurrentOrg();
  const params = useParams();
  const farmerId = params.id as string;

  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [showCreateCycleModal, setShowCreateCycleModal] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showEditSecurityMoneyModal, setShowEditSecurityMoneyModal] = useState(false);
  const [showSecurityHistoryModal, setShowSecurityHistoryModal] = useState(false);
  const [showEditFarmerModal, setShowEditFarmerModal] = useState(false);

  // 1. Fetch Active Cycles
  const activeQuery = useQuery(
    trpc.officer.cycles.listActive.queryOptions({
      orgId: orgId!,
      farmerId: farmerId,
      pageSize: 50,
    })
  );

  // 2. Fetch Archived Cycles
  const historyQuery = useQuery(
    trpc.officer.cycles.listPast.queryOptions({
      orgId: orgId!,
      farmerId: farmerId,
      pageSize: 50,
    })
  );

  // 3. Fetch Ledger (Stock History)
  const ledgerQuery = useQuery(
    trpc.officer.stock.getHistory.queryOptions({ farmerId: farmerId })
  );

  const farmerQuery = useQuery(
    trpc.officer.farmers.getDetails.queryOptions({ farmerId: farmerId })
  );

  const queryClient = useQueryClient();
  const deleteMutation = useMutation(trpc.officer.farmers.delete.mutationOptions({
    onSuccess: () => {
      toast.success("Farmer profile deleted");
      queryClient.invalidateQueries({ queryKey: [["officer", "farmers"]] });
      router.push("/farmers");
    },
    onError: (err) => {
      toast.error(`Failed to delete: ${err.message}`);
    }
  }));

  return (
    <div className="w-full space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto bg-background min-h-screen">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Farmer History & Details</h1>
          <div className="text-sm text-muted-foreground italic">
            {farmerQuery.isLoading ? <Skeleton className="h-4 w-32 inline-block" /> : (farmerQuery.data?.name || "N/A")} • Production & Stock Management
          </div>
        </div>
        <div className="flex items-center gap-2 order-first md:order-last">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="gap-2 shadow-sm font-bold">
                <MoreVertical className="h-4 w-4" />
                Actions
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>Farmer Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowCreateCycleModal(true)} className="gap-2 cursor-pointer font-medium">
                <Activity className="h-4 w-4 text-emerald-500" />
                Start Cycle
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowRestockModal(true)} className="gap-2 cursor-pointer font-medium">
                <Wheat className="h-4 w-4 text-amber-500" />
                Restock
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setShowTransferModal(true)} className="gap-2 cursor-pointer font-medium">
                <ArrowUpRight className="h-4 w-4 text-blue-500" />
                Transfer Stock
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setShowEditFarmerModal(true)} className="gap-2 cursor-pointer font-medium">
                <Pencil className="h-4 w-4 text-primary" />
                Edit Profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setShowArchiveDialog(true)}
                className="gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 font-medium"
              >
                <Trash2 className="h-4 w-4" />
                Delete Profile
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stock Overview Card */}
      <Card className="border border-border/50 shadow-sm bg-card overflow-hidden">
        <CardContent className="p-6">
          {farmerQuery.isLoading ? (
            <div className="grid gap-6 sm:grid-cols-3 items-center">
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="sm:col-span-2 space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                </div>
                <Skeleton className="h-3 w-full rounded-full" />
              </div>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3 items-center">
              {(() => {
                const mainStock = farmerQuery.data?.mainStock || 0;
                const activeConsumption = activeQuery.data?.items.reduce((acc: number, c: any) => acc + (c.intake || 0), 0) || 0;
                const remaining = mainStock - activeConsumption;
                const isLow = remaining < 3;

                return (
                  <>
                    <div className="space-y-1">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estimated Remaining</h3>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-4xl font-bold ${isLow ? "text-red-500" : "text-foreground"}`}>{remaining.toFixed(2)}</span>
                        <span className="text-sm font-medium text-muted-foreground">bags</span>
                      </div>
                      {isLow && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400">
                          Urgent Restock
                        </span>
                      )}
                    </div>

                    <div className="sm:col-span-2 space-y-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground">Active Cycle Use</span>
                          <div className="font-semibold text-amber-500">+{activeConsumption.toFixed(2)} bags</div>
                        </div>
                        <div className="space-y-0.5">
                          <span className="text-muted-foreground">Total Provisioned (Ledger)</span>
                          <div className="font-semibold text-foreground">{mainStock.toFixed(2)} bags</div>
                        </div>
                      </div>
                      <div className="h-3 w-full bg-muted rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full" style={{ width: `${Math.min((remaining / (mainStock || 1)) * 100, 100)}%` }} />
                        <div className="bg-amber-400 h-full" style={{ width: `${Math.min((activeConsumption / (mainStock || 1)) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Money Card */}
      <Card className="border border-border/50 shadow-sm bg-card overflow-hidden">
        <CardContent className="p-6">
          {farmerQuery.isLoading ? (
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-40" />
              </div>
              <div className="flex gap-2 pt-3 border-t border-border/50">
                <Skeleton className="h-9 flex-1" />
                <Skeleton className="h-9 flex-1" />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Coins className="h-3 w-3" />
                    Security Deposit
                  </h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-foreground">
                      TK. {(farmerQuery.data?.securityMoney || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 font-bold text-[10px] uppercase tracking-wider h-9 bg-card border-border/50 hover:bg-muted/50 transition-colors shadow-sm"
                  onClick={() => setShowEditSecurityMoneyModal(true)}
                >
                  <Pencil className="h-3 w-3 text-primary" />
                  Edit Amount
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 font-bold text-[10px] uppercase tracking-wider h-9 bg-card border-border/50 hover:bg-muted/50 transition-colors shadow-sm"
                  onClick={() => setShowSecurityHistoryModal(true)}
                >
                  <History className="h-3 w-3 text-muted-foreground" />
                  History
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Benchmark Card (Pro Feature) */}
      {/* <PerformanceBenchmarkCard farmerId={farmerId} /> */}

      <div className="w-full min-w-0">
        {/* Desktop View: Tabs */}
        <div className="hidden sm:block">
          <Tabs defaultValue="sales" className="w-full space-y-6">
            <TabsList className="inline-flex w-auto bg-muted/50 border border-border/50 shadow-sm p-1 rounded-xl h-auto">
              <TabsTrigger value="active" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary font-bold">
                <Activity className="h-4 w-4" />
                Active Cycles
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary font-bold">
                <ShoppingCart className="h-4 w-4" />
                Sales History
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary font-bold">
                <Archive className="h-4 w-4" />
                Archived Cycles
              </TabsTrigger>
              <TabsTrigger value="ledger" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary font-bold">
                <Scale className="h-4 w-4" />
                Stock Ledger
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-8">
              <ActiveCyclesSection isLoading={activeQuery.isLoading} data={activeQuery.data} />
            </TabsContent>

            <TabsContent value="sales" className="mt-8">
              <SalesHistorySection farmerId={farmerId} />
            </TabsContent>

            <TabsContent value="history" className="mt-8">
              <ArchivedCyclesSection isLoading={historyQuery.isLoading} isError={historyQuery.isError} data={historyQuery.data} />
            </TabsContent>

            <TabsContent value="ledger" className="mt-8">
              <StockLedgerSection isLoading={ledgerQuery.isLoading} data={ledgerQuery.data} mainStock={farmerQuery.data?.mainStock || 0} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Mobile View: Accordion */}
        <div className="block sm:hidden">
          <Accordion type="single" collapsible defaultValue="sales" className="space-y-4">
            <AccordionItem value="active" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
              <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  <span className="font-semibold tracking-tight">Active Cycles</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <ActiveCyclesSection isLoading={activeQuery.isLoading} data={activeQuery.data} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="sales" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
              <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-blue-500" />
                  <span className="font-semibold tracking-tight">Sales History</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <SalesHistorySection farmerId={farmerId} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="history" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
              <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-muted-foreground" />
                  <span className="font-semibold tracking-tight">Cycles History</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <ArchivedCyclesSection isLoading={historyQuery.isLoading} isError={historyQuery.isError} data={historyQuery.data} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ledger" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
              <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                <div className="flex items-center gap-2">
                  <Scale className="h-5 w-5 text-amber-500" />
                  <span className="font-semibold tracking-tight">Stock Ledger</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <StockLedgerSection isLoading={ledgerQuery.isLoading} data={ledgerQuery.data} mainStock={farmerQuery.data?.mainStock || 0} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>

      <TransferStockModal
        sourceFarmerId={farmerId}
        sourceFarmerName={farmerQuery.data?.name || "Farmer"}
        currentStock={farmerQuery.data?.mainStock || 0}
        officerId={farmerQuery.data?.officerId}
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
      />
      <ResponsiveDialog
        open={showRestockModal}
        onOpenChange={setShowRestockModal}
        title="Restock Inventory"
        description="Add bags of feed to the farmer's main warehouse."
      >
        <AddFeedModal
          id={farmerId}
          open={showRestockModal}
          onOpenChange={setShowRestockModal}
        />
      </ResponsiveDialog>

      {
        farmerQuery.data && (
          <CreateCycleModal
            open={showCreateCycleModal}
            onOpenChange={setShowCreateCycleModal}
            preSelectedFarmer={{
              id: farmerId,
              name: farmerQuery.data.name,
              mainStock: farmerQuery.data.mainStock
            }}
          />
        )
      }
      <FarmerNavigation
        orgId={orgId!}
        currentFarmerId={farmerId}
        currentOfficerId={farmerQuery.data?.officerId}
        useOfficerRouter={true}
      />

      <ArchiveFarmerDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        farmerName={farmerQuery.data?.name || "Farmer"}
        isPending={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate({ id: farmerId, orgId: orgId! })}
      />

      <EditSecurityMoneyModal
        farmerId={farmerId}
        currentAmount={Number.parseFloat(farmerQuery.data?.securityMoney ?? "0")}
        open={showEditSecurityMoneyModal}
        onOpenChange={setShowEditSecurityMoneyModal}
      />

      <SecurityMoneyHistoryModal
        farmerId={farmerId}
        farmerName={farmerQuery.data?.name || "Farmer"}
        open={showSecurityHistoryModal}
        onOpenChange={setShowSecurityHistoryModal}
      />

      <EditFarmerProfileModal
        farmerId={farmerId}
        currentName={farmerQuery.data?.name || ""}
        currentLocation={farmerQuery.data?.location || ""}
        currentMobile={farmerQuery.data?.mobile || ""}
        open={showEditFarmerModal}
        onOpenChange={setShowEditFarmerModal}
      />
    </div>
  );
};

// 1. Stock Ledger Table
const StockLedgerTable = ({ logs, mainStock }: { logs: StockLog[]; mainStock: number }) => {
  return (
    <Card className="border border-border/50 shadow-sm overflow-hidden bg-card">
      <CardHeader className="bg-muted/30 border-b border-border/50 py-3 xs:py-4 px-3 xs:px-4 sm:px-6">
        <CardTitle className="flex items-center gap-2 text-sm xs:text-base sm:text-lg">
          <History className="h-4 w-4 xs:h-5 xs:w-5 text-muted-foreground" />
          Stock Transactions
        </CardTitle>
        <CardDescription className="text-[9px] xs:text-[10px] sm:text-xs">Historical log of feed additions and deductions.</CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <div className="rounded-none sm:rounded-md border-x-0 sm:border mb-auto h-auto max-h-[400px] overflow-auto relative text-sm scrollbar-thin">
          <table className="w-full caption-bottom text-[9px] xs:text-xs sm:text-sm">
            <TableHeader className="sticky top-0 z-10 bg-card border-b border-border/50 shadow-sm">
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[70px] xs:w-[100px] sm:w-[120px] px-2 xs:px-3 sm:px-4 h-8 xs:h-9 sm:h-11 text-[8px] xs:text-[10px] sm:text-[11px] font-bold uppercase tracking-tight">Date</TableHead>
                <TableHead className="w-[80px] xs:w-[120px] sm:w-[140px] px-2 xs:px-3 sm:px-4 h-8 xs:h-9 sm:h-11 text-[8px] xs:text-[10px] sm:text-[11px] font-bold uppercase tracking-tight">Type</TableHead>
                <TableHead className="px-2 xs:px-3 sm:px-4 h-8 xs:h-9 sm:h-11 text-[8px] xs:text-[10px] sm:text-[11px] font-bold uppercase tracking-tight hidden xs:table-cell">Note</TableHead>
                <TableHead className="text-right px-2 xs:px-3 sm:px-4 h-8 xs:h-9 sm:h-11 text-[8px] xs:text-[10px] sm:text-[11px] font-bold uppercase tracking-tight">Change</TableHead>
                <TableHead className="w-[40px] xs:w-[50px] px-1 xs:px-2 sm:px-4 h-8 xs:h-9 sm:h-11"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                // Find all logs that are corrections
                const corrections = logs.filter(l => l.type === "CORRECTION");

                // Group all corrections by what they are correcting (referenceId)
                const correctionMap = new Map<string, number>();
                corrections.forEach(c => {
                  const refId = c.referenceId;
                  if (refId) {
                    const current = correctionMap.get(refId) || 0;
                    correctionMap.set(refId, current + Number(c.amount));
                  }
                });

                return logs.map((log) => {
                  const originalAmount = Number(log.amount);
                  const isPositive = originalAmount > 0;
                  const formattedType = log.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

                  const isCorrection = log.type === "CORRECTION";
                  const correctionSum = correctionMap.get(log.id) || 0;
                  const isCorrected = correctionMap.has(log.id);
                  const isFullyReverted = isCorrected && Math.abs(originalAmount + correctionSum) < 0.001; // Handle floating point jitters
                  const isEdited = isCorrected && !isFullyReverted;

                  const isCycleClose = log.type === "CYCLE_CLOSE";
                  const showActions = !isCorrection && !isFullyReverted && !isCycleClose;

                  const scrollToAndHighlight = (targetId: string) => {
                    const element = document.getElementById(`log-${targetId}`);
                    if (element) {
                      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      element.classList.add('flash-highlight');
                      setTimeout(() => element.classList.remove('flash-highlight'), 2000);
                    }
                  };

                  return (
                    <TableRow
                      key={log.id}
                      id={`log-${log.id}`}
                      className="border-b transition-colors"
                    >
                      <TableCell className="px-2 xs:px-3 sm:px-4 py-2 xs:py-3 text-muted-foreground whitespace-nowrap text-[8px] xs:text-[10px] sm:text-xs">
                        {log.createdAt ? format(new Date(log.createdAt), "dd MMM") : "-"}
                      </TableCell>
                      <TableCell className="px-2 xs:px-3 sm:px-4 py-2 xs:py-3">
                        <div className="flex items-center gap-1 xs:gap-2">
                          <span className={`flex h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full ${isPositive ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"}`}>
                            {isPositive ? <ArrowUpRight className="h-2 w-2 xs:h-3 xs:w-3" /> : <ArrowDownLeft className="h-2 w-2 xs:h-3 xs:w-3" />}
                          </span>
                          <span className="font-medium text-[8px] xs:text-[10px] sm:text-xs truncate max-w-[50px] xs:max-w-none">{formattedType}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-2 xs:px-3 sm:px-4 py-2 xs:py-3 text-[8px] xs:text-[10px] sm:text-xs text-muted-foreground whitespace-normal break-words min-w-[80px] xs:min-w-[120px] hidden xs:table-cell">
                        <div className="flex flex-col gap-0.5 xs:gap-1">
                          <span className="line-clamp-2">{log.note || "-"}</span>
                          {isFullyReverted && <span className="text-[7px] xs:text-[8px] font-bold text-rose-500 uppercase tracking-tighter">[Reverted]</span>}
                          {isEdited && <span className="text-[7px] xs:text-[8px] font-bold text-amber-500 uppercase tracking-tighter">[Edited]</span>}
                          {isCorrection && log.referenceId && (
                            <button
                              onClick={() => scrollToAndHighlight(log.referenceId!)}
                              className="text-[8px] xs:text-[9px] text-primary hover:underline font-bold text-left flex items-center gap-1"
                            >
                              <History className="h-2 w-2 xs:h-2.5 xs:w-2.5" />
                              View Original
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={`px-2 xs:px-3 sm:px-4 py-2 xs:py-3 text-right font-mono font-bold text-[9px] xs:text-xs sm:text-sm ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {isPositive ? "+" : ""}{originalAmount.toFixed(1)}
                      </TableCell>
                      <TableCell className="px-1 xs:px-2 sm:px-4 py-2 xs:py-3 text-right">
                        {showActions && (
                          <div className="flex justify-end gap-0.5 xs:gap-1">
                            {(log.type === "TRANSFER_OUT" || log.type === "TRANSFER_IN") && log.referenceId ? (
                              <RevertTransferButton referenceId={log.referenceId} note={log.note} />
                            ) : (
                              <>
                                <EditStockLogModal log={log} />
                                {/* <RevertStockModal logId={log.id} amount={log.amount} note={log.note} /> */}
                              </>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                });
              })()}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-20 xs:h-24 text-center text-muted-foreground italic text-[10px] xs:text-xs sm:text-sm">No stock transaction history found.</TableCell></TableRow>
              )}
            </TableBody>
          </table>
        </div>
        <div className="flex items-center justify-between xs:justify-end gap-2 xs:gap-3 p-3 xs:p-4 sm:p-0 sm:pt-6 border-t border-border/50 sm:border-t-0 bg-muted/20 sm:bg-transparent">
          <span className="text-muted-foreground text-[8px] xs:text-[10px] sm:text-sm font-semibold uppercase tracking-wider">Main Stock</span>
          <div className="bg-primary/10 text-primary flex items-baseline gap-0.5 xs:gap-1 rounded-lg xs:rounded-xl px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 font-mono text-base xs:text-lg sm:text-2xl font-bold border border-primary/20">
            {mainStock.toLocaleString()}
            <span className="text-[8px] xs:text-[10px] sm:text-sm font-normal text-muted-foreground/80">b</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
