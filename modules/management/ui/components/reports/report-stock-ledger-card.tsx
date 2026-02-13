
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, ClipboardList, TrendingDown, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface FarmerStockSummary {
    id: string;
    name: string;
    mainStock: number;
    updatedAt: Date;
}

interface ReportStockLedgerCardProps {
    farmer: FarmerStockSummary;
    orgId: string;
}

export function ReportStockLedgerCard({ farmer, orgId }: ReportStockLedgerCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const trpc = useTRPC();

    // Lazy load history using management router
    const { data: historyData, isLoading } = useQuery(trpc.management.reports.getStockLedger.queryOptions(
        {
            orgId,
            farmerId: farmer.id,
            pageSize: 50 // Fetch reasonable history depth
        },
        { enabled: isExpanded }
    ));

    const history = historyData?.items || [];

    return (
        <Card className={`group overflow-hidden transition-all duration-300 hover:shadow-lg border-muted/60 bg-gradient-to-br from-card to-muted/20 ${isExpanded ? 'ring-2 ring-primary/5 shadow-md' : ''}`}>
            <div
                className="p-5 cursor-pointer relative"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors duration-300 ${isExpanded ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' : 'bg-primary/10 text-primary'}`}>
                            <ClipboardList className="h-6 w-6" />
                        </div>
                        <div>
                            <Link
                                href={`/management/farmers/${farmer.id}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:underline"
                            >
                                <h3 className="font-bold text-lg tracking-tight group-hover:text-primary transition-colors duration-300">{farmer.name}</h3>
                            </Link>
                            <p className="text-xs text-muted-foreground flex items-center gap-1.5 font-medium">
                                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500/80 animate-pulse"></span>
                                Updated: {format(new Date(farmer.updatedAt), "dd/MM/yyyy")}
                            </p>
                        </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <div className="text-3xl font-extrabold tracking-tight text-foreground tabular-nums">
                                {farmer.mainStock.toLocaleString()}
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50 px-2 py-0.5 rounded-full">
                                Bags In Stock
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full hover:bg-primary/10 hover:text-primary transition-colors">
                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>
                {/* Decorative background blob */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors duration-500" />
            </div>

            {isExpanded && (
                <CardContent className="p-0 border-t bg-background/50 backdrop-blur-sm">
                    <div className="max-h-[400px] overflow-y-auto premium-scrollbar">
                        {isLoading ? (
                            <div className="p-6 space-y-4">
                                <Skeleton className="h-12 w-full rounded-xl" />
                                <Skeleton className="h-12 w-full rounded-xl" />
                                <Skeleton className="h-12 w-full rounded-xl" />
                            </div>
                        ) : history && history.length > 0 ? (
                            <div className="divide-y divide-border/50">
                                <div className="bg-muted/30 px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between sticky top-0 backdrop-blur-md z-10">
                                    <span>Date & Activity</span>
                                    <span>Change</span>
                                </div>
                                {history.map((log) => {
                                    const amount = parseFloat(log.amount.toString());
                                    const isNegative = amount < 0;
                                    return (
                                        <div key={log.id} className="p-4 hover:bg-muted/40 transition-colors flex items-center justify-between group/row">
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${log.type === "RESTOCK" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" :
                                                    log.type === "TRANSFER_IN" ? "bg-blue-100 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" :
                                                        "bg-orange-100 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400"
                                                    }`}>
                                                    {log.type === "RESTOCK" ? <TrendingUp className="h-4 w-4" /> :
                                                        log.type === "TRANSFER_IN" ? <TrendingUp className="h-4 w-4" /> :
                                                            <TrendingDown className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm text-foreground">
                                                            {log.type.replace("_", " ")}
                                                        </span>
                                                        <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                                                            {format(new Date(log.createdAt!), "HH:mm")}
                                                        </span>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                                                        {format(new Date(log.createdAt!), "dd/MM/yyyy")}
                                                    </div>
                                                    {log.note && (
                                                        <p className="text-xs text-muted-foreground italic mt-1 max-w-[240px] leading-relaxed">
                                                            "{log.note}"
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className={`font-mono font-bold text-base px-3 py-1 rounded-lg ${isNegative
                                                ? "text-red-600 bg-red-50 dark:bg-red-500/5 dark:text-red-400"
                                                : "text-emerald-600 bg-emerald-50 dark:bg-emerald-500/5 dark:text-emerald-400"
                                                }`}>
                                                {amount > 0 ? "+" : ""}{amount}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <div className="h-16 w-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                                <p className="text-muted-foreground font-medium">No history recorded</p>
                                <p className="text-xs text-muted-foreground mt-1">Activities will appear here once recorded.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
