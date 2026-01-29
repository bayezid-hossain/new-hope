"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowRight, Box, Wheat } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

interface MobileFarmerCardProps {
    farmer: any;
    prefix?: string;
    variant?: "elevated" | "flat";
    className?: string;
    actions?: React.ReactNode;
}

export const MobileFarmerCard = ({ farmer, prefix, variant = "elevated", className, actions }: MobileFarmerCardProps) => {
    const cardRef = useRef<HTMLDivElement>(null);
    const detailLink = prefix ? `${prefix}/farmers/${farmer.id}` : `/farmers/${farmer.id}`;

    // Calculate stats
    const activeConsumption = farmer.cycles?.reduce((acc: number, c: any) => acc + (parseFloat(c.intake) || 0), 0) || 0;
    const mainStock = farmer.mainStock || 0;
    const remaining = mainStock - activeConsumption;
    const isLow = remaining < 3;

    return (
        <div
            ref={cardRef}
            onClick={(e) => {
                if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) return;
                window.location.href = detailLink;
            }}
            className={cn(
                "transition-transform cursor-pointer active:scale-[0.98]",
                variant === "elevated"
                    ? "bg-white p-3 rounded-xl border border-slate-200 shadow-sm"
                    : "p-3 space-y-2 active:bg-slate-50 border-b border-slate-100 last:border-0",
                className
            )}
        >
            {/* Header: Name, Status, Officer */}
            <div className="flex justify-between items-start mb-2">
                <div className="space-y-0.5">
                    <Link
                        href={detailLink}
                        className="font-bold text-slate-900 hover:text-primary hover:underline underline-offset-2 text-base"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {farmer.name}
                    </Link>
                    {farmer.officerName && (
                        <p className="text-[10px] text-slate-400 font-medium">
                            Officer: <span className="text-slate-600">{farmer.officerName}</span>
                        </p>
                    )}
                </div>
                {farmer.activeCyclesCount > 0 ? (
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold text-[10px] px-1.5 h-5">ACTIVE</Badge>
                ) : (
                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none font-bold text-[10px] px-1.5 h-5">IDLE</Badge>
                )}
            </div>

            {/* Metrics: Stock & Consumption (Emphasized) */}
            <div className={cn("grid grid-cols-3 gap-3", variant === "elevated" ? "py-2 border-y border-slate-50" : "py-1")}>

                {/* Stock / Remaining */}
                <div className="flex flex-col justify-center p-2 rounded-lg bg-emerald-50/50 border border-emerald-100/50">
                    <span className="text-[10px] text-emerald-600/70 font-bold uppercase tracking-wider mb-0.5">Available Stock</span>
                    <div className="flex items-baseline gap-1">
                        <Wheat className={cn("h-4 w-4", isLow ? "text-red-500" : "text-emerald-500")} />
                        <span className={cn("text-xl font-black leading-none", isLow ? "text-red-600" : "text-emerald-700")}>
                            {remaining.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-medium text-emerald-600/60">bags</span>
                    </div>
                </div>

                {/* Consumption / Used */}
                <div className="flex flex-col justify-center p-2 rounded-lg bg-amber-50/50 border border-amber-100/50 text-center items-center">
                    <span className="text-[10px] text-amber-600/70 font-bold uppercase tracking-wider mb-0.5">Used in Cycles</span>
                    <div className="flex items-baseline gap-1 justify-end">
                        <span className="text-xl font-black text-amber-700 leading-none">
                            {activeConsumption.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-medium text-amber-600/60">bags</span>
                    </div>
                </div>
                {/* total stock */}
                <div className="flex flex-col justify-center p-2 rounded-lg bg-blue-500 border border-white text-right items-end shadow-sm">
                    <span className="text-[10px] text-white font-bold uppercase tracking-wider mb-0.5">Total Stock</span>
                    <div className="flex items-baseline gap-1 justify-end">
                        <Box className={cn("h-4 w-4", isLow ? "text-red-500" : "text-white")} />
                        <span className="text-xl font-black text-white leading-none">
                            {mainStock.toFixed(1)}
                        </span>
                        <span className="text-[10px] font-medium text-white">bags</span>
                    </div>
                </div>
            </div>

            {/* Actions (Optional) */}
            {actions && (
                <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                    {actions}
                </div>
            )}

            {/* Footer: Joined Date, Arrow */}
            <div className={cn("flex justify-between items-center text-[10px] text-slate-400", actions ? "pt-2 border-t border-slate-50 mt-2" : "pt-2")}>
                <span>Joined {farmer.createdAt ? format(new Date(farmer.createdAt), "MMM d, yyyy") : "-"}</span>
                <span className="flex items-center gap-1 text-primary hover:text-primary/80 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    View <ArrowRight className="h-2.5 w-2.5" />
                </span>
            </div>
        </div>
    );
};
