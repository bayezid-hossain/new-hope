
"use client";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Activity, AlertTriangle, Bird, Layers, Wheat } from "lucide-react";

interface KpiCardsProps {
    totalBirds: number;
    totalBirdsSold?: number;
    totalFeedStock: number;
    activeConsumption: number;
    availableStock: number;
    lowStockCount: number;
    avgMortality: string;
    activeCyclesCount: number;
    totalFarmers?: number;
}

export const KpiCards = ({ totalBirds, totalBirdsSold = 0, totalFeedStock, activeConsumption, availableStock, lowStockCount, avgMortality, activeCyclesCount, totalFarmers }: KpiCardsProps) => {
    const items = [
        {
            label: "Live Birds",
            value: totalBirds.toLocaleString(),
            icon: Bird,
            color: "text-emerald-500",
            bg: "bg-emerald-500/10",
            subValue: totalBirdsSold > 0 ? `${totalBirdsSold.toLocaleString()} sold` : undefined,
            description: `Across ${activeCyclesCount} active cycles`
        },
        {
            label: "Feed Inventory",
            value: `${availableStock.toFixed(1)} Bags`,
            icon: Layers,
            color: "text-amber-500",
            bg: "bg-amber-500/10",
            subValue: `+${activeConsumption.toFixed(1)} active`,
            description: `Total: ${totalFeedStock.toFixed(1)}`
        },
        {
            label: "Avg. Mortality",
            value: `${avgMortality}%`,
            icon: Activity,
            color: "text-violet-500",
            bg: "bg-violet-500/10",
            description: "Active average"
        },
        {
            label: "Low Stock",
            value: lowStockCount,
            icon: AlertTriangle,
            color: lowStockCount > 0 ? "text-destructive" : "text-muted-foreground",
            bg: lowStockCount > 0 ? "bg-destructive/10" : "bg-muted/50",
            description: "Immediate alerts",
            isAlert: lowStockCount > 0
        },
        ...(totalFarmers !== undefined ? [{
            label: "Total Farmers",
            value: totalFarmers.toLocaleString(),
            icon: Wheat,
            color: "text-sky-500",
            bg: "bg-sky-500/10",
            description: "Active under you",
            isAlert: false,
            subValue: undefined as string | undefined
        }] : [])
    ];

    return (
        <div className="grid gap-4 xs:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {items.map((item, i) => (
                <Card key={i} className={cn(
                    "relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group rounded-2xl md:rounded-[2rem]",
                    item.isAlert && "border-destructive/20 bg-destructive/5"
                )}>
                    <div className={cn(
                        "absolute top-0 left-0 w-1 h-full opacity-20 group-hover:opacity-100 transition-opacity",
                        item.isAlert ? "bg-destructive" : item.color.replace("text-", "bg-")
                    )} />

                    <CardHeader className="flex flex-row items-center justify-between pb-2 p-5 md:p-6">
                        <span className="text-[10px] md:text-[11px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">{item.label}</span>
                        <div className={cn(
                            "p-2.5 rounded-xl md:rounded-2xl ring-1 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm",
                            item.bg,
                            item.isAlert ? "ring-destructive/20" : "ring-border/50"
                        )}>
                            <item.icon className={cn("h-4 w-4 md:h-5 md:w-5", item.color)} />
                        </div>
                    </CardHeader>

                    <CardContent className="px-5 md:px-6 pb-5 md:pb-6">
                        <div className={cn(
                            "text-2xl md:text-3xl font-black tracking-tighter text-foreground group-hover:translate-x-1 transition-transform",
                            item.isAlert && "text-destructive"
                        )}>
                            {item.value || 0}
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-1">
                            <p className="text-[10px] md:text-xs text-muted-foreground/50 font-bold uppercase tracking-widest truncate">{item.description}</p>
                            {item.subValue && (
                                <span className="text-[10px] font-black text-amber-500/80 bg-amber-500/5 px-2 py-0.5 rounded-full border border-amber-500/10 whitespace-nowrap">
                                    {item.subValue}
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};
