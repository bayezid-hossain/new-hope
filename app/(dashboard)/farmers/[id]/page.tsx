"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { columns } from "@/modules/cycles/ui/components/cycles/columns";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { historyColumns } from "@/modules/cycles/ui/components/history/history-columns";
import { TransferStockModal } from "@/modules/cycles/ui/components/mainstock/transfer-stock-modal";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Activity,
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  Loader2,
  Scale
} from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";


// --- Types ---

type StockLog = {
  id: string;
  amount: string | number;
  type: string;
  note: string | null;
  createdAt: string | Date | null;
};

// --- Sub-components for better organization ---

const ActiveCyclesSection = ({ isLoading, data }: { isLoading: boolean, data: any }) => (
  <div className="space-y-4">
    {isLoading ? (
      <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
    ) : (
      <DataTable
        columns={columns}
        data={(data?.items || []) as Farmer[]}
      />
    )}
  </div>
);

const ArchivedCyclesSection = ({ isLoading, isError, data }: { isLoading: boolean, isError: boolean, data: any }) => (
  <div className="space-y-4">
    {isLoading ? (
      <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
    ) : isError ? (
      <div className="text-destructive text-center p-8">Failed to load history</div>
    ) : (
      <DataTable
        columns={historyColumns}
        data={data?.items as any[] || []}
      />
    )}
  </div>
);

const StockLedgerSection = ({ isLoading, data, mainStock }: { isLoading: boolean, data: any, mainStock: number }) => (
  <div className="space-y-4">
    {isLoading ? (
      <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
    ) : (
      <StockLedgerTable logs={data as unknown as StockLog[] || []} mainStock={mainStock} />
    )}
  </div>
);

export default function FarmerDetails() {
  const trpc = useTRPC();
  const { orgId } = useCurrentOrg();
  const params = useParams();
  const farmerId = params.id as string;

  const [showTransferModal, setShowTransferModal] = useState(false);

  // 1. Fetch Active Cycles
  const activeQuery = useQuery(
    trpc.cycles.getActiveCycles.queryOptions({
      orgId: orgId!,
      farmerId: farmerId,
      pageSize: 50,
    })
  );

  // 2. Fetch Archived Cycles
  const historyQuery = useQuery(
    trpc.cycles.getPastCycles.queryOptions({
      orgId: orgId!,
      farmerId: farmerId,
      pageSize: 50,
    })
  );

  // 3. Fetch Ledger (Stock History)
  const ledgerQuery = useQuery(
    trpc.mainstock.getHistory.queryOptions({ farmerId: farmerId })
  );

  const farmerQuery = useQuery(
    trpc.farmers.getFarmer.queryOptions({ farmerId: farmerId })
  );

  return (
    <div className="w-full space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Farmer History & Details</h1>
          <p className="text-sm text-muted-foreground italic">
            {farmerQuery.data?.name || "Loading..."} • Production & Stock Management
          </p>
        </div>
        <Button onClick={() => setShowTransferModal(true)} variant="outline" className="gap-2 shadow-sm order-first sm:order-last w-fit">
          <ArrowUpRight className="h-4 w-4" />
          Transfer Stock
        </Button>
      </div>

      <div className="w-full min-w-0">
        {/* Desktop View: Tabs */}
        <div className="hidden sm:block">
          <Tabs defaultValue="active" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-11 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="active" className="rounded-lg transition-all data-[state=active]:shadow-sm">Active Cycles</TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg transition-all data-[state=active]:shadow-sm">Archived Cycles</TabsTrigger>
              <TabsTrigger value="ledger" className="rounded-lg transition-all data-[state=active]:shadow-sm">Stock Ledger</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-8">
              <ActiveCyclesSection isLoading={activeQuery.isLoading} data={activeQuery.data} />
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
          <Accordion type="single" collapsible defaultValue="active" className="space-y-4">
            <AccordionItem value="active" className="border rounded-2xl bg-white shadow-sm overflow-hidden px-4 py-1 border-slate-200">
              <AccordionTrigger className="hover:no-underline py-4 text-slate-900">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-emerald-500" />
                  <span className="font-semibold tracking-tight">Active Cycles</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <ActiveCyclesSection isLoading={activeQuery.isLoading} data={activeQuery.data} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="history" className="border rounded-2xl bg-white shadow-sm overflow-hidden px-4 py-1 border-slate-200">
              <AccordionTrigger className="hover:no-underline py-4 text-slate-900">
                <div className="flex items-center gap-2">
                  <Archive className="h-5 w-5 text-slate-400" />
                  <span className="font-semibold tracking-tight">Archived History</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <ArchivedCyclesSection isLoading={historyQuery.isLoading} isError={historyQuery.isError} data={historyQuery.data} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="ledger" className="border rounded-2xl bg-white shadow-sm overflow-hidden px-4 py-1 border-slate-200">
              <AccordionTrigger className="hover:no-underline py-4 text-slate-900">
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
        open={showTransferModal}
        onOpenChange={setShowTransferModal}
      />
    </div>
  );
};

// 1. Stock Ledger Table
const StockLedgerTable = ({ logs, mainStock }: { logs: StockLog[]; mainStock: number }) => {
  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-slate-50/50 border-b py-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <History className="h-5 w-5 text-slate-500" />
          Stock Transactions
        </CardTitle>
        <CardDescription className="text-xs">Historical log of feed additions and deductions.</CardDescription>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        <div className="rounded-none sm:rounded-md border-x-0 sm:border mb-auto h-[400px] overflow-auto relative text-sm scrollbar-thin">
          <table className="w-full caption-bottom text-xs sm:text-sm">
            <TableHeader className="sticky top-0 z-10 bg-white border-b shadow-sm">
              <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                <TableHead className="w-[100px] sm:w-[120px] px-4 h-9 sm:h-11 text-[10px] sm:text-[11px]">Date</TableHead>
                <TableHead className="w-[120px] sm:w-[140px] px-4 h-9 sm:h-11 text-[10px] sm:text-[11px]">Type</TableHead>
                <TableHead className="px-4 h-9 sm:h-11 text-[10px] sm:text-[11px]">Note</TableHead>
                <TableHead className="text-right px-4 h-9 sm:h-11 text-[10px] sm:text-[11px]">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const amount = Number(log.amount);
                const isPositive = amount > 0;
                const formattedType = log.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

                return (
                  <TableRow key={log.id} className="border-b transition-colors">
                    <TableCell className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {log.createdAt ? format(new Date(log.createdAt), "dd MMM, yy") : "-"}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={`flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center rounded-full ${isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                        </span>
                        <span className="font-medium text-[10px] sm:text-xs">{formattedType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-[10px] sm:text-xs text-muted-foreground whitespace-normal break-words min-w-[120px]">
                      {log.note || "-"}
                    </TableCell>
                    <TableCell className={`px-4 py-3 text-right font-mono font-bold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                      {isPositive ? "+" : ""}{amount.toFixed(1)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">No stock transaction history found.</TableCell></TableRow>
              )}
            </TableBody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-3 p-4 sm:p-0 sm:pt-6 border-t sm:border-t-0 bg-slate-50/30 sm:bg-transparent">
          <span className="text-muted-foreground text-[10px] sm:text-sm font-semibold uppercase tracking-wider">Current Main Stock</span>
          <div className="bg-primary/10 text-primary flex items-baseline gap-1 rounded-xl px-4 py-2 font-mono text-xl sm:text-2xl font-bold border border-primary/20">
            {mainStock.toLocaleString()}
            <span className="text-[10px] sm:text-sm font-normal text-muted-foreground/80">bags</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
