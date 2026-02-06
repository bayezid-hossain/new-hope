"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Activity, FileText, Settings, ShoppingCart, Skull, Wheat, Wrench } from "lucide-react";
import { useState } from "react";
import { RevertMortalityModal } from "./revert-mortality-modal";

// --- Types ---
export interface TimelineLog {
    id: string;
    type: "FEED" | "MORTALITY" | "NOTE" | string;
    valueChange: number;
    previousValue?: number;
    newValue?: number;
    createdAt: string | Date;
    note?: string | null;
    cycleId?: string | null;
}

// --- Log Item Component ---
const LogItem = ({ log, isLast, isActive }: { log: TimelineLog; isLast: boolean; isActive?: boolean }) => {
    const isConsumption = (log.note?.includes("Consumption") || log.type === "CONSUMPTION") && !log.note?.includes("Ended");

    let icon = <FileText className="h-4 w-4" />;
    let colorClass = "bg-muted-foreground";
    let title = "System Log";

    const normalizedType = log.type.toUpperCase();

    if (normalizedType === "FEED" || normalizedType === "STOCK_IN" || normalizedType === "TRANSFER_IN") {
        icon = <Wheat className="h-4 w-4" />;
        colorClass = "bg-amber-500";
        title = normalizedType === "TRANSFER_IN" ? "Transferred In" : "Added Feed";
    } else if (normalizedType === "MORTALITY") {
        icon = <Skull className="h-4 w-4" />;
        colorClass = "bg-red-500";
        title = "Reported Mortality";
    } else if (normalizedType === "CORRECTION") {
        icon = <Wrench className="h-4 w-4" />;
        colorClass = "bg-orange-500";
        title = "Correction";
    } else if (normalizedType === "SYSTEM" || normalizedType === "NOTE") {
        icon = <Settings className="h-4 w-4" />;
        colorClass = "bg-purple-500";
        const note = log.note?.toLowerCase() || "";
        if (note.includes("started")) title = "Cycle Started";
        else if (note.includes("ended")) title = "Cycle Ended";
        else if (note.includes("reopened")) title = "Cycle Reopened";
        else if (note.includes("doc correction")) title = "Initial Stock Correction";
        else title = "System Update";
    } else if (isConsumption || normalizedType === "CONSUMPTION" || normalizedType === "STOCK_OUT" || normalizedType === "TRANSFER_OUT") {
        icon = <Activity className="h-4 w-4" />;
        colorClass = "bg-blue-500";
        title = normalizedType === "TRANSFER_OUT" ? "Transferred Out" : (isConsumption ? "Daily Consumption" : "Stock Deduction");
    } else if (normalizedType === "SALES") {
        icon = <ShoppingCart className="h-4 w-4" />;
        colorClass = "bg-emerald-500";
        title = "Sale Recorded";
    }

    // State for Edit Modal
    const [showEditModal, setShowEditModal] = useState(false);

    return (
        <div className="flex gap-4 group">
            <div className="flex flex-col items-center">
                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white shadow-sm ring-2 ring-background z-10", colorClass)}>
                    {icon}
                </div>
                {!isLast && <div className="w-px h-full bg-border/50 my-1 group-hover:bg-border/80 transition-colors" />}
            </div>

            <div className="pb-8 space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{title}</span>
                    <div className="flex items-center gap-2">
                        {/* Edit Action for Mortality */}
                        {isActive && normalizedType === "MORTALITY" && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-[10px] text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => setShowEditModal(true)}
                            >
                                <Wrench className="h-3 w-3 mr-1" /> Edit
                            </Button>
                        )}
                        <time className="text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleDateString()} • {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </time>
                    </div>
                </div>

                <div className="text-sm">
                    {normalizedType === "NOTE" && !isConsumption ? (
                        <div className="bg-muted/30 p-2 rounded-md border border-border/50 text-muted-foreground italic text-xs">
                            &quot;{log.note}&quot;
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="font-mono font-normal">
                                {(log.valueChange ?? 0) >= 0 ? "+" : ""}{(log.valueChange ?? 0).toFixed(normalizedType === "MORTALITY" || normalizedType === "SALES" ? 0 : 2)} {normalizedType === "MORTALITY" || log.note?.includes("DOC Correction") || normalizedType === "SALES" ? "Birds" : "Bags"}
                            </Badge>
                            {log.note && (
                                <span className="text-muted-foreground text-xs">
                                    {isConsumption && !log.note.includes("Consumption") ? "Auto-calculated" : log.note}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {log.previousValue !== undefined && log.previousValue !== null && log.newValue !== undefined && log.newValue !== null && (
                    <div className="text-[10px] text-muted-foreground font-mono mt-1">
                        {log.previousValue.toFixed(2)} &rarr; {log.newValue.toFixed(2)}
                    </div>
                )}
            </div>

            {/* Revert Action for Mortality */}
            {isActive && normalizedType === "MORTALITY" && (log.valueChange ?? 0) > 0 && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity self-center">
                    <RevertMortalityModal logId={log.id} amount={log.valueChange} note={log.note} />
                </div>
            )}

        </div>
    );
};

// --- Main Component ---
export const LogsTimeline = ({ logs, height, isActive }: { logs: TimelineLog[], height?: string, isActive?: boolean }) => {
    if (!logs || logs.length === 0) {
        return <div className="text-muted-foreground text-sm py-8 text-center border border-dashed rounded-lg bg-muted/30 border-border/50">No activity recorded yet.</div>;
    }

    return (
        <div className="space-y-4">
            {/* SCROLLABLE LIST */}
            <div className={cn("overflow-y-auto pr-3 pl-1 scrollbar-thin h-auto", height)}>
                <div className="pt-2">
                    {logs.map((log, index) => (
                        <LogItem
                            key={log.id}
                            log={log}
                            isLast={index === logs.length - 1}
                            isActive={isActive}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
