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
import { SalesHistoryCard } from "@/modules/cycles/ui/components/cycles/sales-history-card";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { AddFeedModal } from "@/modules/cycles/ui/components/mainstock/add-feed-modal";
import { TransferStockModal } from "@/modules/cycles/ui/components/mainstock/transfer-stock-modal";
import { ArchiveFarmerDialog } from "@/modules/farmers/ui/components/archive-farmer-dialog";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getCycleColumns, getHistoryColumns } from "@/modules/cycles/ui/components/shared/columns-factory";
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
    ArrowDownLeft,
    ArrowUpRight,
    ChevronLeft,
    Coins,
    FileClock,
    History,
    Loader2,
    MoreVertical,
    Pencil,
    RotateCcw,
    Scale,
    Search,
    ShoppingCart,
    Trash2,
    User,
    Wheat
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const ActiveCyclesSection = ({ isLoading, data }: { isLoading: boolean, data: any }) => {
    const [search, setSearch] = useState("");

    const filteredItems = data?.items.filter((item: any) =>
        item.name.toLowerCase().includes(search.toLowerCase())
    ) || [];

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search active cycles..."
                    className="pl-9 bg-card"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : filteredItems.length > 0 ? (
                <>
                    <div className="hidden md:block">
                        <DataTable
                            columns={getCycleColumns({ prefix: "/management" })}
                            data={filteredItems as Farmer[]}
                        />
                    </div>
                    <div className="md:hidden space-y-3">
                        {filteredItems.map((cycle: any) => (
                            <MobileCycleCard key={cycle.id} cycle={cycle} prefix="/management" />
                        ))}
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground font-medium italic">
                    {search ? "No matches found" : "No active cycles found"}
                </div>
            )}
        </div>
    );
};

const ArchivedCyclesSection = ({ isLoading, isError, data }: { isLoading: boolean, isError: boolean, data: any }) => {
    const [search, setSearch] = useState("");

    const filteredItems = data?.items.filter((item: any) =>
        item.name.toLowerCase().includes(search.toLowerCase())
    ) || [];

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search history..."
                    className="pl-9 bg-card"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="animate-spin text-primary" /></div>
            ) : isError ? (
                <div className="text-destructive text-center p-8">Failed to load history</div>
            ) : filteredItems.length > 0 ? (
                <>
                    <div className="hidden md:block">
                        <DataTable
                            columns={getHistoryColumns({ prefix: "/management", enableActions: true })}
                            data={filteredItems as any[] || []}
                        />
                    </div>
                    <div className="md:hidden space-y-3">
                        {filteredItems.map((cycle: any) => (
                            <MobileCycleCard key={cycle.id} cycle={cycle} prefix="/management" />
                        ))}
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center p-8 bg-muted/30 rounded-2xl border-2 border-dashed border-border/50 text-muted-foreground font-medium italic">
                    {search ? "No matches found" : "No archived history found"}
                </div>
            )}
        </div>
    );
};

export default function ManagementFarmerDetailsPage() {
    const trpc = useTRPC();
    const params = useParams();
    const router = useRouter();
    const farmerId = params.id as string;

    const [showTransferModal, setShowTransferModal] = useState(false);
    const [showRestockModal, setShowRestockModal] = useState(false);
    const [showArchiveDialog, setShowArchiveDialog] = useState(false);
    const [showRestoreModal, setShowRestoreModal] = useState(false);
    const [showEditSecurityMoneyModal, setShowEditSecurityMoneyModal] = useState(false);
    const [showSecurityHistoryModal, setShowSecurityHistoryModal] = useState(false);

    const queryClient = useQueryClient();
    const deleteMutation = useMutation(trpc.management.farmers.delete.mutationOptions({
        onSuccess: () => {
            toast.success("Farmer profile deleted");
            queryClient.invalidateQueries({ queryKey: [["management", "farmers"]] });
            router.push("/management/farmers");
        },
        onError: (err) => {
            toast.error(`Failed to delete: ${err.message}`);
        }
    }));

    // 1. Get Organization Context (for orgId)
    const { data: statusData, isPending: isMembershipPending } = useQuery(
        trpc.auth.getMyMembership.queryOptions()
    );

    const orgId = statusData?.orgId;

    // 2. Consolidated Fetch (Only when orgId is available)
    const { data: hubData, isLoading: isHubLoading } = useQuery({
        ...trpc.management.farmers.getManagementHub.queryOptions({
            farmerId,
            orgId: orgId as string
        }),
        enabled: !!orgId
    });

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

    const farmerData = hubData?.farmer;
    const activeCycles = hubData?.activeCycles || { items: [] };
    const history = hubData?.history || { items: [] };
    const stockLogs = hubData?.stockLogs || [];

    return (
        <div className="w-full space-y-6 p-4 md:p-8 pt-2 max-w-7xl mx-auto bg-background min-h-screen">
            <div ref={sentinelRef} className="h-4 w-full pointer-events-none" />

            <div className={cn(
                "flex flex-col transition-[padding,background-color,border-color,box-shadow,margin] duration-200 ease-in-out will-change-[padding,background-color,box-shadow]",
                isSticky
                    ? "sticky top-16 z-50 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/60 py-2.5 -mx-4 px-4 border-b border-border shadow-sm"
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
                                    {isHubLoading ? <Skeleton className="h-8 w-48" /> : (farmerData?.name || "N/A")}
                                </h1>
                                {isHubLoading ? (
                                    <div className="space-y-2 mt-1">
                                        <Skeleton className="h-4 w-32" />
                                        <Skeleton className="h-4 w-24" />
                                    </div>
                                ) : farmerData && (
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
                                            <span>Officer:</span>
                                            <Link
                                                href={`/management/officers/${farmerData.officerId}`}
                                                className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline underline-offset-4 transition-all"
                                            >
                                                <User className="h-3.5 w-3.5" />
                                                {farmerData.officerName}
                                            </Link>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] font-bold uppercase tracking-wider">Management View</Badge>
                                            {farmerData.status === "deleted" ? (
                                                <Badge variant="destructive" className="font-bold text-[10px] uppercase tracking-wider">Archived</Badge>
                                            ) : activeCycles.items && activeCycles.items.length > 0 ? (
                                                <Badge className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 border-none font-bold text-[10px] uppercase tracking-wider">Active</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-muted text-muted-foreground border-none font-bold text-[10px] uppercase tracking-wider">Idle</Badge>
                                            )}
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
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[200px]">
                                    <DropdownMenuLabel>Farmer Actions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {farmerData?.status === "deleted" ? (
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
                                            {isHubLoading ? <Skeleton className="h-8 w-24 inline-block align-middle" /> : parseFloat(farmerData?.securityMoney || "0").toLocaleString()}
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
                            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Stock Overview</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {isHubLoading ? (
                                <div className="space-y-4">
                                    <Skeleton className="h-10 w-32" />
                                    <Skeleton className="h-4 w-full rounded-full" />
                                    <div className="space-y-2 pt-2 border-t border-border">
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-full" />
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {(() => {
                                        const activeCyclesList = (activeCycles?.items || []) as any[];
                                        const activeConsumption = activeCyclesList.reduce((acc: number, c: any) => acc + (c.intake || 0), 0);
                                        const activeBirds = activeCyclesList.reduce((acc: number, c: any) => acc + ((c.doc || 0) - (c.mortality || 0)), 0);
                                        const remaining = (farmerData?.mainStock || 0) - activeConsumption;
                                        const isLow = remaining < 3;

                                        if (farmerData?.status === "deleted") {
                                            return (
                                                <div className="space-y-4">
                                                    <div className="space-y-1">
                                                        <div className="flex items-baseline gap-2">
                                                            <span className="text-4xl font-black text-muted-foreground">
                                                                --
                                                            </span>
                                                            <span className="text-muted-foreground font-bold text-xs uppercase tracking-widest">Remaining Bags</span>
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground font-medium">Profile archived - no active cycles permitted.</p>
                                                    </div>
                                                    <div className="pt-4 border-t border-border">
                                                        <div className="flex justify-between items-center text-xs">
                                                            <span className="text-muted-foreground font-medium uppercase tracking-tighter">Archived Balance</span>
                                                            <span className="font-bold text-muted-foreground">{(farmerData?.mainStock || 0).toFixed(2)} b</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        return (
                                            <>
                                                <div className="space-y-1">
                                                    <div className="flex items-baseline gap-2">
                                                        <span className={`text-4xl font-black tracking-tighter transition-colors ${isLow ? 'text-red-500' : 'text-foreground'}`}>
                                                            {remaining.toFixed(2)}
                                                        </span>
                                                        <span className="text-muted-foreground font-bold text-xs uppercase tracking-widest">Remaining Bags</span>
                                                    </div>
                                                    {isLow && (
                                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold uppercase tracking-wide">
                                                            Urgent Restock Needed
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-3 pt-2 border-t border-border">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-muted-foreground">Total Active Birds</span>
                                                        <span className="font-semibold text-foreground">{activeBirds.toLocaleString()}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-muted-foreground">Active Consumption</span>
                                                        <span className="font-semibold text-amber-500">+{activeConsumption.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-muted-foreground">Total Provisioned (Ledger)</span>
                                                        <span className="font-semibold text-foreground">{(farmerData?.mainStock || 0).toFixed(2)}</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                                                        <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${Math.min((remaining / ((farmerData?.mainStock || 0) || 1)) * 100, 100)}%` }} />
                                                        <div className="bg-amber-400 h-full transition-all duration-500" style={{ width: `${Math.min((activeConsumption / ((farmerData?.mainStock || 0) || 1)) * 100, 100)}%` }} />
                                                    </div>
                                                </div>
                                            </>
                                        );
                                    })()}
                                </>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-2">
                    {/* Desktop View: Tabs */}
                    <div className="hidden md:block">
                        <Tabs defaultValue="active" className="w-full space-y-6">
                            <TabsList className="inline-flex w-auto bg-muted/50 border border-border/50 shadow-sm p-1 rounded-xl h-auto">
                                <TabsTrigger value="active" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary font-bold">
                                    <Activity className="h-4 w-4" />
                                    Production
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
                                    Ledger
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="active" className="mt-0 focus-visible:outline-none">
                                <ActiveCyclesSection isLoading={false} data={activeCycles} />
                            </TabsContent>

                            <TabsContent value="history" className="mt-0 focus-visible:outline-none">
                                <ArchivedCyclesSection isLoading={false} isError={false} data={history} />
                            </TabsContent>

                            <TabsContent value="sales" className="mt-0 focus-visible:outline-none">
                                <SalesHistoryCard farmerId={farmerId} />
                            </TabsContent>

                            <TabsContent value="ledger" className="mt-0 focus-visible:outline-none">
                                <StockLedgerTable logs={stockLogs as any[] || []} mainStock={farmerData?.mainStock || 0} />
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Mobile View: Accordion */}
                    <div className="block md:hidden">
                        <Accordion type="single" collapsible defaultValue="active" className="space-y-4">
                            <AccordionItem value="active" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
                                <AccordionTrigger className="hover:no-underline py-4 text-foreground border-none">
                                    <div className="flex items-center gap-2">
                                        <Activity className="h-5 w-5 text-emerald-500" />
                                        <span className="font-bold tracking-tight">Active Cycles</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <ActiveCyclesSection isLoading={false} data={activeCycles} />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="history" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
                                <AccordionTrigger className="hover:no-underline py-4 text-foreground border-none">
                                    <div className="flex items-center gap-2">
                                        <Archive className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-bold tracking-tight">Archived History</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <ArchivedCyclesSection isLoading={false} isError={false} data={history} />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="sales" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
                                <AccordionTrigger className="hover:no-underline py-4 text-foreground border-none">
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart className="h-5 w-5 text-blue-500" />
                                        <span className="font-bold tracking-tight">Sales History</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <SalesHistoryCard farmerId={farmerId} isMobile />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="ledger" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
                                <AccordionTrigger className="hover:no-underline py-4 text-foreground border-none">
                                    <div className="flex items-center gap-2">
                                        <Scale className="h-5 w-5 text-amber-500" />
                                        <span className="font-bold tracking-tight">Stock Ledger</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <StockLedgerTable logs={stockLogs as any[] || []} mainStock={farmerData?.mainStock || 0} />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </div>
            </div>

            <TransferStockModal
                sourceFarmerId={farmerId}
                sourceFarmerName={farmerData?.name || "N/A"}
                currentStock={farmerData?.mainStock || 0}
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
                orgId={farmerData?.organizationId || ""}
                currentFarmerId={farmerId}
                currentOfficerId={farmerData?.officerId || ""}
                prefix="/management"
            />

            <ArchiveFarmerDialog
                open={showArchiveDialog}
                onOpenChange={setShowArchiveDialog}
                farmerName={farmerData?.name || "N/A"}
                isPending={deleteMutation.isPending}
                onConfirm={() => deleteMutation.mutate({ orgId: orgId as string, farmerId: farmerId })}
            />

            <RestoreFarmerModal
                open={showRestoreModal}
                onOpenChange={setShowRestoreModal}
                farmerId={farmerId}
                archivedName={farmerData?.name || "N/A"}
                orgId={orgId as string}
            />
            {
                orgId && (
                    <>
                        <EditSecurityMoneyModal
                            farmerId={farmerId}
                            currentAmount={parseFloat(farmerData?.securityMoney || "0")}
                            open={showEditSecurityMoneyModal}
                            onOpenChange={setShowEditSecurityMoneyModal}
                            variant="management"
                            orgId={orgId}
                        />
                        <SecurityMoneyHistoryModal
                            farmerId={farmerId}
                            farmerName={farmerData?.name || "N/A"}
                            open={showSecurityHistoryModal}
                            onOpenChange={setShowSecurityHistoryModal}
                            variant="management"
                            orgId={orgId}
                        />
                    </>
                )
            }
        </div >
    );
}

const StockLedgerTable = ({ logs, mainStock }: { logs: any[]; mainStock: number }) => {
    return (
        <Card className="border border-border/50 shadow-sm overflow-hidden bg-card">
            <CardHeader className="bg-muted/30 border-b border-border/50 py-3 xs:py-4 px-3 xs:px-4 sm:px-6">
                <CardTitle className="flex items-center gap-2 text-sm xs:text-base sm:text-lg">
                    <History className="h-4 w-4 xs:h-5 xs:w-5 text-muted-foreground" />
                    Stock Transactions
                </CardTitle>
                <CardDescription className="text-[9px] xs:text-[10px] sm:text-xs">Historical log of feed additions and deductions.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
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
                                        <TableCell className="px-6 py-4 text-muted-foreground whitespace-nowrap">
                                            {log.createdAt ? format(new Date(log.createdAt), "dd MMM, yy") : "-"}
                                        </TableCell>
                                        <TableCell className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${isPositive ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400" : "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"}`}>
                                                    {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownLeft className="h-3 w-3" />}
                                                </span>
                                                <Badge variant="outline" className={`font-bold text-[10px] uppercase tracking-tight ${isPositive ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" : "bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border-rose-100 dark:border-rose-800"}`}>
                                                    {log.type.replace(/_/g, " ")}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-foreground/80 min-w-[200px]">{log.note || "-"}</TableCell>
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
                                        <span className={`flex h-5 w-5 xs:h-6 xs:w-6 shrink-0 items-center justify-center rounded-full ${isPositive ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400"}`}>
                                            {isPositive ? <ArrowUpRight className="h-2.5 w-2.5 xs:h-3 xs:w-3" /> : <ArrowDownLeft className="h-2.5 w-2.5 xs:h-3 xs:w-3" />}
                                        </span>
                                        <Badge variant="secondary" className={`font-bold text-[8px] xs:text-[9px] uppercase tracking-wider border-none truncate ${isPositive ? "bg-emerald-100/50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400" : "bg-rose-100/50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400"}`}>
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

                {logs.length === 0 && (
                    <div className="text-center py-8 xs:py-12 text-muted-foreground italic text-xs xs:text-sm">No transaction history available.</div>
                )}

                <div className="flex items-center justify-between gap-2 xs:gap-3 p-3 xs:p-4 md:p-6 border-t border-border/50 bg-muted/20">
                    <span className="text-muted-foreground text-[8px] xs:text-[10px] md:text-sm font-bold uppercase tracking-widest">Total Stock</span>
                    <div className="bg-primary/10 text-primary flex items-baseline gap-0.5 xs:gap-1 rounded-lg xs:rounded-xl px-2 xs:px-3 sm:px-4 py-1.5 xs:py-2 font-mono text-base xs:text-lg md:text-2xl font-bold border border-primary/20 shadow-xs">
                        {mainStock.toLocaleString()}
                        <span className="text-[8px] xs:text-[10px] md:text-sm font-normal text-muted-foreground/80 lowercase">b</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
