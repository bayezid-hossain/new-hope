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


// --- Types ---

type StockLog = {
  id: string;
  amount: string | number;
  type: string;
  note: string | null;
  createdAt: Date | null;
};



export default function FarmerDetails() {
  const trpc = useTRPC();
  const { orgId } = useCurrentOrg();
  // --- Fetch Ledger ---

  const params = useParams();
  const farmerId = params.id as string;
  console.log(farmerId)
  // --- Fetch Archived Cycles ---
  const cyclesQuery = useQuery(
    trpc.cycles.getPastCycles.queryOptions({
      orgId: orgId!,
      farmerId: farmerId as string,
      pageSize: 50,
    })
  );
  console.log(cyclesQuery.data?.items)
  return (
    <div className="w-full space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Farmer History</h1>
        <p className="text-muted-foreground">
          View past production cycles and detailed stock movements.
        </p>
      </div>

      <Tabs defaultValue="cycles" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2">
          <TabsTrigger value="cycles">Archived Cycles</TabsTrigger>
          <TabsTrigger value="ledger">Stock Ledger</TabsTrigger>
        </TabsList>

        {/* TAB 1: ARCHIVED CYCLES */}
        <TabsContent value="cycles" className="mt-4">
          {cyclesQuery.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : cyclesQuery.isError ? (
            <div className="text-destructive text-center p-8">Failed to load history</div>
          ) : (
            <DataTable
              columns={historyColumns}
              data={cyclesQuery.data?.items as any[] || []}
            // Add sorting state if needed, or keeping it simple for now
            />
          )}
        </TabsContent>

        {/* TAB 2: STOCK LEDGER */}
        {/* <TabsContent value="ledger" className="mt-4">
          {ledgerQuery.isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <StockLedgerTable logs={ledgerQuery.data as StockLog[] || []} />
          )}
        </TabsContent> */}
      </Tabs>
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

// const CycleDetailModal = ({ id, open, onOpenChange }: { id: string | null, open: boolean, onOpenChange: (o: boolean) => void }) => {
//   const trpc = useTRPC();

//   const { data, isLoading } = useQuery(
//     trpc.cycles.getDetails.queryOptions(
//       { id: id! },
//       { enabled: !!id && open }
//     )
//   );

//   if (!id) return null;

//   // --- HELPER: Normalize Data ---
//   // We determine values based on whether it is an Active or Archived cycle
//   // to satisfy TypeScript's union checks.
//   let cycleName = "Cycle Details";
//   let intake = 0;
//   let startDate: Date | null = null;
//   let endDate: Date | null = null;
//   let doc = 0;

//   if (data?.data) {
//     const d = data.data;
//     doc = d.doc;

//     // Check if "cycleName" exists (Archived) or "name" exists (Active)
//     if ('cycleName' in d) {
//       // It is an Archived Cycle
//       cycleName = d.cycleName;
//       intake = d.finalIntake;
//       startDate = d.startDate;
//       endDate = d.endDate;
//     } else {
//       // It is an Active Cycle
//       cycleName = d.name;
//       intake = d.intake;
//       startDate = d.createdAt; // Active cycles usually use createdAt as start
//       endDate = null; // Active cycles have no end date yet
//     }
//   }

//   return (
//     <ResponsiveDialog
//       open={open}
//       onOpenChange={onOpenChange}
//       title={cycleName}
//       description="Historical record and logs for this cycle."
//     >
//       {isLoading ? (
//         <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin mr-2" /> Loading...</div>
//       ) : data ? (
//         <div className="space-y-6 pt-2">
//           {/* Top Stats */}
//           <div className="grid grid-cols-2 gap-4">
//             <div className="p-3 bg-muted/40 rounded-lg border space-y-1">
//               <span className="text-xs text-muted-foreground flex items-center gap-1"><Bird className="h-3 w-3" /> Initial Birds</span>
//               <p className="text-xl font-bold">{doc}</p>
//             </div>
//             <div className="p-3 bg-muted/40 rounded-lg border space-y-1">
//               <span className="text-xs text-muted-foreground flex items-center gap-1"><Scale className="h-3 w-3" /> Total Consumed</span>
//               <p className="text-xl font-bold">{intake.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">bags</span></p>
//             </div>
//           </div>

//           {/* Timeline Info */}
//           <div className="space-y-2">
//             <h4 className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4" /> Timeline</h4>
//             <div className="text-sm border rounded-md p-3 grid grid-cols-2 gap-4">
//               <div>
//                 <span className="text-xs text-muted-foreground">Start Date</span>
//                 <p>{startDate ? format(new Date(startDate), "PPP") : "N/A"}</p>
//               </div>
//               <div>
//                 <span className="text-xs text-muted-foreground">End Date</span>
//                 <p>{endDate ? format(new Date(endDate), "PPP") : <span className="text-green-600 font-medium">Active</span>}</p>
//               </div>
//             </div>
//           </div>

//           {/* Logs List */}
//           <div className="space-y-2">
//             <h4 className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" /> Cycle Logs</h4>
//             <ScrollArea className="h-[200px] border rounded-md p-2">
//               <div className="space-y-3">
//                 {data.logs.map((log: any) => (
//                   <div key={log.id} className="text-sm pb-2 border-b last:border-0 last:pb-0">
//                     <p className="font-medium">{log.note}</p>
//                     <div className="flex justify-between text-xs text-muted-foreground mt-1">
//                       <span>{format(new Date(log.createdAt), "dd MMM HH:mm")}</span>
//                       {log.valueChange !== 0 && (
//                         <span>Change: {log.valueChange}</span>
//                       )}
//                     </div>
//                   </div>
//                 ))}
//                 {data.logs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No logs found.</p>}
//               </div>
//             </ScrollArea>
//           </div>
//         </div>
//       ) : (
//         <div className="text-center text-destructive py-4">Failed to load cycle data.</div>
//       )}
//     </ResponsiveDialog>
//   );
// };