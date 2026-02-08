"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Separator } from "@/components/ui/separator";
import { Calculator, Gauge, Percent, Scale } from "lucide-react";

interface FcrEpiDetailsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    // Data props
    fcr: number;
    epi: number;
    doc: number;
    mortality: number;
    age: number;
    totalWeight: number;
    feedBags: number;
}

export const FcrEpiDetailsModal = ({
    open,
    onOpenChange,
    fcr,
    epi,
    doc,
    mortality,
    age,
    totalWeight,
    feedBags,
}: FcrEpiDetailsModalProps) => {
    const survivors = doc - mortality;
    const survivalRate = doc > 0 ? (survivors / doc) * 100 : 0;
    const feedKg = feedBags * 50;
    const avgWeightKg = survivors > 0 ? totalWeight / survivors : 0;

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Performance Details"
            description="Detailed breakdown of production metrics (FCR & EPI)."
        >
            <div className="space-y-6 pt-2 pb-8 max-h-[70vh] overflow-y-auto px-1">
                {/* Step 1: FCR */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                            <Scale className="h-3.5 w-3.5" />
                        </div>
                        Feed Conversion Ratio (FCR)
                    </div>
                    <div className="ml-8 text-sm space-y-2">
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs font-medium">Total Feed Consumed</span>
                                <span className="text-[10px] text-muted-foreground opacity-70">
                                    {feedBags.toLocaleString()} bags × 50kg
                                </span>
                            </div>
                            <span className="font-mono">{feedKg.toLocaleString()} kg</span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <span className="text-muted-foreground text-xs font-medium">Total Live Weight Sell</span>
                            <span className="font-mono">{totalWeight.toLocaleString()} kg</span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-md">
                            <div className="flex flex-col">
                                <span className="font-medium text-xs">Final FCR</span>
                                <span className="text-[10px] text-muted-foreground opacity-70">
                                    Total Feed (kg) / Total Weight (kg)
                                </span>
                            </div>
                            <span className="font-bold text-blue-700 dark:text-blue-400 font-mono text-lg">
                                {fcr.toFixed(2)}
                            </span>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Step 2: Survival and Weight */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                            <Percent className="h-3.5 w-3.5" />
                        </div>
                        Survival & Growth
                    </div>
                    <div className="ml-8 text-sm space-y-2">
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs font-medium">Survival Rate</span>
                                <span className="text-[10px] text-muted-foreground opacity-70">
                                    ({survivors.toLocaleString()} / {doc.toLocaleString()}) × 100
                                </span>
                            </div>
                            <span className="font-mono">{survivalRate.toFixed(1)}%</span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <div className="flex flex-col">
                                <span className="text-muted-foreground text-xs font-medium">Avg. Weight per Bird</span>
                                <span className="text-[10px] text-muted-foreground opacity-70">
                                    {totalWeight.toLocaleString()}kg / {survivors.toLocaleString()} birds
                                </span>
                            </div>
                            <span className="font-mono">{avgWeightKg.toFixed(3)} kg</span>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Step 3: EPI */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                        <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary">
                            <Gauge className="h-3.5 w-3.5" />
                        </div>
                        European Production Index (EPI)
                    </div>
                    <div className="ml-8 text-sm space-y-2">
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-muted/20 rounded-md">
                            <span className="text-muted-foreground text-xs font-medium">Cycle Duration</span>
                            <span className="font-mono">{age} Days</span>
                        </div>
                        <div className="grid grid-cols-[1fr,auto] gap-4 items-center p-2 bg-primary/10 border border-primary/20 rounded-md">
                            <div className="flex flex-col">
                                <span className="font-medium text-xs">Final EPI</span>
                                <span className="text-[10px] text-muted-foreground opacity-70">
                                    (Survival % × Avg Weight) / (FCR × Age) × 100
                                </span>
                            </div>
                            <span className="font-bold text-primary font-mono text-lg">
                                {epi.toFixed(0)}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/20 rounded-lg">
                    <Calculator className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-[11px] text-amber-800 dark:text-amber-400 leading-tight">
                        EPI values above 300 indicate professional performance. FCR measures how many kg of feed is needed per 1kg of meat.
                    </p>
                </div>
            </div>
        </ResponsiveDialog>
    );
};
