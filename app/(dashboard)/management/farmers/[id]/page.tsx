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
import { Farmer } from "@/modules/cycles/types";
import { MobileCycleCard } from "@/modules/cycles/ui/components/cycles/mobile-cycle-card";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { TransferStockModal } from "@/modules/cycles/ui/components/mainstock/transfer-stock-modal";

import { Badge } from "@/components/ui/badge";
import { getCycleColumns, getHistoryColumns } from "@/modules/cycles/ui/components/shared/columns-factory";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Activity,
    Archive,
    ArrowDownLeft,
    ArrowUpRight,
    ChevronLeft,
    History,
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
                <div className="hidden md:block">
                    <DataTable
                        columns={getCycleColumns({ prefix: "/management" })}
                        data={(data?.items || []) as Farmer[]}
                    />
                </div>
                <div className="md:hidden space-y-3">
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
                <div className="hidden md:block">
                    <DataTable
                        columns={getHistoryColumns({ prefix: "/management" })}
                        data={data?.items as any[] || []}
                    />
                </div>
                <div className="md:hidden space-y-3">
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
        trpc.management.cycles.listActive.queryOptions({
            orgId: orgId!,
            farmerId,
            pageSize: 50,
        }, { enabled: !!orgId })
    );

    const historyQuery = useQuery(
        trpc.management.cycles.listPast.queryOptions({
            orgId: orgId!,
            farmerId,
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
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shadow-sm bg-white">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">{farmerData.name}</h1>
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
                <Button onClick={() => setShowTransferModal(true)} variant="outline" className="gap-2 shadow-sm bg-white order-first md:order-last w-fit">
                    <ArrowUpRight className="h-4 w-4" />
                    Transfer Stock
                </Button>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
                <Card className="border-none shadow-sm md:col-span-1 h-fit">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Production Hub</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex-col items-baseline gap-2">
                            <span className="text-4xl font-bold text-slate-900">{farmerData.mainStock.toFixed(1)}</span>
                            <span className="text-slate-500 font-medium text-[10px]">bags in stock</span>
                        </div>

                    </CardContent>
                </Card>

                <div className="md:col-span-2">
                    {/* Desktop View: Tabs */}
                    <div className="hidden md:block">
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

                    {/* Mobile View: Accordion */}
                    <div className="block md:hidden">
                        <Accordion type="single" collapsible defaultValue="active" className="space-y-4">
                            <AccordionItem value="active" className="border rounded-2xl bg-white shadow-sm overflow-hidden px-4 py-1 border-slate-200">
                                <AccordionTrigger className="hover:no-underline py-4 text-slate-900 border-none">
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-5 w-5 text-emerald-500" />
                                        <span className="font-bold tracking-tight">Active Cycles</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <ActiveCyclesSection isLoading={activeQuery.isLoading} data={activeQuery.data} />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="history" className="border rounded-2xl bg-white shadow-sm overflow-hidden px-4 py-1 border-slate-200">
                                <AccordionTrigger className="hover:no-underline py-4 text-slate-900 border-none">
                                    <div className="flex items-center gap-2">
                                        <Archive className="h-5 w-5 text-slate-400" />
                                        <span className="font-bold tracking-tight">Archived History</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <ArchivedCyclesSection isLoading={historyQuery.isLoading} isError={historyQuery.isError} data={historyQuery.data} />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="ledger" className="border rounded-2xl bg-white shadow-sm overflow-hidden px-4 py-1 border-slate-200">
                                <AccordionTrigger className="hover:no-underline py-4 text-slate-900 border-none">
                                    <div className="flex items-center gap-2">
                                        <Scale className="h-5 w-5 text-amber-500" />
                                        <span className="font-bold tracking-tight">Stock Ledger</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <StockLedgerTable logs={ledgerQuery.data as any[] || []} mainStock={farmerData.mainStock} />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
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
            <CardHeader className="bg-slate-50/50 border-b py-4 px-6">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <History className="h-5 w-5 text-slate-500" />
                    Stock Transactions
                </CardTitle>
                <CardDescription className="text-xs">Historical log of feed additions and deductions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {/* Desktop View: Table */}
                <div className="hidden md:block overflow-auto max-h-[500px] scrollbar-thin">
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
                                    <TableRow key={log.id} className="hover:bg-slate-50 transition-colors border-b last:border-0">
                                        <TableCell className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                            {log.createdAt ? format(new Date(log.createdAt), "dd MMM, yy") : "-"}
                                        </TableCell>
                                        <TableCell className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isPositive ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                                                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                                                </span>
                                                <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-tight ${isPositive ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-rose-50 text-rose-700 border-rose-100"}`}>
                                                    {log.type.replace(/_/g, " ")}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-slate-600 min-w-[200px]">{log.note || "-"}</TableCell>
                                        <TableCell className={`px-6 py-4 text-right font-mono font-bold ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                                            {isPositive ? "+" : ""}{amount.toFixed(1)}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </table>
                </div>

                {/* Mobile View: Cards */}
                <div className="block md:hidden divide-y divide-slate-100 max-h-[600px] overflow-auto">
                    {logs.map((log) => {
                        const amount = Number(log.amount);
                        const isPositive = amount > 0;
                        return (
                            <div key={log.id} className="p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isPositive ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
                                            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                                        </span>
                                        <Badge variant="secondary" className={`font-bold text-[9px] uppercase tracking-wider border-none ${isPositive ? "bg-emerald-100/50 text-emerald-700" : "bg-rose-100/50 text-rose-700"}`}>
                                            {log.type.replace(/_/g, " ")}
                                        </Badge>
                                    </div>
                                    <span className={`font-mono font-bold text-sm ${isPositive ? "text-emerald-600" : "text-rose-600"}`}>
                                        {isPositive ? "+" : ""}{amount.toFixed(1)} <small className="font-normal text-[10px] opacity-70">bags</small>
                                    </span>
                                </div>
                                {log.note && (
                                    <p className="text-xs text-slate-500 leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                                        {log.note}
                                    </p>
                                )}
                                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest pt-1">
                                    {log.createdAt ? format(new Date(log.createdAt), "dd MMM, yyyy") : "-"}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {logs.length === 0 && (
                    <div className="text-center py-12 text-slate-400 italic">No transaction history available.</div>
                )}

                <div className="flex items-center justify-between gap-3 p-4 md:p-6 border-t bg-slate-50/30">
                    <span className="text-slate-500 text-[10px] md:text-sm font-bold uppercase tracking-widest">Total Stock</span>
                    <div className="bg-primary/10 text-primary flex items-baseline gap-1 rounded-xl px-4 py-2 font-mono text-xl md:text-2xl font-bold border border-primary/20 shadow-xs">
                        {mainStock.toLocaleString()}
                        <span className="text-[10px] md:text-sm font-normal text-muted-foreground/80 lowercase">bags</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
