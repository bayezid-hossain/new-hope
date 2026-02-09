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
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { BASE_SELLING_PRICE, DOC_PRICE_PER_BIRD, FEED_PRICE_PER_BAG } from "@/constants";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Activity,
    Calculator,
    Check,
    CheckCircle2,
    ChevronDown,
    CircleDashed,
    ClipboardCopy,
    CreditCard,
    History,
    Info,
    Lock,
    MoreHorizontal,
    PackageCheck,
    Pencil,
    Scale,
    ShoppingBag,
    ShoppingCart,
    Sparkles,
    TrendingDown,
    Users,
    Warehouse,
    Weight,
    Zap
} from "lucide-react";
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
    cycleId?: string | null;
    historyId?: string | null;
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
        cumulativeBirdsSold?: number;
        effectiveRate?: number;
        netAdjustment?: number;
    };
    isLatestInCycle?: boolean;
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
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="shrink-0">
                                            {sale.cycleContext?.isEnded ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            ) : (
                                                <CircleDashed className="h-4 w-4 text-blue-500 animate-[spin_3s_linear_infinite]" />
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="text-[10px]">{sale.cycleContext?.isEnded ? "Cycle Ended" : "Cycle Running"}</p>
                                    </TooltipContent>
                                </Tooltip>
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
                            isMobileView={true}
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
interface SaleDetailsContentProps {
    sale: SaleEvent;
    isLatest?: boolean;
    displayBirdsSold: number;
    displayTotalWeight: string;
    displayAvgWeight: string;
    displayPricePerKg: string;
    displayTotalAmount: string;
    displayMortality: number;
    setShowFcrEpiModal: (open: boolean) => void;
    setShowProfitModal: (open: boolean) => void;
    showFcrEpiModal: boolean;
    showProfitModal: boolean;
    isMobileView?: boolean;
}

const SaleDetailsContent = ({
    sale,
    isLatest = false,
    displayBirdsSold,
    displayTotalWeight,
    displayAvgWeight,
    displayPricePerKg,
    displayTotalAmount,
    displayMortality,
    setShowFcrEpiModal,
    setShowProfitModal,
    showFcrEpiModal,
    showProfitModal,
    isMobileView = false
}: SaleDetailsContentProps) => {
    // Calculate cumulative average weight - ONLY for the final sale of the cycle
    const cumulativeWeight = sale.cycleContext?.totalWeight || 0;
    const cumulativeBirdsSold = sale.cycleContext?.cumulativeBirdsSold || 0;
    const finalAvgWeight = (isLatest && cumulativeWeight > 0 && cumulativeBirdsSold > 0)
        ? (cumulativeWeight / cumulativeBirdsSold).toFixed(2)
        : displayAvgWeight;

    if (isMobileView) {
        return (
            <div className="space-y-4">
                {/* FCR/EPI Row */}
                {isLatest && sale.cycleContext && sale.cycleContext.isEnded && (
                    <div className="flex gap-2 sm:gap-4 mb-4">
                        <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-3 border border-blue-100 dark:border-blue-900/50">
                            <div className="flex items-center justify-between mb-1">
                                <div className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-medium">FCR</div>
                                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-blue-200/50 rounded-full" onClick={(e) => { e.stopPropagation(); setShowFcrEpiModal(true); }}>
                                    <Info className="h-3 w-3 text-blue-600" />
                                </Button>
                            </div>
                            <div className="text-xl font-bold text-blue-700 dark:text-blue-300">{sale.cycleContext.fcr}</div>
                        </div>
                        <div className="flex-1 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg p-3 border border-emerald-100 dark:border-emerald-900/50">
                            <div className="flex items-center justify-between mb-1">
                                <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-medium">EPI</div>
                                <Button variant="ghost" size="sm" className="h-4 w-4 p-0 hover:bg-emerald-200/50 rounded-full" onClick={(e) => { e.stopPropagation(); setShowFcrEpiModal(true); }}>
                                    <Info className="h-3 w-3 text-emerald-600" />
                                </Button>
                            </div>
                            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300">{sale.cycleContext.epi}</div>
                        </div>
                    </div>
                )}

                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 gap-x-2 sm:gap-x-4 gap-y-3 text-[13px] sm:text-sm">
                    <div className="space-y-3">
                        <div className="flex justify-between items-baseline">
                            <span className="text-muted-foreground text-xs uppercase tracking-tight">Sale Age</span>
                            <span className="font-semibold">{sale.cycleContext?.age || "N/A"} <small className="text-muted-foreground font-medium text-[10px]">days</small></span>
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
                            <span className="font-semibold text-end">{displayTotalWeight} <small className="text-muted-foreground font-medium text-[10px]">kg</small></span>
                        </div>
                        <div className="flex justify-between items-baseline">
                            <span className="text-muted-foreground text-xs uppercase tracking-tight">Avg Weight</span>
                            <span className="font-semibold">{finalAvgWeight}</span>
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

                {/* Profit Card */}
                {isLatest && sale.cycleContext && sale.cycleContext.isEnded && (() => {
                    const cycleTotalWeight = sale.cycleContext.totalWeight || parseFloat(sale.totalWeight);
                    const formulaRevenue = sale.cycleContext.revenue || parseFloat(sale.totalAmount);
                    const actualRevenue = sale.cycleContext.actualRevenue || parseFloat(sale.totalAmount);
                    const effectiveRate = sale.cycleContext.effectiveRate || BASE_SELLING_PRICE;
                    const netAdjustment = sale.cycleContext.netAdjustment || 0;
                    const fcr = sale.cycleContext.fcr || 0;
                    const epi = sale.cycleContext.epi || 0;
                    const mortality = sale.cycleContext.mortality || 0;
                    const avgPrice = cycleTotalWeight > 0 ? actualRevenue / cycleTotalWeight : parseFloat(sale.pricePerKg);
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
                                    <div className="mt-2 text-xs text-amber-600/80 italic">* Costs will be deducted when cycle ends.</div>
                                )}
                            </div>
                            <ProfitDetailsModal open={showProfitModal} onOpenChange={setShowProfitModal} revenue={formulaRevenue} actualRevenue={actualRevenue} totalWeight={cycleTotalWeight} avgPrice={avgPrice} effectiveRate={effectiveRate} netAdjustment={netAdjustment} feedBags={totalFeedBags} docCount={doc} feedCost={feedCost} docCost={docCost} profit={formulaProfit} />
                            <FcrEpiDetailsModal open={showFcrEpiModal} onOpenChange={setShowFcrEpiModal} fcr={fcr} epi={epi} doc={doc} mortality={mortality} age={sale.cycleContext?.age || 0} totalWeight={cycleTotalWeight} feedBags={totalFeedBags} />
                        </div>
                    );
                })()}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* SECTION 1: PERFORMANCE & YIELD */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                        <div className="p-1.5 rounded-md bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                            <Activity className="h-4 w-4" />
                        </div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Performance & Yield</h4>
                    </div>

                    <div className="space-y-3 px-1">
                        <div className="flex justify-between items-center group">
                            <div className="flex items-center gap-2">
                                <History className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
                                <span className="text-sm text-muted-foreground">Sale Age</span>
                            </div>
                            <span className="text-sm font-semibold text-foreground">{sale.cycleContext?.age || "N/A"} <small className="text-muted-foreground font-medium uppercase text-[10px]">days</small></span>
                        </div>
                        <div className="flex justify-between items-center group">
                            <div className="flex items-center gap-2">
                                <Users className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary/70 transition-colors" />
                                <span className="text-sm text-muted-foreground">Main Stock (DOC)</span>
                            </div>
                            <span className="text-sm font-semibold text-foreground">{sale.cycleContext?.doc?.toLocaleString() || sale.houseBirds?.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center group">
                            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                <ShoppingBag className="h-3.5 w-3.5" />
                                <span className="text-sm font-medium">Birds Sold</span>
                            </div>
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-none font-bold tabular-nums">
                                {displayBirdsSold.toLocaleString()}
                            </Badge>
                        </div>
                        <div className="flex justify-between items-center group">
                            <div className="flex items-center gap-2 text-red-500">
                                <TrendingDown className="h-3.5 w-3.5" />
                                <span className="text-sm font-medium">Mortality</span>
                            </div>
                            <span className="text-sm font-bold text-red-500 tabular-nums">{displayMortality}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1">
                            <div className="flex items-center gap-2">
                                <Scale className="h-3.5 w-3.5 text-muted-foreground/50" />
                                <span className="text-sm text-muted-foreground">Avg. Weight</span>
                            </div>
                            <span className="text-sm font-bold text-foreground">{finalAvgWeight} <small className="text-muted-foreground font-normal text-[10px]">kg</small></span>
                        </div>
                        <div className="flex justify-between items-center group bg-primary/5 p-2 rounded-lg border border-primary/10">
                            <div className="flex items-center gap-2 text-primary">
                                <Weight className="h-4 w-4" />
                                <span className="text-sm font-bold">Total Weight</span>
                            </div>
                            <span className="text-base font-black text-primary tabular-nums">{parseFloat(displayTotalWeight).toLocaleString()} kg</span>
                        </div>
                    </div>
                </div>

                {/* SECTION 2: FINANCIAL OVERVIEW */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                        <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
                            <CreditCard className="h-4 w-4" />
                        </div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Financial Details</h4>
                    </div>

                    <div className="space-y-3 px-1">
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Price per kg</span>
                            <span className="text-sm font-semibold">৳{displayPricePerKg}</span>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-lg bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/20">
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Total Revenue</span>
                            <span className="text-base font-black text-emerald-600 dark:text-emerald-400 tabular-nums">৳{parseFloat(displayTotalAmount).toLocaleString()}</span>
                        </div>

                        <Separator className="my-2 opacity-50" />

                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-muted/30 rounded-lg p-2.5 border border-border/40">
                                <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-tight mb-1">Cash In Hand</div>
                                <div className="text-sm font-bold text-foreground">৳{parseFloat(sale.cashReceived || "0").toLocaleString()}</div>
                            </div>
                            <div className="bg-muted/30 rounded-lg p-2.5 border border-border/40">
                                <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-tight mb-1">Bank Deposit</div>
                                <div className="text-sm font-bold text-foreground">৳{parseFloat(sale.depositReceived || "0").toLocaleString()}</div>
                            </div>
                        </div>
                        <div className="bg-amber-500/5 dark:bg-amber-500/10 rounded-lg p-2.5 border border-amber-500/20 flex justify-between items-center">
                            <div className="text-xs font-bold text-amber-600 uppercase tracking-tight">Medicine Adjustment</div>
                            <div className="text-sm font-bold text-amber-700 dark:text-amber-300">৳{parseFloat(sale.medicineCost || "0").toLocaleString()}</div>
                        </div>
                    </div>
                </div>

                {/* SECTION 3: RESOURCE & EFFICIENCY */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                        <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                            <Zap className="h-4 w-4" />
                        </div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/70">Resource & Context</h4>
                    </div>

                    <div className="space-y-4 px-1">
                        {/* FCR/EPI Display - ALWAYS available if ended, but more prominent if latest */}
                        {sale.cycleContext?.isEnded && (
                            <div className="flex gap-2">
                                <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-lg p-2.5 border border-blue-100 dark:border-blue-900/40">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <div className="text-[9px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-bold">FCR</div>
                                        <Info className="h-3 w-3 text-blue-600/50 cursor-pointer" onClick={() => setShowFcrEpiModal(true)} />
                                    </div>
                                    <div className="text-lg font-black text-blue-700 dark:text-blue-300">{sale.cycleContext.fcr}</div>
                                </div>
                                <div className="flex-1 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-900/40">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <div className="text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">EPI</div>
                                        <Info className="h-3 w-3 text-emerald-600/50 cursor-pointer" onClick={() => setShowFcrEpiModal(true)} />
                                    </div>
                                    <div className="text-lg font-black text-emerald-700 dark:text-emerald-300">{sale.cycleContext.epi}</div>
                                </div>
                            </div>
                        )}

                        <div className="space-y-3 pt-1">
                            <div className="group">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <PackageCheck className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Feed Consumed</span>
                                </div>
                                <div className="text-xs font-medium bg-muted/30 p-2 rounded-md border border-border/40 whitespace-pre-line leading-relaxed italic">
                                    {formatFeedBreakdown(sale.feedConsumed)}
                                </div>
                            </div>
                            <div className="group">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Warehouse className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Current Stock</span>
                                </div>
                                <div className="text-xs font-medium bg-muted/30 p-2 rounded-md border border-border/40 whitespace-pre-line leading-relaxed italic">
                                    {formatFeedBreakdown(sale.feedStock)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* INTEGRATED PROFIT ESTIMATE CARD - ONLY ON LATEST SALE OF ENDED CYCLE */}
            {isLatest && sale.cycleContext && sale.cycleContext.isEnded && (() => {
                const cycleTotalWeight = sale.cycleContext.totalWeight || parseFloat(sale.totalWeight);
                const formulaRevenue = sale.cycleContext.revenue || parseFloat(sale.totalAmount);
                const actualRevenue = sale.cycleContext.actualRevenue || parseFloat(sale.totalAmount);
                const effectiveRate = sale.cycleContext.effectiveRate || BASE_SELLING_PRICE;
                const netAdjustment = sale.cycleContext.netAdjustment || 0;
                const fcr = sale.cycleContext.fcr || 0;
                const epi = sale.cycleContext.epi || 0;
                const mortality = sale.cycleContext.mortality || 0;

                const avgPrice = cycleTotalWeight > 0 ? actualRevenue / cycleTotalWeight : parseFloat(sale.pricePerKg);

                const isEnded = sale.cycleContext.isEnded;
                const totalFeedBags = sale.cycleContext.feedConsumed ?? 0;
                const doc = sale.cycleContext.doc || sale.houseBirds || 0;

                const feedCost = isEnded ? totalFeedBags * FEED_PRICE_PER_BAG : 0;
                const docCost = isEnded ? doc * DOC_PRICE_PER_BIRD : 0;
                const totalDeductions = feedCost + docCost;

                const formulaProfit = formulaRevenue - totalDeductions;
                const isPositive = formulaProfit >= 0;

                return (
                    <div className={cn(
                        "relative overflow-hidden p-6 rounded-2xl border transition-all duration-300",
                        isPositive
                            ? "bg-gradient-to-br from-emerald-500/5 via-background to-emerald-500/10 border-emerald-500/20 shadow-sm"
                            : "bg-gradient-to-br from-red-500/5 via-background to-red-500/10 border-red-500/20 shadow-sm"
                    )}>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-primary font-bold tracking-tight">
                                    <Calculator className="h-5 w-5 text-primary/70" />
                                    <span className="text-base uppercase tracking-wider text-muted-foreground/80 font-black">Final Profit Estimate</span>
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-muted" onClick={() => setShowProfitModal(true)}>
                                                    <Info className="h-3.5 w-3.5" />
                                                </Button>
                                            </TooltipTrigger>
                                            <TooltipContent>View deep breakdown</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                                <p className="text-xs text-muted-foreground max-w-md">
                                    Based on cumulative sales of <span className="font-bold text-foreground">{cycleTotalWeight.toLocaleString()}kg</span> and
                                    estimated costs for <span className="font-bold text-foreground">{doc} birds</span> and <span className="font-bold text-foreground">{totalFeedBags} bags</span>.
                                </p>
                            </div>

                            <div className="flex items-center gap-8 pr-4">
                                <div className="text-right space-y-0.5">
                                    <div className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Est. Revenue</div>
                                    <div className="text-lg font-bold">৳{formulaRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                                </div>
                                <div className="h-10 w-px bg-border/50"></div>
                                <div className="text-right space-y-0.5">
                                    <div className="text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest">Est. Profit</div>
                                    <div className={cn("text-3xl font-black tabular-nums tracking-tighter", isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600")}>
                                        ৳{formulaProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Background Decoration */}
                        <div className={cn(
                            "absolute -bottom-6 -right-6 h-32 w-32 rounded-full blur-3xl opacity-20 transition-colors",
                            isPositive ? "bg-emerald-500" : "bg-red-500"
                        )}></div>

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
                            age={sale.cycleContext?.age || 0}
                            totalWeight={cycleTotalWeight}
                            feedBags={totalFeedBags}
                        />
                    </div>
                );
            })()}
        </div>
    );
};

// ----------------------------------------------------------------------
// DESKTOP TABLE ROW
// ----------------------------------------------------------------------

export const DesktopSalesTable = ({ sales }: { sales: SaleEvent[] }) => {
    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b-none">
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="w-[120px]">Date</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead className="text-right">Age</TableHead>
                            <TableHead className="text-right">DOC</TableHead>
                            <TableHead className="text-right font-semibold">Sold</TableHead>
                            <TableHead className="text-right">Mortality</TableHead>
                            <TableHead className="text-right">Weight</TableHead>
                            <TableHead className="text-right font-bold text-emerald-600">Total</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">FCR/EPI</TableHead>
                            <TableHead className="w-[80px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sales.map((sale, index) => (
                            <DesktopSaleRow
                                key={sale.id}
                                sale={sale}
                                isLatest={(sale as any).isLatestInCycle ?? (index === 0)}
                            />
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

    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <TableRow className={cn("group cursor-pointer hover:bg-muted/10 transition-colors", isExpanded && "bg-muted/5 border-b-0")} onClick={() => setIsExpanded(!isExpanded)}>
                <TableCell className="py-3">
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 text-muted-foreground/50", isExpanded && "rotate-180")} />
                </TableCell>
                <TableCell className="font-medium py-3">
                    <div className="flex flex-col">
                        <span className="text-sm">{format(new Date(sale.saleDate), "dd MMM, yyyy")}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(sale.saleDate), "HH:mm")}</span>
                        {activeReport && (
                            <Badge variant="outline" className="mt-1 w-fit text-[9px] h-3.5 px-1 font-normal">
                                v{reports.length - reports.findIndex(r => r.id === activeReport.id)}
                            </Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell className="py-3">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-sm truncate max-w-[150px]">{sale.farmerName || sale.cycleName}</span>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="shrink-0 cursor-help">
                                        {sale.cycleContext?.isEnded ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        ) : (
                                            <CircleDashed className="h-3.5 w-3.5 text-blue-500 animate-[spin_3s_linear_infinite]" />
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p className="text-[10px]">{sale.cycleContext?.isEnded ? "Cycle Ended" : "Cycle Running"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        {sale.location && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                {sale.location} {sale.party && `• ${sale.party}`}
                            </span>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-right py-3 tabular-nums font-medium">{sale.cycleContext?.age || "N/A"}d</TableCell>
                <TableCell className="text-right py-3 tabular-nums text-muted-foreground">{sale.cycleContext?.doc?.toLocaleString() || sale.houseBirds?.toLocaleString()}</TableCell>
                <TableCell className="text-right py-3 tabular-nums font-bold text-foreground">{displayBirdsSold.toLocaleString()}</TableCell>
                <TableCell className="text-right py-3 tabular-nums text-red-500/80 font-medium">{displayMortality}</TableCell>
                <TableCell className="text-right py-3 tabular-nums">{parseFloat(displayTotalWeight).toLocaleString()} kg</TableCell>
                <TableCell className="text-right py-3 tabular-nums font-bold text-emerald-600">৳{parseFloat(displayTotalAmount).toLocaleString()}</TableCell>
                <TableCell className="text-right py-3 tabular-nums font-bold text-emerald-600">
                    {isLatest && sale.cycleContext?.isEnded ? (
                        (() => {
                            const formulaRevenue = sale.cycleContext.revenue || parseFloat(displayTotalAmount);
                            const totalFeedBags = sale.cycleContext.feedConsumed ?? 0;
                            const doc = sale.cycleContext.doc || sale.houseBirds || 0;
                            const feedCost = totalFeedBags * FEED_PRICE_PER_BAG;
                            const docCost = doc * DOC_PRICE_PER_BIRD;
                            const profit = formulaRevenue - (feedCost + docCost);
                            return `৳${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                        })()
                    ) : "-"}
                </TableCell>
                <TableCell className="text-right py-3 tabular-nums font-medium text-blue-600 dark:text-blue-400">
                    {isLatest && sale.cycleContext?.isEnded ? `${sale.cycleContext.fcr} / ${sale.cycleContext.epi}` : "-"}
                </TableCell>
                <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
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
                                {hasReports && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground/50 px-2 py-1">Versions</DropdownMenuLabel>
                                        {reports.map((report, idx) => (
                                            <DropdownMenuItem key={report.id} onClick={() => setSelectedReportId(report.id)}>
                                                <div className="flex justify-between w-full items-center gap-2">
                                                    <span>Version {reports.length - idx}</span>
                                                    {selectedReportId === report.id && <Check className="h-3 w-3" />}
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </>
                                )}
                                {((activeMode === "OFFICER" || (!activeMode && role === "OFFICER")) && canEdit) && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setIsAdjustOpen(true)}>
                                            <Pencil className="h-4 w-4 mr-2" /> Adjust Sale
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </TableCell>
            </TableRow>

            {/* Expanded Row Content */}
            {isExpanded && (
                <TableRow className="bg-muted/5 border-b hover:bg-transparent">
                    <TableCell colSpan={12} className="p-0">
                        <div className="px-6 lg:px-14 py-6 border-l-2 border-primary/20 bg-gradient-to-r from-background to-transparent animate-in slide-in-from-top-2 duration-200">
                            <div className="w-full">
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
                                    isMobileView={false}
                                />
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
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
    recent?: boolean;
    limit?: number;
    search?: string;
    showLoadMore?: boolean;
    onLoadMore?: () => void;
}

export const SalesHistoryCard = ({
    cycleId,
    historyId,
    farmerId,
    isMobile,
    recent = false,
    limit = 20,
    search = "",
    showLoadMore = false,
    onLoadMore
}: SalesHistoryCardProps) => {
    const trpc = useTRPC();
    const { isPro } = useCurrentOrg();

    // Use getRecentSales for global feed, or getSaleEvents for specific context
    const recentQuery = useQuery(
        trpc.officer.sales.getRecentSales.queryOptions(
            { limit, search },
            { enabled: isPro && recent }
        )
    );

    const eventsQuery = useQuery(
        trpc.officer.sales.getSaleEvents.queryOptions(
            {
                cycleId: cycleId || undefined,
                historyId: historyId || undefined,
                farmerId: farmerId || undefined
            },
            { enabled: isPro && !recent }
        )
    );

    const salesEvents = recent ? recentQuery.data : eventsQuery.data;
    const isLoading = recent ? recentQuery.isLoading : eventsQuery.isLoading;

    const groupedSales = useMemo(() => {
        const rawEvents = (salesEvents || []) as any[];
        if (rawEvents.length === 0) return [];

        // Map to SaleEvent interface (dates are strings from TRPC)
        const events: SaleEvent[] = rawEvents.map(e => ({
            ...e,
            saleDate: new Date(e.saleDate),
            createdAt: new Date(e.createdAt),
            reports: (e.reports || []).map((r: any) => ({
                ...r,
                createdAt: new Date(r.createdAt)
            }))
        }));

        // If not grouping by farmer, just return null (handled by direct renderSalesFeed call below)
        if (!farmerId) return null;

        const groups: Record<string, {
            name: string,
            sales: SaleEvent[],
            isEnded: boolean,
            doc: number,
            mortality: number,
            age: number,
            totalSold: number,
        }> = {};

        events.forEach(sale => {
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
            const group = groups[key]!;
            group.sales.push(sale);
            group.totalSold += (sale.birdsSold || 0);
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

    const renderSalesFeed = (events: SaleEvent[]) => {
        return (
            <TooltipProvider>
                <div className="space-y-6">
                    {/* Mobile View */}
                    <div className="md:hidden space-y-4">
                        {events.map((sale, index) => {
                            const cycleKey = sale.cycleId || sale.historyId;
                            const firstOccurrenceIdx = events.findIndex(s => (s.cycleId || s.historyId) === cycleKey);
                            const isLatestInCycle = index === firstOccurrenceIdx;

                            return (
                                <div key={sale.id} className="relative p-0 border-b pb-4 last:border-0">
                                    <SaleEventCard
                                        sale={{
                                            ...sale,
                                            saleDate: new Date(sale.saleDate),
                                            createdAt: new Date(sale.createdAt),
                                            reports: (sale.reports || []).map((r: any) => ({
                                                ...r,
                                                createdAt: new Date(r.createdAt)
                                            }))
                                        }}
                                        isLatest={isLatestInCycle}
                                        indexInGroup={index}
                                        totalInGroup={events.length}
                                    />
                                </div>
                            );
                        })}
                    </div>

                    {/* Desktop View */}
                    <div className="hidden md:block bg-background rounded-xl border shadow-sm overflow-hidden">
                        <DesktopSalesTable
                            sales={events.map((sale, index) => {
                                const cycleKey = sale.cycleId || sale.historyId;
                                const firstOccurrenceIdx = events.findIndex(s => (s.cycleId || s.historyId) === cycleKey);
                                const isLatestInCycle = index === firstOccurrenceIdx;

                                return {
                                    ...sale,
                                    saleDate: new Date(sale.saleDate),
                                    createdAt: new Date(sale.createdAt),
                                    reports: (sale.reports || []).map((r: any) => ({
                                        ...r,
                                        createdAt: new Date(r.createdAt)
                                    })),
                                    isLatestInCycle
                                };
                            })}
                        />
                    </div>

                    {showLoadMore && onLoadMore && events.length >= limit && !search && (
                        <div className="flex justify-center pt-4 pb-8">
                            <Button variant="outline" onClick={onLoadMore}>
                                Load More
                            </Button>
                        </div>
                    )}
                </div>
            </TooltipProvider>
        );
    };

    return (
        <div className={isMobile ? "space-y-3" : "space-y-4"}>
            {!isMobile && !recent && (
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
                                        <div className="col-span-1">
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="shrink-0 w-fit">
                                                            {group.isEnded ? (
                                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                            ) : (
                                                                <CircleDashed className="h-4 w-4 text-blue-500 animate-[spin_3s_linear_infinite]" />
                                                            )}
                                                        </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top">
                                                        <p className="text-[10px]">{group.isEnded ? "Cycle Ended" : "Cycle Running"}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        </div>
                                        <div className="col-span-3 sm:col-span-2 font-bold text-muted-foreground/80 uppercase tracking-tighter truncate">
                                            {group.sales.length} {group.sales.length > 1 ? "Sales" : "Sale"}
                                        </div>
                                        <div className="col-span-2 sm:col-span-3 flex items-center gap-0.5 sm:gap-1 pl-1">
                                            <span className="text-muted-foreground/40 text-[8px] uppercase font-bold hidden sm:inline-block">Age:</span>
                                            <span className="font-bold">{group.age}d</span>
                                        </div>
                                        <div className="col-span-3 flex items-center gap-0.5 sm:gap-1">
                                            <span className="text-muted-foreground/40 text-[8px] uppercase font-bold hidden sm:inline-block">DOC:</span>
                                            <span className="font-bold truncate">{group.doc.toLocaleString()}</span>
                                        </div>
                                        <div className="col-span-3 flex items-center justify-end gap-0.5 sm:gap-1">
                                            <span className="text-muted-foreground/40 text-[8px] uppercase font-bold hidden xs:inline-block">Sold:</span>
                                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{group.totalSold.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4 space-y-4 px-0">
                                    {renderSalesFeed(group.sales)}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    renderSalesFeed(salesEvents)
                )}
            </div>
        </div>
    );
};
