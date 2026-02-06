"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Activity, FileText, Filter, Search, Settings, ShoppingCart, Skull, Wheat, Wrench, X } from "lucide-react";
import { useMemo, useState } from "react";
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
    const [filter, setFilter] = useState<"ALL" | "FEED" | "MORTALITY" | "SYSTEM">("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [dateQuery, setDateQuery] = useState("");

    // Filter Logic
    const filteredLogs = useMemo(() => {
        if (!logs) return [];

        return logs.filter((log) => {
            const normalizedType = log.type.toUpperCase();
            // 1. Category Filter
            if (filter === "MORTALITY" && normalizedType !== "MORTALITY") return false;
            if (filter === "FEED" && !["FEED", "STOCK_IN", "TRANSFER_IN", "CONSUMPTION", "STOCK_OUT", "TRANSFER_OUT"].includes(normalizedType)) return false;
            if (filter === "SYSTEM" && !["NOTE", "CORRECTION", "SYSTEM", "SALES"].includes(normalizedType)) return false;

            // 2. Text Search (Case insensitive on Note or Type)
            if (searchQuery) {
                const lowerQuery = searchQuery.toLowerCase();
                const noteMatch = log.note?.toLowerCase().includes(lowerQuery);
                const typeMatch = log.type.toLowerCase().includes(lowerQuery);
                const dateMatch = `${new Date(log.createdAt).toLocaleDateString()} • ${new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    .toLowerCase().includes(lowerQuery);
                if (!noteMatch && !typeMatch && !dateMatch) return false;
            }

            // 3. Date Filter (Matches specific YYYY-MM-DD)
            if (dateQuery) {
                const logDate = new Date(log.createdAt).toISOString().split('T')[0];
                if (logDate !== dateQuery) return false;
            }

            return true;
        });
    }, [logs, filter, searchQuery, dateQuery]);

    const clearAllFilters = () => {
        setFilter("ALL");
        setSearchQuery("");
        setDateQuery("");
    };

    const hasActiveFilters = filter !== "ALL" || searchQuery || dateQuery;

    if (!logs || logs.length === 0) {
        return <div className="text-muted-foreground text-sm py-8 text-center border border-dashed rounded-lg bg-muted/30 border-border/50">No activity recorded yet.</div>;
    }

    return (
        <div className="space-y-4">

            {/* CONTROLS HEADER */}
            <div className="flex flex-col gap-3 pb-4 border-b border-border/50">

                {/* Row 1: Search and Date Inputs */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search logs..."
                            className="pl-9 h-9 text-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="relative w-[150px] md:w-[180px]">
                        <Input
                            type="date"
                            className="h-9 text-sm"
                            value={dateQuery}
                            onChange={(e) => setDateQuery(e.target.value)}
                        />
                    </div>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-red-600"
                            onClick={clearAllFilters}
                            title="Clear filters"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Row 2: Category Pills */}
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <Filter className="h-3 w-3 text-muted-foreground mr-1 shrink-0" />
                    <Button
                        variant={filter === "ALL" ? "default" : "outline"}
                        size="sm"
                        className="h-7 text-xs rounded-full px-3"
                        onClick={() => setFilter("ALL")}
                    >
                        All
                    </Button>
                    <Button
                        variant={filter === "MORTALITY" ? "default" : "outline"}
                        size="sm"
                        className={`h-7 text-xs rounded-full px-3 ${filter === "MORTALITY" ? "bg-red-600 dark:bg-red-700 hover:bg-red-700 dark:hover:bg-red-800" : "text-red-700 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"}`}
                        onClick={() => setFilter("MORTALITY")}
                    >
                        Mortality
                    </Button>
                    <Button
                        variant={filter === "FEED" ? "default" : "outline"}
                        size="sm"
                        className={`h-7 text-xs rounded-full px-3 ${filter === "FEED" ? "bg-amber-600 dark:bg-amber-700 font-bold" : "text-amber-700 bg-amber-50/50 border-amber-100"}`}
                        onClick={() => setFilter("FEED")}
                    >
                        Feed
                    </Button>
                    <Button
                        variant={filter === "SYSTEM" ? "default" : "outline"}
                        size="sm"
                        className={`h-7 text-xs rounded-full px-3 ${filter === "SYSTEM" ? "bg-muted-foreground dark:bg-muted hover:bg-muted-foreground/90 dark:hover:bg-muted/80" : "text-muted-foreground border-border hover:bg-muted/50"}`}
                        onClick={() => setFilter("SYSTEM")}
                    >
                        System
                    </Button>
                </div>
            </div>

            {/* SCROLLABLE LIST */}
            <div className={cn("overflow-y-auto pr-3 pl-1 scrollbar-thin h-auto", height)}>
                {filteredLogs.length > 0 ? (
                    <div className="pt-2">
                        {filteredLogs.map((log, index) => (
                            <LogItem
                                key={log.id}
                                log={log}
                                isLast={index === filteredLogs.length - 1}
                                isActive={isActive}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground border border-dashed rounded-lg bg-muted/20">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-20" />
                        <p className="text-sm font-medium">No results found.</p>
                        <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
                        <Button variant="link" size="sm" onClick={clearAllFilters} className="mt-2">
                            Clear all filters
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
