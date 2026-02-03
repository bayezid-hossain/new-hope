"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ArrowRight, Bird, Trash2, Wheat, Wrench } from "lucide-react";
import Link from "next/link";
import { memo, useRef } from "react";

interface MobileFarmerCardProps {
    farmer: any;
    prefix?: string;
    variant?: "elevated" | "flat";
    className?: string;
    actions?: React.ReactNode;
    onEdit?: () => void;
    onDelete?: () => void;
}

export const MobileFarmerCard = memo(({ farmer, prefix, variant = "elevated", className, actions, onEdit, onDelete }: MobileFarmerCardProps) => {
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
                    ? "bg-card p-2 xs:p-2.5 sm:p-3 rounded-xl border border-border shadow-sm"
                    : "p-2 xs:p-2.5 sm:p-3 space-y-1 sm:space-y-2 active:bg-muted border-b border-border last:border-0",
                className
            )}
        >
            {/* Header: Name, Status, Officer */}
            <div className="flex justify-between items-start mb-2">
                <div className="space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5 xs:gap-2">
                        <Link
                            href={detailLink}
                            className="font-bold text-foreground hover:text-primary hover:underline underline-offset-2 text-[12px] xs:text-sm sm:text-base leading-none"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {farmer.name}
                        </Link>
                        {onEdit && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onEdit();
                                }}
                                className="p-1 xs:p-1 sm:p-1.5 hover:bg-muted rounded-md text-muted-foreground hover:text-primary transition-colors inline-flex"
                            >
                                <Wrench className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-3.5 sm:w-3.5" />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                className="p-1 xs:p-1 sm:p-1.5 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive transition-colors inline-flex"
                            >
                                <Trash2 className="h-2.5 w-2.5 xs:h-3 xs:w-3 sm:h-3.5 sm:w-3.5" />
                            </button>
                        )}
                        {farmer.status === "deleted" ? (
                            <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 font-bold text-[9px] xs:text-[10px] px-1 xs:px-1.5 h-4 xs:h-5 flex items-center shadow-none">DELETED</Badge>
                        ) : farmer.activeCyclesCount > 0 ? (
                            <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-none font-bold text-[9px] xs:text-[10px] px-1 xs:px-1.5 h-4 xs:h-5 flex items-center shadow-none">ACTIVE</Badge>

                        ) : (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground border-none font-bold text-[9px] xs:text-[10px] px-1 xs:px-1.5 h-4 xs:h-5 flex items-center shadow-none">IDLE</Badge>
                        )}
                    </div>

                    {farmer.officerName && (
                        <p className="text-[10px] text-muted-foreground font-medium">
                            Officer: <span className="text-foreground/80">{farmer.officerName}</span>
                        </p>
                    )}
                </div>


                <div className="flex items-center gap-1.5 font-bold text-primary text-[10px] uppercase tracking-wider">
                    <Bird className="h-3 w-3" /> {farmer.activeCyclesCount} / {farmer.pastCyclesCount}

                </div>

            </div>

            {/* Metrics: Stock & Consumption (Emphasized) */}
            <div className={cn("grid gap-1 xs:gap-2 sm:gap-3", farmer.status === "deleted" ? "grid-cols-1" : "grid-cols-3", variant === "elevated" ? "py-1 xs:py-1.5 sm:py-2 border-y border-border/50" : "py-1")}>

                {/* Stock / Remaining */}
                <div className={cn(
                    "flex flex-col justify-center p-1 xs:p-1.5 sm:p-2 rounded-lg border",
                    farmer.status === "deleted" ? "bg-muted border-border items-center text-center" : "bg-primary/5 border-primary/20"
                )}>
                    <span className={cn(
                        "text-[9px] xs:text-[10px] font-bold uppercase tracking-wider mb-0.5",
                        farmer.status === "deleted" ? "text-muted-foreground" : "text-primary/70"
                    )}>
                        {farmer.status === "deleted" ? "Remaining" : "Stock"}
                    </span>
                    <div className="flex items-baseline gap-1">
                        <Wheat className={cn("h-4 w-4", farmer.status === "deleted" ? "text-muted-foreground/50" : (isLow ? "text-destructive" : "text-primary"))} />
                        <span className={cn(
                            "text-base xs:text-lg sm:text-xl font-black leading-none",
                            farmer.status === "deleted" ? "text-foreground/70" : (isLow ? "text-destructive" : "text-primary")
                        )}>
                            {remaining.toFixed(1)}
                        </span>
                        <span className={cn(
                            "text-[9px] xs:text-[10px] font-medium",
                            farmer.status === "deleted" ? "text-muted-foreground/60" : "text-primary/60"
                        )}>b</span>
                    </div>
                </div>

                {farmer.status !== "deleted" && (
                    <>
                        {/* Consumption / Used */}
                        <div className="flex flex-col justify-center p-1 xs:p-1.5 sm:p-2 rounded-lg bg-amber-500/10 dark:bg-amber-900/30 border border-amber-500/20 dark:border-amber-800/30 text-center items-center">
                            <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-500 font-bold uppercase tracking-wider mb-0.5">Used</span>
                            <div className="flex items-baseline gap-1 justify-end">
                                <span className="text-base xs:text-lg sm:text-xl font-black text-amber-600 dark:text-amber-500 leading-none">
                                    {activeConsumption.toFixed(1)}
                                </span>
                                <span className="text-[9px] xs:text-[10px] font-medium text-amber-600/60 dark:text-amber-500/60">b</span>
                            </div>
                        </div>
                        {/* total stock */}
                        <div className="flex flex-col justify-center p-1 xs:p-1.5 sm:p-2 rounded-lg bg-primary border border-primary-foreground/10 text-right items-end shadow-sm">
                            <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-primary-foreground font-bold uppercase tracking-wider mb-0.5">Total</span>
                            <div className="flex items-baseline gap-1 justify-end">
                                <span className="text-base xs:text-lg sm:text-xl font-black text-primary-foreground leading-none">
                                    {mainStock.toFixed(1)}
                                </span>
                                <span className="text-[9px] xs:text-[10px] font-medium text-primary-foreground">b</span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Actions (Optional) */}
            {actions && (
                <div className="pt-2" onClick={(e) => e.stopPropagation()}>
                    {actions}
                </div>
            )}

            {/* Footer: Date, Arrow */}
            <div className={cn("flex justify-between items-center text-[10px] text-muted-foreground", actions ? "pt-2 border-t border-border mt-2" : "pt-2")}>
                <span>
                    {farmer.status === "deleted"
                        ? `Archived ${farmer.deletedAt ? format(new Date(farmer.deletedAt), "MMM d, yyyy") : format(new Date(farmer.updatedAt), "MMM d, yyyy")}`
                        : `Joined ${farmer.createdAt ? format(new Date(farmer.createdAt), "MMM d, yyyy") : "-"}`
                    }
                </span>
                <span className="flex items-center gap-1 text-primary hover:text-primary/80 font-bold transition-opacity">
                    View <ArrowRight className="h-2.5 w-2.5" />
                </span>
            </div>
        </div>
    );
});

MobileFarmerCard.displayName = "MobileFarmerCard";
