"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { Farmer } from "@/modules/cycles/types";
import { MobileCycleCard } from "@/modules/cycles/ui/components/cycles/mobile-cycle-card";
import { SalesHistoryCard } from "@/modules/cycles/ui/components/cycles/sales-history-card";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { AddFeedModal } from "@/modules/cycles/ui/components/mainstock/add-feed-modal";
import { TransferStockModal } from "@/modules/cycles/ui/components/mainstock/transfer-stock-modal";
import { getCycleColumns, getHistoryColumns } from "@/modules/cycles/ui/components/shared/columns-factory";
import { ArchiveFarmerDialog } from "@/modules/farmers/ui/components/archive-farmer-dialog";
import { EditSecurityMoneyModal } from "@/modules/farmers/ui/components/edit-security-money-modal";
import { FarmerNavigation } from "@/modules/farmers/ui/components/farmer-navigation";
import { RestoreFarmerModal } from "@/modules/farmers/ui/components/restore-farmer-modal";
import { SecurityMoneyHistoryModal } from "@/modules/farmers/ui/components/security-money-history-modal";

import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Activity,
    Archive,
    ArrowUpRight,
    ChevronLeft,
    Coins,
    FileClock,
    Loader2,
    MoreVertical,
    Pencil,
    RotateCcw,
    Scale,
    ShoppingCart,
    Trash2,
    User,
    Wheat
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// --- Sub-components (Simplified versions for Admin) ---

const ActiveCyclesSection = ({ isLoading, data, prefix }: { isLoading: boolean, data: any, prefix: string }) => (
    <div className="space-y-4">
        {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : data?.items.length > 0 ? (
            <>
                <div className="hidden sm:block">
                    <DataTable
                        columns={getCycleColumns({ prefix })}
                        data={(data?.items || []) as Farmer[]}
                    />
                </div>
                <div className="sm:hidden space-y-3">
                    {data?.items.map((cycle: any) => (
                        <MobileCycleCard key={cycle.id} cycle={cycle} prefix={prefix} />
                    ))}
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground font-medium italic">
                No active cycles found
            </div>
        )}
    </div>
);

const ArchivedCyclesSection = ({ isLoading, isError, data, prefix }: { isLoading: boolean, isError: boolean, data: any, prefix: string }) => (
    <div className="space-y-4">
        {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
        ) : isError ? (
            <div className="text-destructive text-center p-8">Failed to load history</div>
        ) : data?.items.length > 0 ? (
            <>
                <div className="hidden sm:block">
                    <DataTable
                        columns={getHistoryColumns({ prefix, enableActions: true })}
                        data={data?.items as any[] || []}
                    />
                </div>
                <div className="sm:hidden space-y-3">
                    {data?.items.map((cycle: any) => (
                        <MobileCycleCard key={cycle.id} cycle={cycle} prefix={prefix} />
                    ))}
                </div>
            </>
        ) : (
            <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground font-medium italic">
                No archived history found
            </div>
        )}
    </div>
);

export default function AdminFarmerDetailsPage() {
    const trpc = useTRPC();
    const params = useParams();
    const router = useRouter();
    const orgId = params.id as string;
    const farmerId = params.farmerId as string;

    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [showArchiveDialog, setShowArchiveDialog] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [showEditSecurityMoneyModal, setShowEditSecurityMoneyModal] = useState(false);
    const [showSecurityHistoryModal, setShowSecurityHistoryModal] = useState(false);

    // Consolidated Fetch
    const { data: hubData, isLoading } = useQuery(
        trpc.management.farmers.getManagementHub.queryOptions({ farmerId, orgId })
    );

    const queryClient = useQueryClient();
    const deleteMutation = useMutation(trpc.management.farmers.delete.mutationOptions({
        onSuccess: () => {
            toast.success("Farmer profile deleted");
            queryClient.invalidateQueries({ queryKey: [["management", "farmers"]] });
            router.push(`/admin/organizations/${orgId}/farmers`);
        },
        onError: (err) => {
            toast.error(`Failed to delete: ${err.message}`);
        }
    }));

    const [isSticky, setIsSticky] = useState(false);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                setIsSticky(!entry.isIntersecting);
            },
            { threshold: [0], rootMargin: "-64px 0px 0px 0px" }
        );

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => observer.disconnect();
    }, []);

    if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary h-12 w-12" /></div>;
    if (!hubData) return <div className="p-8 text-center text-muted-foreground">Farmer not found or access denied.</div>;

    const { farmer: farmerData, activeCycles, history, stockLogs } = hubData;

    return (
        <AdminGuard>
            <div className="w-full space-y-6 p-4 md:p-8 pt-6 max-w-7xl mx-auto bg-background min-h-screen">
                <div ref={sentinelRef} className="h-4 w-full pointer-events-none" />

                <div className={cn(
                    "flex flex-col transition-[padding,background-color,border-color,box-shadow,margin] duration-200 ease-in-out will-change-[padding,background-color,box-shadow]",
                    isSticky
                        ? "sticky top-16 z-40 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 py-2.5 -mx-4 px-4 border-b border-border shadow-sm"
                        : "relative py-0 mb-4"
                )}>
                    <div className="flex flex-col gap-1 w-full">
                        <div className="flex items-center gap-3 w-full justify-between">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                {!isSticky && (
                                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shadow-sm bg-card border border-border/50 shrink-0">
                                        <ChevronLeft className="h-5 w-5" />
                                    </Button>
                                )}
                                <div className="flex flex-col gap-1 flex-1 min-w-0">
                                    <h1 className={cn(
                                        "font-bold tracking-tight text-foreground transition-[font-size,transform,opacity] duration-200 ease-in-out truncate",
                                        isSticky ? "text-xl md:text-2xl" : "text-2xl md:text-3xl"
                                    )}>
                                        {farmerData.name}
                                    </h1>
                                    {!isSticky && (
                                        <div className="flex flex-col gap-1">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                                <span>Officer:</span>
                                                <Link
                                                    href={`/admin/organizations/${orgId}/officers/${farmerData.officerId}`}
                                                    className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline underline-offset-4 transition-all"
                                                >
                                                    <User className="h-3.5 w-3.5" />
                                                    {farmerData.officerName}
                                                </Link>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] font-bold">ADMIN VIEW</Badge>
                                                {farmerData.status === "deleted" ? (
                                                    <Badge variant="destructive" className="font-bold text-[10px] uppercase tracking-wider">Archived</Badge>
                                                ) : activeCycles.items && activeCycles.items.length > 0 ? (
                                                    <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border-none font-bold text-[10px] uppercase tracking-wider">Active</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-muted text-muted-foreground border-none font-bold text-[10px] uppercase tracking-wider">Idle</Badge>
                                                )}
                                                <span className="text-xs text-muted-foreground">ID: {farmerData.id}</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="outline"
                                            size={isSticky ? "icon" : "default"}
                                            className={cn(
                                                "gap-2 shadow-sm font-bold transition-[width,height,padding,background-color] duration-200 ease-in-out bg-muted/50 hover:bg-muted border-border/40",
                                                isSticky ? "rounded-full h-8 w-8" : "px-4"
                                            )}
                                        >
                                            <MoreVertical className="h-4 w-4" />
                                            {!isSticky && <span>Actions</span>}
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[200px]">
                                        <DropdownMenuLabel>Farmer Actions</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {farmerData.status === "deleted" ? (
                                            <DropdownMenuItem
                                                onClick={() => setShowRestoreModal(true)}
                                                className="gap-2 cursor-pointer font-medium text-emerald-600 dark:text-emerald-400 focus:text-emerald-600 dark:focus:text-emerald-400"
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                                Restore Profile
                                            </DropdownMenuItem>
                                        ) : (
                                            <>
                                                <DropdownMenuItem onClick={() => setShowRestockModal(true)} className="gap-2 cursor-pointer font-medium">
                                                    <Wheat className="h-4 w-4 text-amber-500" />
                                                    Restock
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => setShowTransferModal(true)} className="gap-2 cursor-pointer font-medium">
                                                    <ArrowUpRight className="h-4 w-4 text-blue-500" />
                                                    Transfer Stock
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    onClick={() => setShowArchiveDialog(true)}
                                                    className="gap-2 cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400 font-medium"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                    Delete Profile
                                                </DropdownMenuItem>
                                            </>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        <div className={cn(
                            "text-sm text-muted-foreground italic transition-[max-height,opacity,margin] duration-200 ease-in-out overflow-hidden will-change-[max-height,opacity]",
                            isSticky ? "max-h-0 opacity-0 mt-0" : "max-h-12 opacity-100 mt-1"
                        )}>
                            Farmer History & Details • Production & Stock Management
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 md:grid-cols-3">
                    <div className="md:col-span-1 space-y-6">
                        <Card className="border border-border/50 shadow-sm bg-card h-fit">
                            <CardHeader className="pb-2">
                                <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                    <Coins className="h-4 w-4" />
                                    Security Deposit
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-col gap-4">
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-3xl font-bold text-foreground">
                                                <span className="text-lg text-muted-foreground font-normal mr-1">TK.</span>
                                                {parseFloat(farmerData.securityMoney || "0").toLocaleString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">Refundable upon account closure</p>
                                    </div>
                                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 gap-2 text-xs font-bold h-8"
                                            onClick={() => setShowEditSecurityMoneyModal(true)}
                                        >
                                            <Pencil className="h-3 w-3" />
                                            Edit
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 gap-2 text-xs font-bold h-8"
                                            onClick={() => setShowSecurityHistoryModal(true)}
                                        >
                                            <FileClock className="h-3 w-3" />
                                            History
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="border border-border/50 shadow-sm bg-card h-fit">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Stock Status</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {(() => {
                                    const activeCyclesList = (activeCycles?.items || []) as any[];
                                    const activeConsumption = activeCyclesList.reduce((acc: number, c: any) => acc + (c.intake || 0), 0);
                                    const remaining = farmerData.mainStock - activeConsumption;

                                    if (farmerData.status === "deleted") {
                                        return (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-4xl font-bold text-muted-foreground/60">{farmerData.mainStock.toFixed(2)}</span>
                                                    <span className="text-muted-foreground/60 font-bold text-xs uppercase tracking-widest leading-none">Remaining Bags</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground/50 font-medium italic mt-1">Archived - No active consumption</p>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="space-y-2">
                                            <div className="flex items-baseline gap-2">
                                                <span className={`text-4xl font-bold ${remaining < 3 ? 'text-red-500' : 'text-foreground'}`}>{remaining.toFixed(2)}</span>
                                                <span className="text-muted-foreground font-medium lowercase">bags available</span>
                                            </div>
                                            {activeConsumption > 0 && (
                                                <p className="text-[10px] text-amber-600 font-bold uppercase tracking-tight">
                                                    {activeConsumption.toFixed(2)} bags currently in-use
                                                </p>
                                            )}
                                        </div>
                                    );
                                })()}
                            </CardContent>
                        </Card>
                    </div>

                    <div className="md:col-span-2">
                        <Tabs defaultValue="active" className="w-full space-y-6">
                            <TabsList className="inline-flex w-auto bg-muted/50 border border-border/50 shadow-sm p-1 rounded-xl h-auto">
                                <TabsTrigger value="active" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary font-bold">
                                    <Activity className="h-4 w-4" />
                                    Active Cycles
                                </TabsTrigger>
                                <TabsTrigger value="history" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary font-bold">
                                    <Archive className="h-4 w-4" />
                                    History
                                </TabsTrigger>
                                <TabsTrigger value="sales" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary font-bold">
                                    <ShoppingCart className="h-4 w-4" />
                                    Sales History
                                </TabsTrigger>
                                <TabsTrigger value="ledger" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary font-bold">
                                    <Scale className="h-4 w-4" />
                                    Stock Ledger
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="active" className="mt-0 focus-visible:outline-none">
                                <ActiveCyclesSection isLoading={false} data={activeCycles} prefix={`/admin/organizations/${params.id}`} />
                            </TabsContent>

                            <TabsContent value="history" className="mt-0 focus-visible:outline-none">
                                <ArchivedCyclesSection isLoading={false} isError={false} data={history} prefix={`/admin/organizations/${params.id}`} />
                            </TabsContent>

                            <TabsContent value="sales" className="mt-0 focus-visible:outline-none">
                                <SalesHistoryCard farmerId={farmerId} />
                            </TabsContent>

                            <TabsContent value="ledger" className="mt-0 focus-visible:outline-none">
                                <StockLedgerTable logs={stockLogs as any[] || []} mainStock={farmerData.mainStock} />
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>

                <TransferStockModal
                    sourceFarmerId={farmerId}
                    sourceFarmerName={farmerData.name}
                    currentStock={farmerData.mainStock}
                    officerId={farmerData.officerId}
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
                <FarmerNavigation
                    orgId={farmerData.organizationId}
                    currentFarmerId={farmerId}
                    currentOfficerId={farmerData.officerId}
                    prefix={`/admin/organizations/${params.id}`}
                />

                <ArchiveFarmerDialog
                    open={showArchiveDialog}
                    onOpenChange={setShowArchiveDialog}
                    farmerName={farmerData.name}
                    isPending={deleteMutation.isPending}
                    onConfirm={() => deleteMutation.mutate({ orgId, farmerId })}
                />

                <RestoreFarmerModal
                    open={showRestoreModal}
                    onOpenChange={setShowRestoreModal}
                    farmerId={farmerId}
                    archivedName={farmerData.name}
                    orgId={orgId}
                />

                <EditSecurityMoneyModal
                    farmerId={farmerId}
                    currentAmount={parseFloat(farmerData.securityMoney || "0")}
                    open={showEditSecurityMoneyModal}
                    onOpenChange={setShowEditSecurityMoneyModal}
                    variant="management"
                    orgId={orgId}
                />
                <SecurityMoneyHistoryModal
                    farmerId={farmerId}
                    farmerName={farmerData.name}
                    open={showSecurityHistoryModal}
                    onOpenChange={setShowSecurityHistoryModal}
                    variant="management"
                    orgId={orgId}
                />
            </div>
        </AdminGuard>
    );
}

// Reuse StockLedgerTable from the original page (simplified style)
const StockLedgerTable = ({ logs, mainStock }: { logs: any[]; mainStock: number }) => {
    return (
        <Card className="border border-border/50 shadow-sm overflow-hidden bg-card">
            <CardContent className="p-0">
                {logs.length > 0 ? (
                    <>
                        {/* Desktop View: Table */}
                        <div className="hidden md:block overflow-auto max-h-[500px] scrollbar-thin">
                            <table className="w-full text-sm">
                                <TableHeader className="sticky top-0 bg-card/90 backdrop-blur-sm border-b border-border/50 z-10">
                                    <TableRow>
                                        <TableHead className="px-6 py-3 font-bold text-foreground">Date</TableHead>
                                        <TableHead className="px-6 py-3 font-bold text-foreground">Type</TableHead>
                                        <TableHead className="px-6 py-3 font-bold text-foreground">Note</TableHead>
                                        <TableHead className="px-6 py-3 font-bold text-foreground text-right">Change</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => {
                                        const amount = Number(log.amount);
                                        const isPositive = amount > 0;
                                        return (
                                            <TableRow key={log.id} className="hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0">
                                                <TableCell className="px-6 py-4 text-muted-foreground">
                                                    {log.createdAt ? format(new Date(log.createdAt), "dd MMM, yy") : "-"}
                                                </TableCell>
                                                <TableCell className="px-6 py-4">
                                                    <Badge variant="outline" className={`font-medium ${isPositive ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800"}`}>
                                                        {log.type.replace(/_/g, " ")}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="px-6 py-4 text-foreground/80">{log.note || "-"}</TableCell>
                                                <TableCell className={`px-6 py-4 text-right font-mono font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                                    {isPositive ? "+" : ""}{amount.toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </table>
                        </div>

                        {/* Mobile View: Cards */}
                        <div className="block md:hidden divide-y divide-border/50 max-h-[600px] overflow-auto">
                            {logs.map((log) => {
                                const amount = Number(log.amount);
                                const isPositive = amount > 0;
                                return (
                                    <div key={log.id} className="p-3 xs:p-4 space-y-2 xs:space-y-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex items-center gap-1.5 xs:gap-2 min-w-0">
                                                <Badge variant="outline" className={`font-bold text-[8px] xs:text-[9px] uppercase tracking-wider truncate ${isPositive ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800"}`}>
                                                    {log.type.replace(/_/g, " ")}
                                                </Badge>
                                            </div>
                                            <span className={`font-mono font-bold text-xs xs:text-sm shrink-0 ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                                {isPositive ? "+" : ""}{amount.toFixed(1)} <small className="font-normal text-[8px] xs:text-[10px] opacity-70">b</small>
                                            </span>
                                        </div>
                                        {log.note && (
                                            <p className="text-[10px] xs:text-xs text-muted-foreground leading-relaxed bg-muted/30 p-1.5 xs:p-2 rounded-lg border border-border/50 line-clamp-2">
                                                {log.note}
                                            </p>
                                        )}
                                        <div className="text-[8px] xs:text-[10px] text-muted-foreground font-bold uppercase tracking-widest pt-0.5 xs:pt-1">
                                            {log.createdAt ? format(new Date(log.createdAt), "dd MMM, yyyy") : "-"}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center p-6 xs:p-8 bg-muted/30 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground font-medium italic text-xs xs:text-sm">
                        No transaction history found
                    </div>
                )}

                <div className="flex items-center justify-between gap-2 xs:gap-3 p-3 xs:p-4 md:p-6 border-t border-border/50 bg-muted/20">
                    <span className="text-muted-foreground text-[8px] xs:text-[10px] md:text-sm font-bold uppercase tracking-widest">Main Stock</span>
                    <div className="bg-primary/10 text-primary flex items-baseline gap-0.5 xs:gap-1 rounded-lg xs:rounded-xl px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 font-mono text-base xs:text-lg md:text-2xl font-bold border border-primary/20">
                        {mainStock.toLocaleString()}
                        <span className="text-[8px] xs:text-[10px] md:text-sm font-normal text-muted-foreground/80">b</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
