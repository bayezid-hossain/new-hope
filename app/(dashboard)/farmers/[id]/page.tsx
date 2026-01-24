"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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

  return (
    <div className="w-full space-y-6 p-4 md:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Farmer History & Details</h1>
        <p className="text-muted-foreground">
          View active production, past cycles, and detailed stock movements.
        </p>
      </div>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full max-w-[600px] grid-cols-3">
          <TabsTrigger value="active">Active Cycles</TabsTrigger>
          <TabsTrigger value="history">Archived Cycles</TabsTrigger>
          <TabsTrigger value="ledger">Stock Ledger</TabsTrigger>
        </TabsList>

        {/* TAB 1: ACTIVE CYCLES */}
        <TabsContent value="active" className="mt-4">
          {activeQuery.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
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
        <TabsContent value="history" className="mt-4">
          {historyQuery.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : historyQuery.isError ? (
            <div className="text-destructive text-center p-8">Failed to load history</div>
          ) : (
            <DataTable
              columns={historyColumns}
              data={historyQuery.data?.items as any[] || []}
              deleteButton={false} // Hide actions column
              onRowClick={(row) => {
                // For history, row might be FarmerHistory type.
                // Assuming it has an ID we can query details for (either historyId or activeId).
                // Based on cycle-router.ts getDetails, it supports searching CycleHistory by ID too.
                setSelectedCycleId(row.id);
                setShowDetails(true);
              }}
            />
          )}
        </TabsContent>

        {/* TAB 3: STOCK LEDGER */}
        <TabsContent value="ledger" className="mt-4">
          {ledgerQuery.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <StockLedgerTable logs={ledgerQuery.data as unknown as StockLog[] || []} />
          )}
        </TabsContent>
      </Tabs>

      {/* Detail Sheet */}
      <CycleDetailsSheet
        id={selectedCycleId}
        open={showDetails}
        onOpenChange={setShowDetails}
      />
    </div>
  );
};

// 1. Stock Ledger Table
const StockLedgerTable = ({ logs }: { logs: StockLog[] }) => {
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
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
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
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
