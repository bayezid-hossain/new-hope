"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatFeedBreakdown } from "@/modules/shared/lib/format";
import type { SaleEvent, SaleReport } from "@/modules/shared/types/sale";
import {
    Activity,
    Calculator,
    CreditCard,
    History,
    Info,
    PackageCheck,
    Scale,
    ShoppingBag,
    TrendingDown,
    Users,
    Warehouse,
    Weight,
    Zap,
} from "lucide-react";
import { FcrEpiDetailsModal } from "./fcr-epi-details-modal";
import { ProfitDetailsModal } from "./profit-details-modal";

export interface SaleDetailsContentProps {
    sale: SaleEvent;
    isLatest?: boolean;
    displayBirdsSold: number;
    displayTotalWeight: string;
    displayAvgWeight: string;
    displayPricePerKg: string;
    displayTotalAmount: string;
    displayMortality: number;
    selectedReport?: SaleReport | null;
    setShowFcrEpiModal: (open: boolean) => void;
    setShowProfitModal: (open: boolean) => void;
    showFcrEpiModal: boolean;
    showProfitModal: boolean;
    isMobileView?: boolean;
}

export const SaleDetailsContent = ({
    sale,
    isLatest = false,
    displayBirdsSold,
    displayTotalWeight,
    displayAvgWeight,
    displayPricePerKg,
    displayTotalAmount,
    displayMortality,
    selectedReport,
    setShowFcrEpiModal,
    setShowProfitModal,
    showFcrEpiModal,
    showProfitModal,
    isMobileView = false
}: SaleDetailsContentProps) => {
    // Inventory data from either report or parent sale
    const currentFeedConsumed = selectedReport?.feedConsumed
        ? JSON.parse(selectedReport.feedConsumed) as { type: string; bags: number }[]
        : sale.feedConsumed;

    const currentFeedStock = selectedReport?.feedStock
        ? JSON.parse(selectedReport.feedStock) as { type: string; bags: number }[]
        : sale.feedStock;

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
                        <span className="font-medium bg-muted/40 px-1.5 py-0.5 rounded block w-fit whitespace-pre-line">{formatFeedBreakdown(currentFeedConsumed)}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground block mb-0.5">Feed Stock:</span>
                        <span className="font-medium bg-muted/40 px-1.5 py-0.5 rounded block w-fit whitespace-pre-line">{formatFeedBreakdown(currentFeedStock)}</span>
                    </div>
                </div>

                {/* Profit Card */}
                {isLatest && sale.cycleContext && sale.cycleContext.isEnded && (() => {
                    const ctx = sale.cycleContext;
                    const cycleTotalWeight = ctx.totalWeight || 0;
                    const formulaRevenue = ctx.revenue || 0;
                    const actualRevenue = ctx.actualRevenue || 0;
                    const effectiveRate = ctx.effectiveRate || 0;
                    const netAdjustment = ctx.netAdjustment || 0;
                    const fcr = ctx.fcr || 0;
                    const epi = ctx.epi || 0;
                    const mortality = ctx.mortality || 0;
                    const avgPrice = ctx.avgPrice || 0;
                    const totalFeedBags = ctx.feedConsumed ?? 0;
                    const doc = ctx.doc || 0;
                    const feedCost = ctx.feedCost || 0;
                    const docCost = ctx.docCost || 0;
                    const formulaProfit = ctx.profit || 0;
                    const isEnded = ctx.isEnded;

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
                        {isLatest && sale.cycleContext?.isEnded && (
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
                                    {formatFeedBreakdown(currentFeedConsumed)}
                                </div>
                            </div>
                            <div className="group">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <Warehouse className="h-3.5 w-3.5 text-muted-foreground/60" />
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-tight">Current Stock</span>
                                </div>
                                <div className="text-xs font-medium bg-muted/30 p-2 rounded-md border border-border/40 whitespace-pre-line leading-relaxed italic">
                                    {formatFeedBreakdown(currentFeedStock)}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* INTEGRATED PROFIT ESTIMATE CARD - ONLY ON LATEST SALE OF ENDED CYCLE */}
            {isLatest && sale.cycleContext && sale.cycleContext.isEnded && (() => {
                const ctx = sale.cycleContext;
                const cycleTotalWeight = ctx.totalWeight || 0;
                const formulaRevenue = ctx.revenue || 0;
                const actualRevenue = ctx.actualRevenue || 0;
                const effectiveRate = ctx.effectiveRate || 0;
                const netAdjustment = ctx.netAdjustment || 0;
                const fcr = ctx.fcr || 0;
                const epi = ctx.epi || 0;
                const mortality = ctx.mortality || 0;
                const avgPrice = ctx.avgPrice || 0;
                const totalFeedBags = ctx.feedConsumed ?? 0;
                const doc = ctx.doc || 0;
                const feedCost = ctx.feedCost || 0;
                const docCost = ctx.docCost || 0;
                const formulaProfit = ctx.profit || 0;
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
                                    <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-muted" onClick={() => setShowProfitModal(true)}>
                                        <Info className="h-3.5 w-3.5" />
                                    </Button>
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
