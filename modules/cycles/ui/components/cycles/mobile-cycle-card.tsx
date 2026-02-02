"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Farmer, FarmerHistory } from "@/modules/cycles/types";
import { format } from "date-fns";
import {
    Bird,
    Skull,
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
    className?: string;
}

export const MobileCycleCard = ({ cycle, prefix, currentId, variant = "elevated", className }: MobileCycleCardProps) => {

    const cardRef = useRef<HTMLDivElement>(null);
    const isCurrent = cycle.id === currentId;
    // Map properties safely
    const cycleName = cycle.name || cycle.cycleName || cycle.farmerName;
    const intakeValue = parseFloat(cycle.intake || cycle.finalIntake || "0");
    const docValue = parseInt(cycle.doc || "0");
    const mortalityValue = cycle.mortality || 0;
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
                "transition-transform cursor-pointer active:scale-[0.98]",
                variant === "elevated"
                    ? "bg-white p-2 rounded-lg border border-slate-200 shadow-sm"
                    : "p-2 space-y-1 active:bg-slate-50 border-b border-slate-100 last:border-0",
                isCurrent && variant === "elevated" && "ring-2 ring-primary border-primary/20 bg-primary/5",
                className
            )}
        >
            <div className={cn("flex justify-between items-start w-full", variant === "elevated" ? "mb-1" : "mb-0")}>
                <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 align-middle">
                        {variant === "flat" ? (
                            <div className="flex items-center gap-1.5">
                                <Badge className="bg-violet-50 text-violet-700 border-violet-100 font-bold text-[10px] px-1.5 h-4 leading-none flex items-center">
                                    {cycle.age} {cycle.age > 1 ? "days" : "day"}
                                </Badge>
                                <span className="text-[10px] text-slate-400 font-medium">
                                    {createdAt ? format(new Date(createdAt), "MMM d") : ""}
                                    {endDate ? ` - ${format(new Date(endDate), "MMM d")}` : ""}
                                </span>
                            </div>
                        ) : (
                            <>
                                <Link
                                    href={farmerLink}
                                    className="font-bold text-slate-900 hover:text-primary hover:underline underline-offset-2 text-sm line-clamp-1"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {cycleName}
                                </Link>
                                {isCurrent && (
                                    <Badge variant="outline" className="text-[8px] h-3.5 bg-white border-primary text-primary font-bold uppercase tracking-wider px-1">Current</Badge>
                                )}
                                {!isCurrent && cycle.status === 'active' && <Badge className="bg-violet-100 text-violet-700 border-none font-bold text-[8px] h-3.5 px-1">ACTIVE</Badge>}
                                {cycle.status === 'deleted' && <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-100 font-bold text-[8px] h-3.5 px-1 uppercase leading-none">DELETED BY OFFICER</Badge>}
                            </>
                        )}
                    </div>
                    {(cycle.officerName && variant === "elevated") && (
                        <span className="block text-[9px] text-slate-400 font-normal leading-none">
                            Officer: {cycle.officerName}
                        </span>
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

            <div className={cn("grid grid-cols-4 gap-1", variant === "elevated" ? "py-1 border-y border-slate-50" : "py-0.5")}>
                {variant === "elevated" ? (
                    <div className="flex flex-col justify-center">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight leading-tight">Age</span>
                        <p className="text-sm font-bold text-slate-900 leading-none">{cycle.age} <small className="text-[8px] font-normal">d</small></p>
                    </div>
                ) : (
                    <div className="flex flex-col justify-center p-1 rounded bg-blue-50 border border-blue-100 gap-y-1">
                        <span className="text-[12px] text-blue-600/70 font-bold uppercase tracking-tight leading-tight">DOC</span>
                        <div className="flex items-center gap-1">
                            <Bird className="h-5 w-5 text-blue-500" />
                            <p className="text-sm font-bold text-blue-700 leading-none">{docValue.toLocaleString()}</p>
                        </div>
                    </div>
                )}

                {variant === "elevated" ? (
                    <div className="flex flex-col justify-center text-center p-1 rounded bg-blue-50 border border-blue-100">
                        <span className="text-[12px] text-blue-600/70 font-bold uppercase tracking-tight leading-tight">DOC</span>
                        <div className="flex items-center gap-1 justify-center">
                            <Bird className="h-5 w-5 text-blue-500" />
                            <p className="text-sm font-bold text-blue-700 leading-none">{docValue.toLocaleString()}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col justify-center text-center p-1 rounded bg-amber-50 border border-amber-100">
                        <span className="text-[12px] text-amber-600/70 font-bold uppercase tracking-tight leading-tight">Feed</span>
                        <div className="flex items-center gap-1 justify-center">
                            <Wheat className="h-5 w-5 text-amber-500" />
                            <p className="text-sm font-bold text-amber-700 leading-none">{intakeValue.toFixed(2)}</p>
                        </div>
                    </div>
                )}

                {variant === "elevated" ? (
                    <div className="flex flex-col justify-center text-center p-1 rounded bg-amber-50 border border-amber-100">
                        <span className="text-[8px] text-amber-600/70 font-bold uppercase tracking-tight leading-tight">Feed</span>
                        <div className="flex items-center gap-0.5 justify-center">
                            <Wheat className="h-3 w-3 text-amber-500" />
                            <p className="text-sm font-bold text-amber-700 leading-none">{intakeValue.toFixed(2)}</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col justify-center text-right col-span-2">
                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tight leading-tight">Mortality</span>
                        <div className="flex items-center gap-0.5 justify-end">
                            {mortalityValue > 0 ? (
                                <div className="flex items-center gap-1 text-red-600 font-bold bg-red-50 px-1 py-0.5 rounded leading-none">
                                    <Skull className="h-3 w-3" />
                                    <span className="text-xs">{mortalityValue}</span>
                                </div>
                            ) : (
                                <span className="text-xs font-bold text-slate-300">-</span>
                            )}
                        </div>
                    </div>
                )}

                {variant === "elevated" && (
                    <div className="flex flex-col justify-center text-right">
                        <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tight leading-tight">Deaths</span>
                        <div className="flex items-center gap-0.5 justify-end">
                            {mortalityValue > 0 ? (
                                <p className="text-xs font-bold text-red-600 bg-red-50 px-1 py-0.5 rounded-full leading-none">{mortalityValue}</p>
                            ) : (
                                <p className="text-xs font-bold text-slate-300">-</p>
                            )}
                        </div>
                    </div>
                )}
            </div>


        </div>
    );
};