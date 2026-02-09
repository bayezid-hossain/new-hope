"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BASE_SELLING_PRICE, DOC_PRICE_PER_BIRD, FEED_PRICE_PER_BAG } from "@/constants";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calculator, Check, ChevronDown, ClipboardCopy, Eye, History, Info, Lock, MoreHorizontal, Pencil, ShoppingCart, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AdjustSaleModal } from "./adjust-sale-modal";
import { FcrEpiDetailsModal } from "./fcr-epi-details-modal";
import { ProfitDetailsModal } from "./profit-details-modal";

export interface SaleReport {
    id: string;
    birdsSold: number;
    totalMortality?: number | null;
    totalWeight: string;
    avgWeight: string;
    pricePerKg: string;
    totalAmount: string;
    cashReceived?: string | null;
    depositReceived?: string | null;
    medicineCost?: string | null;
    adjustmentNote?: string | null;
    createdAt: Date;
    createdByUser: {
        name: string;
    };
}

export interface SaleEvent {
    id: string;
    location: string;
    party?: string | null;
    saleDate: Date;
    houseBirds: number;
    birdsSold: number;
    totalMortality: number;
    totalWeight: string;
    avgWeight: string;
    pricePerKg: string;
    totalAmount: string;
    cashReceived?: string | null;
    depositReceived?: string | null;
    feedConsumed: { type: string; bags: number }[];
    feedStock: { type: string; bags: number }[];
    medicineCost?: string | null;
    createdAt: Date;
    reports?: SaleReport[];
    cycleName?: string;
    farmerName?: string;
    cycleContext?: {
        doc: number;
        mortality: number;
        age: number;
        feedConsumed: number;
        isEnded: boolean;
        fcr: number;
        epi: number;
        revenue?: number;
        actualRevenue?: number;
        totalWeight?: number;
        effectiveRate?: number;
        netAdjustment?: number;
    };
}

interface SaleEventCardProps {
    sale: SaleEvent;
    isLatest?: boolean;
    indexInGroup?: number;
    totalInGroup?: number;
    hideName?: boolean;
}

const formatFeedBreakdown = (items: { type: string; bags: number }[]): string => {
    return items.map(i => `${i.type}: ${i.bags} Bags`).join("\n");
};

const calculateTotalBags = (items: { type: string; bags: number }[]): number => {
    return items.reduce((acc, item) => acc + item.bags, 0);
};

// Generates report text based on the SELECTED VERSION - STRICT TEMPLATE
const generateReportText = (sale: SaleEvent, report: SaleReport | null): string => {
    const birdsSold = report ? report.birdsSold : sale.birdsSold;
    const totalWeight = report ? report.totalWeight : sale.totalWeight;
    const avgWeight = report ? report.avgWeight : sale.avgWeight;
    const pricePerKg = report ? report.pricePerKg : sale.pricePerKg;
    const totalAmount = report ? report.totalAmount : sale.totalAmount;

    const cashReceived = report ? (report.cashReceived ?? sale.cashReceived) : sale.cashReceived;
    const depositReceived = report ? (report.depositReceived ?? sale.depositReceived) : sale.depositReceived;
    const medicineCost = report ? (report.medicineCost ?? sale.medicineCost) : sale.medicineCost;

    const totalMortality = (report && report.totalMortality !== undefined && report.totalMortality !== null) ? report.totalMortality : sale.totalMortality;

    const feedTotal = calculateTotalBags(sale.feedConsumed);
    const feedBreakdown = formatFeedBreakdown(sale.feedConsumed);
    const stockBreakdown = formatFeedBreakdown(sale.feedStock);

    const fcr = sale.cycleContext?.fcr || 0;
    const epi = sale.cycleContext?.epi || 0;
    const isEnded = sale.cycleContext?.isEnded || false;

    return `Date: ${format(new Date(sale.saleDate), "dd/MM/yyyy")}

Farmer: ${sale.farmerName || "N/A"}
Location: ${sale.location}${sale.party ? ` (${sale.party})` : ""}
House bird : ${sale.houseBirds}pcs
Total Sold : ${birdsSold}pcs
Total Mortality: ${totalMortality} pcs

Weight: ${totalWeight} kg
Avg. Weight: ${avgWeight} kg
${isEnded ? `
FCR: ${fcr}
EPI: ${epi}
` : ""}
Price : ${pricePerKg} tk
Total taka : ${parseFloat(totalAmount).toLocaleString()} tk
Deposit: ${depositReceived ? `${parseFloat(depositReceived).toLocaleString()} tk` : ""}
Cash: ${parseFloat(cashReceived || "0").toLocaleString()} tk

Feed: ${feedTotal} bags
${feedBreakdown}

Stock: 
${stockBreakdown}

Medicine: ${medicineCost ? parseFloat(medicineCost).toLocaleString() : 0} tk
${!isEnded ? "\n--- Sale not complete ---" : ""}`;
};

export const SaleEventCard = ({ sale, isLatest, indexInGroup, totalInGroup, hideName = false }: SaleEventCardProps) => {
    const trpc = useTRPC();
    const { activeMode, role, canEdit } = useCurrentOrg();
    const [isExpanded, setIsExpanded] = useState(false);

    const reports = sale.reports || [];
    const hasReports = reports.length > 0;

    const [selectedReportId, setSelectedReportId] = useState<string | null>(hasReports ? reports[0].id : null);

    const activeReport = selectedReportId
        ? reports.find(r => r.id === selectedReportId) || null
        : (hasReports ? reports[0] : null);

    const displayBirdsSold = activeReport ? activeReport.birdsSold : sale.birdsSold;
    const displayTotalWeight = activeReport ? activeReport.totalWeight : sale.totalWeight;
    const displayAvgWeight = activeReport ? activeReport.avgWeight : sale.avgWeight;
    const displayPricePerKg = activeReport ? activeReport.pricePerKg : sale.pricePerKg;
    const displayTotalAmount = activeReport ? activeReport.totalAmount : sale.totalAmount;
    const displayMortality = (activeReport && activeReport.totalMortality !== undefined && activeReport.totalMortality !== null)
        ? activeReport.totalMortality
        : sale.totalMortality;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generateReportText(sale, activeReport));
            setCopied(true);
            toast.success("Report copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy report");
        }
    };

    const [copied, setCopied] = useState(false);
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [showProfitModal, setShowProfitModal] = useState(false);
    const [showFcrEpiModal, setShowFcrEpiModal] = useState(false);

    return (
        <>
            <Card className="border-none shadow-none overflow-hidden gap-2 bg-transparent">
                <CardHeader className="pb-1 px-2 sm:px-4 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 py-2">
                                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 text-muted-foreground/50", isExpanded && "rotate-180")} />
                                <span className="truncate">
                                    {(indexInGroup !== undefined && totalInGroup !== undefined)
                                        ? `Sale ${totalInGroup - indexInGroup}`
                                        : (hideName ? "Sale Record" : (sale.farmerName || sale.cycleName || "Sale Record"))}
                                </span>
                                {sale.location && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground bg-background shrink-0">
                                        {sale.location}{sale.party ? ` • ${sale.party}` : ""}
                                    </Badge>
                                )}
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground ml-6">
                                <span className="font-medium text-foreground/80 lowercase">
                                    {displayBirdsSold} birds • <span className="text-emerald-600 dark:text-emerald-400 font-bold">৳{parseFloat(displayTotalAmount).toLocaleString()}</span>
                                </span>
                                <span className="text-muted-foreground/30">•</span>
                                <span>{format(new Date(sale.saleDate), "dd MMM, HH:mm")}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 w-full pt-1" onClick={(e) => e.stopPropagation()}>
                            {((activeMode === "OFFICER" || (!activeMode && role === "OFFICER")) && canEdit) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsAdjustOpen(true)}
                                    className="h-8 px-2 text-[11px] xs:text-xs"
                                >
                                    <Pencil className="h-3.5 w-3.5 mr-1" />
                                    Adjust
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                                className="h-8 px-2 text-[11px] xs:text-xs gap-1.5"
                                style={{ gridColumn: ((activeMode === "OFFICER" || (!activeMode && role === "OFFICER")) && canEdit) ? 'auto' : 'span 2' }}
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                                Copy
                            </Button>
                        </div>
                    </div>

                    {isExpanded && hasReports && (
                        <div className="flex items-center gap-2 mt-3 ml-8" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground">
                                        <History className="h-3.5 w-3.5 mr-1.5" />
                                        {activeReport ? (
                                            `Version ${reports.length - reports.findIndex(r => r.id === activeReport.id)} • ${format(new Date(activeReport.createdAt), "dd/MM/yyyy HH:mm")} `
                                        ) : "Original"}
                                        <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[260px]">
                                    <DropdownMenuLabel>Report Versions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {reports.map((report, idx) => {
                                        const versionNum = reports.length - idx;
                                        return (
                                            <DropdownMenuItem
                                                key={report.id}
                                                onClick={() => setSelectedReportId(report.id)}
                                                className="flex flex-col items-start gap-0.5 py-2 cursor-pointer"
                                            >
                                                <div className="flex items-center justify-between w-full">
                                                    <span className={selectedReportId === report.id ? "font-bold text-primary" : "font-medium"}>
                                                        Version {versionNum}
                                                    </span>
                                                    {selectedReportId === report.id && <Check className="h-3 w-3 text-primary" />}
                                                </div>
                                                <span className="text-[10px] text-muted-foreground">
                                                    {format(new Date(report.createdAt), "dd/MM/yyyy HH:mm")} by {report.createdByUser?.name}
                                                </span>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}

                    {isExpanded && activeReport?.adjustmentNote && (
                        <div className="mt-2 ml-8 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded px-2 py-1.5 text-xs text-muted-foreground italic">
                            Note: {activeReport.adjustmentNote}
                        </div>
                    )}
                </CardHeader>
                {isExpanded && (
                    <CardContent className="pt-4 px-2 sm:px-4 gap-2">
                        <SaleDetailsContent
                            sale={sale}
                            isLatest={isLatest}
                            displayBirdsSold={displayBirdsSold}
                            displayTotalWeight={displayTotalWeight}
                            displayAvgWeight={displayAvgWeight}
                            displayPricePerKg={displayPricePerKg}
                            displayTotalAmount={displayTotalAmount}
                            displayMortality={displayMortality}
                            setShowFcrEpiModal={setShowFcrEpiModal}
                            setShowProfitModal={setShowProfitModal}
                            showFcrEpiModal={showFcrEpiModal}
                            showProfitModal={showProfitModal}
                        />
                    </CardContent>
                )}
            </Card>

            <AdjustSaleModal
                isOpen={isAdjustOpen}
                onClose={() => setIsAdjustOpen(false)}
                saleEvent={sale}
                latestReport={reports[0]}
            />
        </>
    );
};

// ----------------------------------------------------------------------
// SHARED CONTENT COMPONENT
// ----------------------------------------------------------------------
const SaleDetailsContent = ({
    sale,
    isLatest,
    displayBirdsSold,
    displayTotalWeight,
    displayAvgWeight,
    displayPricePerKg,
    displayTotalAmount,
    displayMortality,
    setShowFcrEpiModal,
    setShowProfitModal,
    showFcrEpiModal,
    showProfitModal
}: any) => {
    return (
        <>
            {/* FCR/EPI Row - Prominent at top - ONLY ON LATEST SALE */}
            {isLatest && sale.cycleContext && (
                <div className="flex gap-2 sm:gap-4 mb-4">
                    <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-3 border border-blue-100 dark:border-blue-900/50">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-medium">FCR</div>
                            {sale.cycleContext.isEnded && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 hover:bg-blue-200/50 rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowFcrEpiModal(true);
                                    }}
                                >
                                    <Info className="h-3 w-3 text-blue-600" />
                                </Button>
                            )}
                        </div>
                        <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                            {sale.cycleContext.isEnded ? sale.cycleContext.fcr : <span className="text-muted-foreground text-sm">N/A</span>}
                        </div>
                    </div>
                    <div className="flex-1 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg p-3 border border-emerald-100 dark:border-emerald-900/50">
                        <div className="flex items-center justify-between mb-1">
                            <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-medium">EPI</div>
                            {sale.cycleContext.isEnded && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 hover:bg-emerald-200/50 rounded-full"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowFcrEpiModal(true);
                                    }}
                                >
                                    <Info className="h-3 w-3 text-emerald-600" />
                                </Button>
                            )}
                        </div>
                        <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
                            {sale.cycleContext.isEnded ? sale.cycleContext.epi : <span className="text-muted-foreground text-sm">N/A</span>}
                        </div>
                    </div>
                </div>
            )}

            {/* Main Stats Grid */}
            <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-3 text-[13px] sm:text-sm">
                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <span className="text-muted-foreground text-xs uppercase tracking-tight">Sale Age</span>
                        <span className="font-semibold">{sale.cycleContext?.age || "N/A"} <small className="text-muted-foreground font-medium">days</small></span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-muted-foreground text-xs uppercase tracking-tight">Total DOC</span>
                        <span className="font-semibold">{sale.cycleContext?.doc || sale.houseBirds}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-muted-foreground text-xs uppercase tracking-tight">Birds Sold</span>
                        <span className="font-semibold">{displayBirdsSold}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-muted-foreground text-xs uppercase tracking-tight">Mortality</span>
                        <span className="font-medium text-red-500">{displayMortality}</span>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="flex justify-between items-baseline">
                        <span className="text-muted-foreground text-xs uppercase tracking-tight">Total Weight</span>
                        <span className="font-semibold text-end">{displayTotalWeight} <small className="text-muted-foreground font-medium">kg</small></span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-muted-foreground text-xs uppercase tracking-tight">Avg Weight</span>
                        <span className="font-semibold">{displayAvgWeight}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-muted-foreground text-xs uppercase tracking-tight">Price/kg</span>
                        <span className="font-semibold">৳{displayPricePerKg}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                        <span className="text-muted-foreground text-xs uppercase tracking-tight">Total</span>
                        <span className="font-bold text-emerald-600">৳{parseFloat(displayTotalAmount).toLocaleString()}</span>
                    </div>
                </div>
            </div>

            <Separator className="my-4" />

            {/* Financial Breakdown */}
            <div className="grid grid-cols-3 gap-2 text-xs mb-4">
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <div className="text-muted-foreground text-[10px] uppercase">Cash</div>
                    <div className="font-semibold">৳{parseFloat(sale.cashReceived || "0").toLocaleString()}</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <div className="text-muted-foreground text-[10px] uppercase">Deposit</div>
                    <div className="font-semibold">৳{parseFloat(sale.depositReceived || "0").toLocaleString()}</div>
                </div>
                <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <div className="text-muted-foreground text-[10px] uppercase">Medicine</div>
                    <div className="font-semibold">৳{parseFloat(sale.medicineCost || "0").toLocaleString()}</div>
                </div>
            </div>

            {/* Feed Info */}
            <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <div>
                    <span className="text-muted-foreground block mb-0.5">Feed Consumed:</span>
                    <span className="font-medium bg-muted/40 px-1.5 py-0.5 rounded block w-fit whitespace-pre-line">{formatFeedBreakdown(sale.feedConsumed)}</span>
                </div>
                <div>
                    <span className="text-muted-foreground block mb-0.5">Feed Stock:</span>
                    <span className="font-medium bg-muted/40 px-1.5 py-0.5 rounded block w-fit whitespace-pre-line">{formatFeedBreakdown(sale.feedStock)}</span>
                </div>
            </div>

            {/* Farmer Profit Calculation - Only show on LATEST sale card */}
            {isLatest && sale.cycleContext && (() => {
                // CUMULATIVE VALUES from Backend (Context)
                const cycleTotalWeight = sale.cycleContext.totalWeight || parseFloat(sale.totalWeight);
                const formulaRevenue = sale.cycleContext.revenue || parseFloat(sale.totalAmount);
                const actualRevenue = sale.cycleContext.actualRevenue || parseFloat(sale.totalAmount);
                const effectiveRate = sale.cycleContext.effectiveRate || BASE_SELLING_PRICE;
                const netAdjustment = sale.cycleContext.netAdjustment || 0;
                const fcr = sale.cycleContext.fcr || 0;
                const epi = sale.cycleContext.epi || 0;
                const mortality = sale.cycleContext.mortality || 0;

                // Calculate weighted average price for ACTUAL sales
                const avgPrice = cycleTotalWeight > 0
                    ? actualRevenue / cycleTotalWeight
                    : parseFloat(sale.pricePerKg);

                // Costs (Only calculated if cycle is ENDED)
                const isEnded = sale.cycleContext.isEnded;
                const totalFeedBags = sale.cycleContext.feedConsumed ?? 0;
                const doc = sale.cycleContext.doc || sale.houseBirds || 0;

                const feedCost = isEnded ? totalFeedBags * FEED_PRICE_PER_BAG : 0;
                const docCost = isEnded ? doc * DOC_PRICE_PER_BIRD : 0;
                const totalDeductions = feedCost + docCost;

                const formulaProfit = formulaRevenue - totalDeductions;

                return (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800 mt-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3">
                            <Calculator className="h-4 w-4" /> {isEnded ? "Final Profit Estimate" : "Estimated Revenue (Running)"}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-5 w-5 p-0 hover:bg-amber-200/50 rounded-full"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowProfitModal(true);
                                }}
                            >
                                <Info className="h-3.5 w-3.5 cursor-pointer text-amber-600 hover:text-amber-800" />
                            </Button>
                        </div>
                        <div className="space-y-1 text-sm font-mono">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Est. Total Revenue</span>
                                <span className="font-medium">৳{formulaRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>

                            {isEnded ? (
                                <>
                                    <div className="flex justify-between text-red-600 dark:text-red-400">
                                        <span>- DOC Cost</span>
                                        <span>{docCost.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-red-600 dark:text-red-400">
                                        <span>- Feed Cost</span>
                                        <span>{feedCost.toLocaleString()}</span>
                                    </div>
                                    <div className="border-t border-amber-300 dark:border-amber-700 my-2"></div>
                                    <div className="flex justify-between font-bold text-base">
                                        <span>Net Profit</span>
                                        <span className={formulaProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                            {formulaProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                        </span>
                                    </div>

                                </>
                            ) : (
                                <div className="mt-2 text-xs text-amber-600/80 italic">
                                    * Costs will be deducted when cycle ends.
                                </div>
                            )}
                        </div>

                        <ProfitDetailsModal
                            open={showProfitModal}
                            onOpenChange={setShowProfitModal}
                            revenue={formulaRevenue}
                            actualRevenue={actualRevenue}
                            totalWeight={cycleTotalWeight}
                            avgPrice={avgPrice}
                            effectiveRate={effectiveRate}
                            netAdjustment={netAdjustment}
                            feedBags={totalFeedBags}
                            docCount={doc}
                            feedCost={feedCost}
                            docCost={docCost}
                            profit={formulaProfit}
                        />

                        <FcrEpiDetailsModal
                            open={showFcrEpiModal}
                            onOpenChange={setShowFcrEpiModal}
                            fcr={fcr}
                            epi={epi}
                            doc={doc}
                            mortality={mortality}
                            age={sale.cycleContext.age}
                            totalWeight={cycleTotalWeight}
                            feedBags={totalFeedBags}
                        />
                    </div>
                );
            })()}
        </>
    );
}

// ----------------------------------------------------------------------
// DESKTOP TABLE ROW
// ----------------------------------------------------------------------

const DesktopSalesTable = ({ sales }: { sales: SaleEvent[] }) => {
    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-[140px]">Date</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead className="text-right">Sold</TableHead>
                            <TableHead className="text-right">Weight</TableHead>
                            <TableHead className="text-right">Avg Wt.</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="w-[100px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sales.map((sale, index) => (
                            <DesktopSaleRow key={sale.id} sale={sale} isLatest={index === 0} />
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

const DesktopSaleRow = ({ sale, isLatest }: { sale: SaleEvent, isLatest: boolean }) => {
    const { activeMode, role, canEdit } = useCurrentOrg();
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);

    // Logic for reports/versions
    const reports = sale.reports || [];
    const hasReports = reports.length > 0;
    const [selectedReportId, setSelectedReportId] = useState<string | null>(hasReports ? reports[0].id : null);
    const activeReport = selectedReportId ? reports.find(r => r.id === selectedReportId) || null : (hasReports ? reports[0] : null);

    const displayBirdsSold = activeReport ? activeReport.birdsSold : sale.birdsSold;
    const displayTotalWeight = activeReport ? activeReport.totalWeight : sale.totalWeight;
    const displayAvgWeight = activeReport ? activeReport.avgWeight : sale.avgWeight;
    const displayPricePerKg = activeReport ? activeReport.pricePerKg : sale.pricePerKg;
    const displayTotalAmount = activeReport ? activeReport.totalAmount : sale.totalAmount;
    const displayMortality = (activeReport && activeReport.totalMortality !== undefined && activeReport.totalMortality !== null)
        ? activeReport.totalMortality : sale.totalMortality;

    // Modals state for details view
    const [showProfitModal, setShowProfitModal] = useState(false);
    const [showFcrEpiModal, setShowFcrEpiModal] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generateReportText(sale, activeReport));
            toast.success("Report copied!");
        } catch {
            toast.error("Failed to copy");
        }
    };

    return (
        <>
            <TableRow className="group">
                <TableCell className="font-medium align-top py-3">
                    <div className="flex flex-col">
                        <span>{format(new Date(sale.saleDate), "dd MMM, yyyy")}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(sale.saleDate), "HH:mm")}</span>
                        {activeReport && (
                            <Badge variant="outline" className="mt-1 w-fit text-[10px] h-4 px-1">
                                Ver. {reports.length - reports.findIndex(r => r.id === activeReport.id)}
                            </Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell className="align-top py-3">
                    <div className="flex flex-col gap-1">
                        <span className="font-medium text-sm">{sale.farmerName || sale.cycleName}</span>
                        {sale.location && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                                {sale.location} {sale.party && `• ${sale.party}`}
                            </span>
                        )}
                        {/* Report Selector if multiple versions */}
                        {hasReports && (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="link" className="h-auto p-0 text-[10px] text-primary self-start">
                                        See versions <ChevronDown className="h-3 w-3 ml-0.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                    <DropdownMenuLabel>Versions</DropdownMenuLabel>
                                    {reports.map((report, idx) => (
                                        <DropdownMenuItem key={report.id} onClick={() => setSelectedReportId(report.id)}>
                                            <div className="flex justify-between w-full items-center gap-2">
                                                <span>Version {reports.length - idx}</span>
                                                {selectedReportId === report.id && <Check className="h-3 w-3" />}
                                            </div>
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-right align-top py-3">{displayBirdsSold}</TableCell>
                <TableCell className="text-right align-top py-3">{displayTotalWeight} kg</TableCell>
                <TableCell className="text-right align-top py-3">{displayAvgWeight} kg</TableCell>
                <TableCell className="text-right align-top py-3">৳{displayPricePerKg}</TableCell>
                <TableCell className="text-right align-top py-3 font-bold text-emerald-600">৳{parseFloat(displayTotalAmount).toLocaleString()}</TableCell>
                <TableCell className="text-right align-top py-3">
                    <div className="flex items-center justify-end gap-1">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
                                <DialogHeader className="p-6 pb-2">
                                    <DialogTitle>Sale Details</DialogTitle>
                                    <DialogDescription>{format(new Date(sale.saleDate), "PPPP p")}</DialogDescription>
                                </DialogHeader>
                                <ScrollArea className="flex-1 p-6 pt-2">
                                    <SaleDetailsContent
                                        sale={sale}
                                        isLatest={isLatest}
                                        displayBirdsSold={displayBirdsSold}
                                        displayTotalWeight={displayTotalWeight}
                                        displayAvgWeight={displayAvgWeight}
                                        displayPricePerKg={displayPricePerKg}
                                        displayTotalAmount={displayTotalAmount}
                                        displayMortality={displayMortality}
                                        setShowFcrEpiModal={setShowFcrEpiModal}
                                        setShowProfitModal={setShowProfitModal}
                                        showFcrEpiModal={showFcrEpiModal}
                                        showProfitModal={showProfitModal}
                                    />
                                </ScrollArea>
                            </DialogContent>
                        </Dialog>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleCopy}>
                                    <ClipboardCopy className="h-4 w-4 mr-2" /> Copy Report
                                </DropdownMenuItem>
                                {((activeMode === "OFFICER" || (!activeMode && role === "OFFICER")) && canEdit) && (
                                    <DropdownMenuItem onClick={() => setIsAdjustOpen(true)}>
                                        <Pencil className="h-4 w-4 mr-2" /> Adjust Sale
                                    </DropdownMenuItem>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </TableCell>
            </TableRow>
            <AdjustSaleModal
                isOpen={isAdjustOpen}
                onClose={() => setIsAdjustOpen(false)}
                saleEvent={sale}
                latestReport={reports[0]}
            />
        </>
    )
}

interface SalesHistoryCardProps {
    cycleId?: string | null;
    historyId?: string | null;
    farmerId?: string | null;
    isMobile?: boolean;
}

export const SalesHistoryCard = ({ cycleId, historyId, farmerId, isMobile }: SalesHistoryCardProps) => {
    const trpc = useTRPC();
    const { isPro } = useCurrentOrg();

    const { data: salesEvents, isLoading } = useQuery(
        trpc.officer.sales.getSaleEvents.queryOptions({
            cycleId: cycleId || undefined,
            historyId: historyId || undefined,
            farmerId: farmerId || undefined
        })
    );

    const groupedSales = useMemo(() => {
        if (!salesEvents) return [];

        // If not grouping by farmer, just return single group or handled separately
        if (!farmerId) return null;

        const groups: Record<string, {
            name: string,
            sales: typeof salesEvents,
            isEnded: boolean,
            doc: number,
            mortality: number,
            age: number,
            totalSold: number,
        }> = {};

        salesEvents.forEach(sale => {
            // Group by cycle/history ID primarily, name as fallback
            const key = sale.cycleId || sale.historyId || "unknown";

            if (!groups[key]) {
                const context = sale.cycleContext;
                groups[key] = {
                    name: sale.cycleName || "Unknown Cycle",
                    sales: [],
                    isEnded: !!sale.historyId,
                    doc: context?.doc || 0,
                    mortality: context?.mortality || 0,
                    age: context?.age || 0,
                    totalSold: 0,
                };
            }
            groups[key].sales.push(sale);
            groups[key].totalSold += (sale.birdsSold || 0);
        });

        // Convert to array and sort by latest sale date
        return Object.entries(groups)
            .map(([key, group]) => ({
                id: key,
                ...group
            }))
            .sort((a, b) => {
                const dateA = new Date(a.sales[0]?.saleDate || 0).getTime();
                const dateB = new Date(b.sales[0]?.saleDate || 0).getTime();
                return dateB - dateA;
            });
    }, [salesEvents, farmerId]);

    // PRO GATE
    if (!isPro) {
        return (
            <div className={isMobile ? "space-y-3" : "space-y-4"}>
                {!isMobile && (
                    <CardHeader className="px-0 pt-0 pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                            <ShoppingCart className="h-5 w-5 text-muted-foreground" /> Sales History
                        </CardTitle>
                    </CardHeader>
                )}
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                    <div className="p-3 bg-white dark:bg-indigo-950 rounded-full shadow-sm mb-4">
                        <Lock className="h-6 w-6 text-indigo-500" />
                    </div>
                    <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">Sales Tracking is a Pro Feature</h3>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 max-w-xs mb-6">
                        Upgrade to Pro to record sales, track revenue, and generate detailed financial reports.
                    </p>
                    <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Upgrade to Pro
                    </Button>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }



    if (!salesEvents || salesEvents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border/50">
                <ShoppingCart className="h-10 w-10 mb-3 opacity-20" />
                <p className="font-medium">No sales recorded yet.</p>
                <p className="text-xs">Sales will appear here after you record them.</p>
            </div>
        );
    }

    return (
        <div className={isMobile ? "space-y-3" : "space-y-4"}>
            {!isMobile && (
                <CardHeader className="px-0 pt-0 pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                        <ShoppingCart className="h-5 w-5 text-muted-foreground" /> Sales History
                    </CardTitle>
                    <CardDescription className="text-muted-foreground">
                        {farmerId
                            ? "All recorded sales for this farmer across all cycles."
                            : "All recorded sales for this cycle. You can create adjusted versions for reports."}
                    </CardDescription>
                </CardHeader>
            )}

            <div className="space-y-4 pr-1">
                {farmerId && groupedSales ? (
                    <Accordion type="multiple" defaultValue={groupedSales.length > 0 ? [groupedSales[0].id] : []} className="space-y-4">
                        {groupedSales.map((group) => (
                            <AccordionItem value={group.id} key={group.id} className="border-b last:border-0 px-0">
                                <AccordionTrigger className="hover:no-underline py-3 px-0">
                                    <div className="grid grid-cols-12 items-center gap-x-1 sm:gap-x-2 w-full pr-6 text-[10px] xs:text-[11px] text-foreground/80 font-medium overflow-hidden">
                                        <div className="col-span-2 sm:col-span-1">
                                            <Badge variant={group.isEnded ? "secondary" : "default"} className="text-[8px] xs:text-[9px] h-4 px-1 xs:px-1.5 uppercase font-bold tracking-tight shrink-0 w-fit">
                                                {group.isEnded ? "Ended" : "Running"}
                                            </Badge>
                                        </div>
                                        <div className="col-span-2 sm:col-span-2 font-bold text-muted-foreground/80 uppercase tracking-tighter truncate">
                                            {group.sales.length} {group.sales.length > 1 ? "Sales" : "Sale"}
                                        </div>
                                        <div className="col-span-2 sm:col-span-2 flex items-center gap-0.5 sm:gap-1 pl-1">
                                            <span className="text-muted-foreground/40 text-[8px] uppercase font-bold hidden sm:inline-block">Age:</span>
                                            <span className="font-bold">{group.age}d</span>
                                        </div>
                                        <div className="col-span-3 sm:col-span-3 flex items-center gap-0.5 sm:gap-1">
                                            <span className="text-muted-foreground/40 text-[8px] uppercase font-bold hidden sm:inline-block">DOC:</span>
                                            <span className="font-bold truncate">{group.doc.toLocaleString()}</span>
                                        </div>
                                        <div className="col-span-3 sm:col-span-4 flex items-center justify-end gap-0.5 sm:gap-1">
                                            <span className="text-muted-foreground/40 text-[8px] uppercase font-bold hidden xs:inline-block">Sold:</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{group.totalSold.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4 space-y-4 px-0">
                                    {/* Mobile View */}
                                    <div className="md:hidden space-y-3">
                                        {group.sales.map((sale, index) => (
                                            <SaleEventCard
                                                key={sale.id}
                                                sale={sale}
                                                isLatest={index === 0}
                                                indexInGroup={index}
                                                totalInGroup={group.sales.length}
                                                hideName={true}
                                            />
                                        ))}
                                    </div>
                                    {/* Desktop View */}
                                    <div className="hidden md:block">
                                        <DesktopSalesTable sales={group.sales} />
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <>
                        {/* Mobile View */}
                        <div className="md:hidden space-y-3">
                            {salesEvents.map((sale, index) => (
                                <SaleEventCard key={sale.id} sale={sale} isLatest={index === 0} />
                            ))}
                        </div>
                        {/* Desktop View */}
                        <div className="hidden md:block">
                            <DesktopSalesTable sales={salesEvents} />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
