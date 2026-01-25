"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAdminCycleColumns, getAdminHistoryColumns } from "@/modules/admin/components/admin-columns";
import { Farmer } from "@/modules/cycles/types";
import { MobileCycleCard } from "@/modules/cycles/ui/components/cycles/mobile-cycle-card";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { TransferStockModal } from "@/modules/cycles/ui/components/mainstock/transfer-stock-modal";

import { Badge } from "@/components/ui/badge";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Activity,
    Archive,
    ArrowUpRight,
    ChevronLeft,
    Loader2,
    Scale
} from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const ActiveCyclesSection = ({ isLoading, data }: { isLoading: boolean, data: any }) => (
    <div className="space-y-4">
        {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : data?.items.length > 0 ? (
            <>
                <div className="hidden sm:block">
                    <DataTable
                        columns={getAdminCycleColumns({ prefix: "/management" })}
                        data={(data?.items || []) as Farmer[]}
                    />
                </div>
                <div className="sm:hidden space-y-3">
                    {data?.items.map((cycle: any) => (
                        <MobileCycleCard key={cycle.id} cycle={cycle} prefix="/management" />
                    ))}
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-medium italic">
                No active cycles found
            </div>
        )}
    </div>
);

const ArchivedCyclesSection = ({ isLoading, isError, data }: { isLoading: boolean, isError: boolean, data: any }) => (
    <div className="space-y-4">
        {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : isError ? (
            <div className="text-destructive text-center p-8">Failed to load history</div>
        ) : data?.items.length > 0 ? (
            <>
                <div className="hidden sm:block">
                    <DataTable
                        columns={getAdminHistoryColumns({ prefix: "/management" })}
                        data={data?.items as any[] || []}
                    />
                </div>
                <div className="sm:hidden space-y-3">
                    {data?.items.map((cycle: any) => (
                        <MobileCycleCard key={cycle.id} cycle={cycle} prefix="/management" />
                    ))}
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 font-medium italic">
                No archived history found
            </div>
        )}
    </div>
);

export default function ManagementFarmerDetailsPage() {
    const trpc = useTRPC();
    const params = useParams();
    const router = useRouter();
    const farmerId = params.id as string;

    const [showTransferModal, setShowTransferModal] = useState(false);

    const { data: status } = useQuery(trpc.organization.getMyStatus.queryOptions());
    const orgId = status?.orgId;

    const { data: farmerData, isLoading: isFarmerLoading } = useQuery(
        trpc.farmers.getFarmer.queryOptions({ farmerId })
    );

    const activeQuery = useQuery(
        trpc.cycles.getActiveCycles.queryOptions({
            orgId: orgId!,
            farmerId: farmerId,
            pageSize: 50,
        }, { enabled: !!orgId })
    );

    const historyQuery = useQuery(
        trpc.cycles.getPastCycles.queryOptions({
            orgId: orgId!,
            farmerId: farmerId,
            pageSize: 50,
        }, { enabled: !!orgId })
    );

    const ledgerQuery = useQuery(
        trpc.mainstock.getHistory.queryOptions({ farmerId: farmerId }, { enabled: !!farmerId })
    );

    if (isFarmerLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;
    if (!farmerData) return <div className="p-8 text-center text-slate-500">Farmer not found or access denied.</div>;

    return (
        <div className="w-full space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto bg-slate-50/50 min-h-screen">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shadow-sm bg-white">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{farmerData.name}</h1>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] font-bold uppercase tracking-wider">Management View</Badge>
                            {activeQuery.data?.items && activeQuery.data.items.length > 0 ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold text-[10px] uppercase tracking-wider">Active</Badge>
                            ) : (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none font-bold text-[10px] uppercase tracking-wider">Idle</Badge>
                            )}
                        </div>
                    </div>
                </div>
                <Button onClick={() => setShowTransferModal(true)} variant="outline" className="gap-2 shadow-sm bg-white order-first sm:order-last w-fit">
                    <ArrowUpRight className="h-4 w-4" />
                    Transfer Stock
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="border-none shadow-sm md:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Production Hub</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold text-slate-900">{farmerData.mainStock.toFixed(1)}</span>
                            <span className="text-slate-500 font-medium">bags in stock</span>
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">

                            <div className="space-y-1">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">Assigned Officer ID</p>
                                <p className="text-xs font-mono text-slate-500 truncate">{farmerData.officerId}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <div className="md:col-span-2">
                    <Tabs defaultValue="active" className="w-full space-y-6">
                        <TabsList className="inline-flex w-auto bg-white border shadow-sm p-1 rounded-xl h-auto">
                            <TabsTrigger value="active" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold">
                                <Activity className="h-4 w-4" />
                                Production
                            </TabsTrigger>
                            <TabsTrigger value="history" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold">
                                <Archive className="h-4 w-4" />
                                History
                            </TabsTrigger>
                            <TabsTrigger value="ledger" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold">
                                <Scale className="h-4 w-4" />
                                Ledger
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="active" className="mt-0 focus-visible:outline-none">
                            <ActiveCyclesSection isLoading={activeQuery.isLoading} data={activeQuery.data} />
                        </TabsContent>

                        <TabsContent value="history" className="mt-0 focus-visible:outline-none">
                            <ArchivedCyclesSection isLoading={historyQuery.isLoading} isError={historyQuery.isError} data={historyQuery.data} />
                        </TabsContent>

                        <TabsContent value="ledger" className="mt-0 focus-visible:outline-none">
                            <StockLedgerTable logs={ledgerQuery.data as any[] || []} mainStock={farmerData.mainStock} />
                        </TabsContent>
                    </Tabs>
                </div>
            </div>

            <TransferStockModal
                sourceFarmerId={farmerId}
                sourceFarmerName={farmerData.name}
                currentStock={farmerData.mainStock}
                open={showTransferModal}
                onOpenChange={setShowTransferModal}
            />
        </div>
    );
}

const StockLedgerTable = ({ logs, mainStock }: { logs: any[]; mainStock: number }) => {
    return (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardContent className="p-0">
                <div className="overflow-auto max-h-[500px]">
                    <table className="w-full text-sm">
                        <TableHeader className="sticky top-0 bg-slate-50/90 backdrop-blur-sm border-b z-10">
                            <TableRow>
                                <TableHead className="px-6 py-3 font-bold text-slate-900">Date</TableHead>
                                <TableHead className="px-6 py-3 font-bold text-slate-900">Type</TableHead>
                                <TableHead className="px-6 py-3 font-bold text-slate-900">Note</TableHead>
                                <TableHead className="px-6 py-3 font-bold text-slate-900 text-right">Change</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {logs.map((log) => {
                                const amount = Number(log.amount);
                                const isPositive = amount > 0;
                                return (
                                    <TableRow key={log.id} className="hover:bg-slate-50 transition-colors">
                                        <TableCell className="px-6 py-4 text-slate-500">
                                            {log.createdAt ? format(new Date(log.createdAt), "dd MMM, yy") : "-"}
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <Badge variant="outline" className={`font-medium ${isPositive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}>
                                                {log.type.replace(/_/g, " ")}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-slate-600">{log.note || "-"}</TableCell>
                                        <TableCell className={`px-6 py-4 text-right font-mono font-bold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                                            {isPositive ? "+" : ""}{amount.toFixed(1)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
};
