"use client";

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
import { CycleDetailsSheet } from "@/modules/cycles/ui/components/cycles/cycle-details-sheet";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { historyColumns } from "@/modules/cycles/ui/components/history/history-columns";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowUpRight,
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



export default function FarmerDetails() {
  const trpc = useTRPC();
  const { orgId } = useCurrentOrg();
  const params = useParams();
  const farmerId = params.id as string;

  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
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
  // Assuming mainstock.getHistory exists and uses { farmerId }
  const ledgerQuery = useQuery(
    trpc.mainstock.getHistory.queryOptions({ farmerId: farmerId })
  );

  const farmerQuery = useQuery(
    trpc.farmers.getFarmer.queryOptions({ farmerId: farmerId })
  );
  return (
    <div className="w-full space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Farmer History & Details</h1>
          <p className="text-muted-foreground">
            View active production, past cycles, and detailed stock movements.
          </p>
        </div>
        <Button onClick={() => setShowTransferModal(true)} variant="outline" className="gap-2">
          <ArrowUpRight className="h-4 w-4" />
          Transfer Stock
        </Button>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active Cycles</TabsTrigger>
          <TabsTrigger value="history">Archived Cycles</TabsTrigger>
          <TabsTrigger value="ledger">Stock Ledger</TabsTrigger>
        </TabsList>

        {/* TAB 1: ACTIVE CYCLES */}
        <TabsContent value="active" className="mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 duration-500 ease-out">
          {activeQuery.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <DataTable
              columns={columns}
              data={(activeQuery.data?.items || []) as Farmer[]}
              onRowClick={(row) => {
                setSelectedCycleId(row.id);
                setShowDetails(true);
              }}
            />
          )}
        </TabsContent>

        {/* TAB 2: ARCHIVED CYCLES */}
        <TabsContent value="history" className="mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 duration-500 ease-out">
          {historyQuery.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
          ) : historyQuery.isError ? (
            <div className="text-destructive text-center p-8">Failed to load history</div>
          ) : (
            <DataTable
              columns={historyColumns}
              data={historyQuery.data?.items as any[] || []}
              deleteButton={false} // Hide actions column
              onRowClick={(row) => {
                setSelectedCycleId(row.id);
                setShowDetails(true);
              }}
            />
          )}
        </TabsContent>

        {/* TAB 3: STOCK LEDGER */}
        <TabsContent value="ledger" className="mt-6 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-2 duration-500 ease-out">
          {ledgerQuery.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
          ) : (
            <StockLedgerTable logs={ledgerQuery.data as unknown as StockLog[] || []} mainStock={farmerQuery.data?.mainStock || 0} />
          )}
        </TabsContent>
      </Tabs>
      <CycleDetailsSheet
        id={selectedCycleId}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </div>
  );
};

// 1. Stock Ledger Table
const StockLedgerTable = ({ logs, mainStock }: { logs: StockLog[]; mainStock: number }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Scale className="h-5 w-5 text-muted-foreground" />
          Stock Transactions
        </CardTitle>
        <CardDescription>A complete log of every feed addition and deduction.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border mb-auto h-[350px] overflow-auto relative text-sm">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead className="w-[140px]">Type</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const amount = Number(log.amount);
                const isPositive = amount > 0;
                const formattedType = log.type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.createdAt ? format(new Date(log.createdAt), "dd MMM, yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                          {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                        </span>
                        <span className="font-medium text-xs">{formattedType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{log.note || "-"}</TableCell>
                    <TableCell className={`text-right font-mono font-medium ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                      {isPositive ? "+" : ""}{amount.toFixed(1)}
                    </TableCell>
                  </TableRow>
                );
              })}
              {logs.length === 0 && (
                <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No history found.</TableCell></TableRow>
              )}
            </TableBody>
          </table>
        </div>
        <div className="flex items-center justify-end gap-3 pt-4 mb-4">
          <span className="text-muted-foreground text-sm font-medium uppercase tracking-wider">Current Stock</span>
          <div className="bg-primary/10 text-primary flex items-baseline gap-1 rounded-lg px-4 py-2 font-mono text-2xl font-bold">
            {mainStock.toLocaleString()}
            <span className="text-sm font-normal text-muted-foreground/80 opacity-70">bags</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
