"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Farmer, FarmerHistory } from "@/modules/cycles/types";
import { format } from "date-fns";
import {
    Bird,
    Wheat
} from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { ActionsCell, HistoryActionsCell } from "../shared/columns-factory";

interface MobileCycleCardProps {
    cycle: any;
    prefix?: string;
    currentId?: string;
    variant?: "elevated" | "flat";
    showName?: boolean;
    className?: string;
}

export const MobileCycleCard = ({ cycle, prefix, currentId, variant = "elevated", showName = true, className }: MobileCycleCardProps) => {

    const cardRef = useRef<HTMLDivElement>(null);
    const isCurrent = cycle.id === currentId;
    // Map properties safely
    const cycleName = cycle.name || cycle.cycleName || cycle.farmerName;
    const intakeValue = parseFloat(cycle.intake || cycle.finalIntake || "0");
    const docValue = Number(cycle.doc || 0);
    const mortalityValue = Number(cycle.mortality || 0);
    const soldValue = Number(cycle.birdsSold || 0);
    const liveBirdsValue = Math.max(0, docValue - mortalityValue - soldValue);

    const createdAt = cycle.startDate || cycle.createdAt;
    const endDate = cycle.endDate;
    // Construct links
    // If prefix is provided, utilize it. Logic copied from org-cycles-list usage where prefix is passed.
    // If no prefix (e.g. officer dashboard), existing logic used /farmers /cycles
    const detailLink = prefix ? `${prefix}/cycles/${cycle.id}` : `/cycles/${cycle.id}`;
    const farmerLink = prefix ? `${prefix}/farmers/${cycle.farmerId}` : `/farmers/${cycle.farmerId}`;

    return (
        <div
            ref={cardRef}
            onClick={(e) => {
                // If the click originated from a link or button, don't navigate via div
                if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) return;

                // Ignore clicks from Portals (Dropdowns, Modals) which are physically outside the card's DOM
                if (cardRef.current && !cardRef.current.contains(e.target as Node)) return;

                // If the click originated from the actions container
                if ((e.target as HTMLElement).closest('.js-actions-container')) return;

                window.location.href = detailLink;
            }}
            className={cn(
                variant === "elevated"
                    ? "group relative bg-card rounded-none px-2 py-2 sm:px-0 shadow-none active:scale-[0.98] transition-all overflow-hidden"
                    : "p-2 space-y-1 active:bg-muted/50 border-b border-border/50 last:border-0",
                isCurrent && variant === "elevated" && "ring-2 ring-primary border-primary/20 bg-primary/5",
                className
            )}
        >
            <div className={cn("flex justify-between items-start w-full", variant === "elevated" ? "mb-1" : "mb-0")}>
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 align-middle">
                        {showName && (
                            <Link
                                href={farmerLink}
                                className="font-bold text-foreground hover:text-primary hover:underline underline-offset-2 text-[12px] xs:text-sm line-clamp-1"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {cycleName}
                            </Link>
                        )}
                        {isCurrent && variant === "elevated" && (
                            <Badge variant="outline" className="text-[8px] h-3.5 bg-background border-primary text-primary font-bold uppercase tracking-wider px-1">Current</Badge>
                        )}
                        {cycle.status === 'active' && <Badge className="bg-primary/20 text-primary border-none font-bold text-[8px] h-3.5 px-1">ACTIVE</Badge>}
                        {soldValue > 0 && <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-200 font-bold text-[8px] h-3.5 px-1 uppercase tracking-tighter">{soldValue} SOLD</Badge>}
                        {cycle.status === 'deleted' && <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 font-bold text-[8px] h-3.5 px-1 uppercase leading-none">DELETED BY OFFICER</Badge>}
                    </div>
                    {variant === "flat" && (
                        <div className="flex items-center gap-1.5">
                            <span className="text-[9px] text-muted-foreground font-medium">
                                {createdAt ? format(new Date(createdAt), "MMM d") : ""}
                                {endDate ? ` - ${format(new Date(endDate), "MMM d")}` : ""}
                            </span>
                        </div>
                    )}

                </div>

                <div
                    className="pl-2 -mr-2 scale-90 origin-top-right js-actions-container"
                >
                    {cycle.status === "active" ? (
                        <ActionsCell cycle={cycle as unknown as Farmer} prefix={prefix} />
                    ) : (
                        <HistoryActionsCell history={cycle as unknown as FarmerHistory} />
                    )}
                </div>
            </div>

            <div className="grid grid-cols-4 gap-1 py-1 xs:py-1.5 sm:py-2 border-y border-border/50">
                <div className="flex flex-col justify-center">
                    <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-muted-foreground font-bold uppercase tracking-tight leading-tight">Age</span>
                    <p className="text-sm font-bold text-foreground leading-none">{cycle.age} <small className="text-[8px] font-normal">d</small></p>
                </div>

                <div className="flex flex-col justify-center text-center p-1 rounded bg-primary/5 border border-primary/10">
                    <span className="text-[10px] xs:text-[12px] text-primary/70 font-bold uppercase tracking-tight leading-tight">DOC</span>
                    <div className="flex items-center gap-1 justify-center">
                        <Bird className="h-4 w-4 xs:h-5 xs:w-5 text-primary/80" />
                        <p className="text-[12px] xs:text-sm font-bold text-primary leading-none">{docValue.toLocaleString()}</p>
                    </div>
                    <span className="text-[8px] text-muted-foreground mt-0.5 font-medium tracking-tighter">Live: {liveBirdsValue.toLocaleString()}</span>
                </div>

                <div className="flex flex-col justify-center text-center p-1 rounded bg-amber-500/5 dark:bg-amber-900/10 border border-amber-500/10 dark:border-amber-800/20">
                    <span className="text-[8px] xs:text-[9px] sm:text-[10px] text-amber-600/70 dark:text-amber-500/70 font-bold uppercase tracking-tight leading-tight">Feed</span>
                    <div className="flex items-center gap-0.5 justify-center">
                        <Wheat className="h-3 w-3 xs:h-4 xs:w-4 text-amber-500 dark:text-amber-400" />
                        <p className="text-[12px] xs:text-sm font-bold text-amber-600 dark:text-amber-500 leading-none">{intakeValue.toFixed(1)}</p>
                    </div>
                </div>

                <div className="flex flex-col justify-center text-right">
                    <span className="text-[8px] text-muted-foreground font-bold uppercase tracking-tight leading-tight">Deaths</span>
                    <div className="flex items-center gap-0.5 justify-end">
                        {mortalityValue > 0 ? (
                            <p className="text-xs font-bold text-destructive bg-destructive/10 px-1 py-0.5 rounded-full leading-none">{mortalityValue}</p>
                        ) : (
                            <p className="text-xs font-bold text-muted-foreground/30">-</p>
                        )}
                    </div>
                </div>
            </div>


        </div >
    );
};