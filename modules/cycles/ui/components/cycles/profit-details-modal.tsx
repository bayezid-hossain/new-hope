"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Separator } from "@/components/ui/separator";
import { BASE_SELLING_PRICE, DOC_PRICE_PER_BIRD, FEED_PRICE_PER_BAG } from "@/constants";
import { Coins, Scale } from "lucide-react";

interface ProfitDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Data props
    revenue: number; // This is the formula revenue (Weighted)
    actualRevenue: number; // This is the sum of (price * weight)
    totalWeight: number;
    avgPrice: number;
    effectiveRate: number;
    netAdjustment: number;
    feedBags: number;
    docCount: number;
    feedCost: number;
    docCost: number;
    profit: number;
}

export const ProfitDetailsModal = ({
    open,
    onOpenChange,
    revenue,
    actualRevenue,
    totalWeight,
    avgPrice,
    effectiveRate,
    netAdjustment,
    feedBags,
    docCount,
    feedCost,
    docCost,
    profit,
}: ProfitDetailsModalProps) => {
    // Check if there is a discrepancy between actual revenue and formula revenue
    const adjustmentType = netAdjustment > 0 ? "surplus" : netAdjustment < 0 ? "deficit" : "neutral";
    const baseRevenue = totalWeight * BASE_SELLING_PRICE;

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Profit Calculation Details"
            description="Step-by-step breakdown of the farmer's profit estimation."
        >
            <div className="space-y-6 pt-2 max-h-[80vh] overflow-y-auto px-1">
                {/* Formula Summary */}
                <div className="bg-muted/30 p-3 rounded-lg text-xs font-mono text-muted-foreground border border-border/50">
                    <p className="font-semibold text-foreground mb-1">Profit Formula:</p>
                    <p>(Weight × Effective Rate) - (Feed Cost + DOC Cost)</p>
                    <p className="mt-1 opacity-70">Effective Rate = max(141, 141 + Σ Independent Adjustments)</p>
                </div>

                {/* Step 0: Average Price */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs">A</div>
                        Average Selling Price
                    </div>
                    <div className="ml-8 text-sm space-y-2">
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <span className="text-muted-foreground text-xs">Total Sales Income</span>
                            <span className="font-mono">৳{actualRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <span className="text-muted-foreground text-xs">Total Meat Sold</span>
                            <span className="font-mono">{totalWeight.toLocaleString()} kg</span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-md">
                            <div className="flex flex-col">
                                <span className="font-medium text-xs">Weighted Average Rate</span>
                                <span className="text-[10px] text-muted-foreground opacity-70">
                                    Total Income / Total Weight
                                </span>
                            </div>
                            <span className="font-bold text-blue-700 dark:text-blue-400 font-mono">
                                ৳{avgPrice.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Step 1: Effective Rate */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs">1</div>
                        Effective Rate Calculation
                    </div>
                    <div className="ml-8 text-sm space-y-2">
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <span className="text-muted-foreground text-xs">Base Rate</span>
                            <span className="font-mono">৳{BASE_SELLING_PRICE}</span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">Total Net Adjustment</span>
                                <span className="text-[10px] opacity-70 text-muted-foreground">Σ Surplus(P-141)/2 + Σ Deficit(P-141)</span>
                            </div>
                            <span className={`font-mono ${netAdjustment >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                {netAdjustment >= 0 ? "+" : ""}{netAdjustment.toFixed(2)} tk
                            </span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-primary/5 border border-primary/20 rounded-md">
                            <div className="flex flex-col">
                                <span className="font-medium text-xs">Farmer's Effective Rate</span>
                                <span className="text-[10px] text-muted-foreground opacity-70">
                                    max({BASE_SELLING_PRICE}, {BASE_SELLING_PRICE} + {netAdjustment.toFixed(2)})
                                </span>
                            </div>
                            <span className="font-bold text-primary font-mono">৳{effectiveRate.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Step 2: Revenue */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 text-xs">2</div>
                        Formula Revenue
                    </div>
                    <div className="ml-8 text-sm space-y-2">
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <span className="text-muted-foreground text-xs flex items-center gap-2">
                                <Scale className="h-3 w-3" /> Total Meat Sold
                            </span>
                            <span className="font-mono">{totalWeight.toLocaleString()} kg</span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/30 rounded-md">
                            <div className="flex flex-col">
                                <span className="font-medium text-xs">Total Formula Revenue</span>
                                <span className="text-[10px] text-muted-foreground opacity-70">
                                    {totalWeight.toLocaleString()} kg × ৳{effectiveRate.toFixed(2)}
                                </span>
                            </div>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono">
                                ৳{revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </span>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Step 3: Costs */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-red-600 dark:text-red-400">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs">3</div>
                        Cost Deduction
                    </div>
                    <div className="ml-8 text-sm space-y-2">
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">Feed Cost</span>
                                <span className="text-[10px] text-muted-foreground opacity-70">
                                    {feedBags.toLocaleString()} bags × {FEED_PRICE_PER_BAG}
                                </span>
                            </div>
                            <span className="font-mono text-red-600/80">
                                - ৳{feedCost.toLocaleString()}
                            </span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs">DOC Cost</span>
                                <span className="text-[10px] text-muted-foreground opacity-70">
                                    {docCount.toLocaleString()} birds × {DOC_PRICE_PER_BIRD}
                                </span>
                            </div>
                            <span className="font-mono text-red-600/80">
                                - ৳{docCost.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex justify-end pt-1">
                            <div className="text-xs font-semibold text-red-600">
                                Total Deductions: ৳{(feedCost + docCost).toLocaleString()}
                            </div>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Final Profit */}
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/10 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
                    <div className="flex justify-between items-center">
                        <div className="flex flex-col gap-1">
                            <span className="font-bold text-lg text-amber-900 dark:text-amber-100 flex items-center gap-2">
                                <Coins className="h-5 w-5" /> Net Profit
                            </span>
                            <span className="text-xs text-amber-700 dark:text-amber-400">
                                Revenue - (Feed + DOC)
                            </span>
                        </div>
                        <div className="text-2xl font-bold font-mono text-foreground">
                            ৳{profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </div>
                    </div>
                </div>
            </div>
        </ResponsiveDialog>
    );
};
