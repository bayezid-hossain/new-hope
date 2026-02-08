"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { BASE_SELLING_PRICE, DOC_PRICE_PER_BIRD, FEED_PRICE_PER_BAG } from "@/constants";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calculator, Check, ChevronDown, ClipboardCopy, History, Pencil, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdjustSaleModal } from "./adjust-sale-modal";

import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    };
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
Location: ${sale.location}
House bird : ${sale.houseBirds}pcs
Total Sold : ${birdsSold}pcs
Total Mortality: ${totalMortality} pcs

Weight: ${totalWeight} kg
Avg. Weight: ${avgWeight} kg

FCR: ${isEnded ? fcr : 0}
EPI: ${isEnded ? epi : 0}

Price : ${pricePerKg} tk
Total taka : ${parseFloat(totalAmount).toLocaleString()} tk
Deposit: ${depositReceived ? `${parseFloat(depositReceived).toLocaleString()} tk` : ""}
Cash: ${parseFloat(cashReceived || "0").toLocaleString()} tk

Feed: ${feedTotal} bags
${feedBreakdown}

Stock: 
${stockBreakdown}

Medicine: ${medicineCost ? parseFloat(medicineCost).toLocaleString() : 0} tk
`;
};

export const SaleEventCard = ({ sale }: { sale: SaleEvent }) => {
    const [copied, setCopied] = useState(false);
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const { role, activeMode } = useCurrentOrg();

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

    return (
        <>
            <Card className="border-border/50 shadow-sm overflow-hidden gap-2">
                <CardHeader className="pb-3 px-3 sm:px-6 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                            <CardTitle className="text-sm font-semibold flex flex-wrap items-center gap-2">
                                <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                                <span className="truncate">{sale.cycleName}</span>
                                {sale.cycleName && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground bg-background shrink-0">
                                        {sale.location}
                                    </Badge>
                                )}

                            </CardTitle>
                            <CardDescription className="text-xs mt-0.5 ml-6">
                                {format(new Date(sale.saleDate), "MMM d, yyyy HH:mm")}
                            </CardDescription>
                        </div>
                        <div className="flex gap-2 shrink-0 w-full sm:w-auto ml-6 sm:ml-0" onClick={(e) => e.stopPropagation()}>
                            {(activeMode === "OFFICER" || (!activeMode && role === "OFFICER")) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsAdjustOpen(true)}
                                    className="h-8 px-2.5 text-xs flex-1 sm:flex-none"
                                >
                                    <Pencil className="h-3.5 w-3.5 mr-1" />
                                    Adjust
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                                className="h-8 px-2.5 text-xs gap-1.5 flex-1 sm:flex-none"
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                                Copy
                            </Button>
                        </div>
                    </div>

                    {isExpanded && hasReports && (
                        <div className="flex items-center gap-2 mt-3 ml-6" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground">
                                        <History className="h-3.5 w-3.5 mr-1.5" />
                                        {activeReport ? (
                                            `Version ${reports.length - reports.findIndex(r => r.id === activeReport.id)} • ${format(new Date(activeReport.createdAt), "MMM d, HH:mm")} `
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
                                                    {format(new Date(report.createdAt), "MMM d, yyyy HH:mm")} by {report.createdByUser?.name}
                                                </span>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}

                    {isExpanded && activeReport?.adjustmentNote && (
                        <div className="mt-2 ml-6 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded px-2 py-1.5 text-xs text-muted-foreground italic">
                            Note: {activeReport.adjustmentNote}
                        </div>
                    )}
                </CardHeader>
                {isExpanded && (
                    <CardContent className="pt-4 px-3 sm:px-6 gap-2">
                        {/* FCR/EPI Row - Prominent at top */}
                        {sale.cycleContext && (
                            <div className="flex gap-3 mb-4">
                                <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 rounded-lg p-3 border border-blue-100 dark:border-blue-900/50">
                                    <div className="text-[10px] uppercase tracking-wider text-blue-600 dark:text-blue-400 font-medium">FCR</div>
                                    <div className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                        {sale.cycleContext.isEnded ? sale.cycleContext.fcr : <span className="text-muted-foreground text-sm">N/A</span>}
                                    </div>
                                </div>
                                <div className="flex-1 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-lg p-3 border border-emerald-100 dark:border-emerald-900/50">
                                    <div className="text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-medium">EPI</div>
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

                        {/* Farmer Profit Calculation */}
                        {(() => {
                            const totalFeedBags = calculateTotalBags(sale.feedConsumed);
                            const totalWeight = parseFloat(displayTotalWeight) || 0;
                            const pricePerKg = parseFloat(displayPricePerKg) || 0;
                            const doc = sale.cycleContext?.doc || sale.houseBirds || 0;

                            if (totalFeedBags <= 0 || totalWeight <= 0) return null;

                            const feedCost = totalFeedBags * FEED_PRICE_PER_BAG;
                            const docCost = doc * DOC_PRICE_PER_BIRD;

                            const revenue = pricePerKg > BASE_SELLING_PRICE
                                ? (BASE_SELLING_PRICE + (pricePerKg - BASE_SELLING_PRICE) / 2) * totalWeight
                                : BASE_SELLING_PRICE * totalWeight;
                            const profit = revenue - (feedCost + docCost);

                            return (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-300 mb-3">
                                        <Calculator className="h-4 w-4" /> Farmer&apos;s Profit Estimate
                                    </div>
                                    <div className="space-y-1 text-sm font-mono">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Revenue</span>
                                            <span className="font-medium">{revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                        </div>
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
                                            <span>Profit</span>
                                            <span className={profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                                                {profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
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

interface SalesHistoryCardProps {
    cycleId?: string | null;
    historyId?: string | null;
    farmerId?: string | null;
    isMobile?: boolean;
}

import { Lock, Sparkles } from "lucide-react";

// ... existing imports

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
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {salesEvents.map((sale) => (
                    // @ts-ignore
                    <SaleEventCard key={sale.id} sale={sale} />
                ))}
            </div>
        </div>
    );
};
