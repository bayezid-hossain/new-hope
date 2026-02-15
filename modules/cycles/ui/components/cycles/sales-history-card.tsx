"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    TooltipProvider,
} from "@/components/ui/tooltip";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import { calculateTotalBags, formatFeedBreakdown } from "@/modules/shared/lib/format";
import type { SaleEvent, SaleReport } from "@/modules/shared/types/sale";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    CheckCircle2,
    CircleDashed,
    Loader2,
    Lock,
    ShoppingCart,
    Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

// Re-export shared types for backward compatibility
export type { SaleEvent, SaleReport } from "@/modules/shared/types/sale";

// Sub-components
import { DesktopSalesTable } from "./desktop-sales-table";
import { SaleEventCard } from "./sale-event-card";

// ---------------------------------------------------------------------------
// Report text generator (exported for sub-components)
// ---------------------------------------------------------------------------
export const generateReportText = (sale: SaleEvent, report: SaleReport | null, isLatest: boolean): string => {
    const birdsSold = report ? report.birdsSold : sale.birdsSold;
    const totalWeight = report ? report.totalWeight : sale.totalWeight;
    const displayAvgWeight = report ? report.avgWeight : sale.avgWeight;

    const cumulativeWeight = sale.cycleContext?.totalWeight || 0;
    const cumulativeBirdsSold = sale.cycleContext?.cumulativeBirdsSold || 0;

    const avgWeight = (isLatest && cumulativeWeight > 0 && cumulativeBirdsSold > 0)
        ? (cumulativeWeight / cumulativeBirdsSold).toFixed(2)
        : displayAvgWeight;
    const pricePerKg = report ? report.pricePerKg : sale.pricePerKg;
    const totalAmount = report ? report.totalAmount : sale.totalAmount;

    const cashReceived = report ? (report.cashReceived ?? sale.cashReceived) : sale.cashReceived;
    const depositReceived = report ? (report.depositReceived ?? sale.depositReceived) : sale.depositReceived;
    const medicineCost = report ? (report.medicineCost ?? sale.medicineCost) : sale.medicineCost;

    const totalMortality = (report && report.totalMortality !== undefined && report.totalMortality !== null) ? report.totalMortality : sale.totalMortality;

    const feedConsumed = report?.feedConsumed ? JSON.parse(report.feedConsumed) : sale.feedConsumed;
    const feedStock = report?.feedStock ? JSON.parse(report.feedStock) : sale.feedStock;
    const feedTotal = calculateTotalBags(feedConsumed);
    const feedBreakdown = formatFeedBreakdown(feedConsumed);
    const stockBreakdown = formatFeedBreakdown(feedStock);

    const fcr = sale.cycleContext?.fcr || 0;
    const epi = sale.cycleContext?.epi || 0;
    const isEnded = sale.cycleContext?.isEnded || false;
    return `Date: ${format(new Date(sale.saleDate), "dd/MM/yyyy")}

Farmer: ${sale.farmerName || "N/A"}
Location: ${sale.location}
House bird : ${sale.houseBirds}pcs
Total Sold : ${birdsSold}pcs
Total Mortality: ${totalMortality} pcs
${(!isEnded || !isLatest) ? `\nRemaining Birds: ${sale.cycleContext?.doc! - totalMortality - birdsSold} pcs` : ""}

Weight: ${totalWeight} kg
Avg. Weight: ${avgWeight} kg
${isEnded && isLatest ? `
FCR: ${fcr}
EPI: ${epi}
` : ""}
Price : ${pricePerKg} tk
Total taka : ${parseFloat(totalAmount).toLocaleString()} tk
Deposit: ${depositReceived ? `${parseFloat(depositReceived).toLocaleString()} tk` : ""}
Cash: ${parseFloat(cashReceived || "0").toLocaleString()} tk

Feed: ${feedTotal} bags
${feedBreakdown}

Stock:
${stockBreakdown}

Medicine: ${medicineCost ? parseFloat(medicineCost).toLocaleString() : 0} tk
${!isEnded || !isLatest ? "\n--- Sale not complete ---" : ""}`;
};

// ---------------------------------------------------------------------------
// Main SalesHistoryCard
// ---------------------------------------------------------------------------

interface SalesHistoryCardProps {
    cycleId?: string | null;
    historyId?: string | null;
    farmerId?: string | null;
    isMobile?: boolean;
    recent?: boolean;
    limit?: number;
    search?: string;
    showLoadMore?: boolean;
    onLoadMore?: () => void;
}

export const SalesHistoryCard = ({
    cycleId,
    historyId,
    farmerId,
    isMobile,
    recent = false,
    limit = 20,
    search = "",
    showLoadMore = false,
    onLoadMore,
    hideFarmerName = false,
}: SalesHistoryCardProps & { hideFarmerName?: boolean }) => {
    const trpc = useTRPC();
    const { isPro } = useCurrentOrg();

    // Track selected report version for each sale event
    const [selectedReports, setSelectedReports] = useState<Record<string, string | null>>({});
    const [isVersionChanging, setIsVersionChanging] = useState(false);

    // Use getRecentSales for global feed, or getSaleEvents for specific context
    const recentQuery = useQuery(
        trpc.officer.sales.getRecentSales.queryOptions(
            { limit, search },
            { enabled: isPro && recent }
        )
    );

    const eventsQuery = useQuery(
        trpc.officer.sales.getSaleEvents.queryOptions(
            {
                cycleId: cycleId || undefined,
                historyId: historyId || undefined,
                farmerId: farmerId || undefined
            },
            { enabled: isPro && !recent }
        )
    );

    const salesEventsData = recent ? recentQuery.data : eventsQuery.data;
    const isLoading = recent ? recentQuery.isLoading : eventsQuery.isLoading;
    const isFetching = recent ? recentQuery.isFetching : eventsQuery.isFetching;

    // Initialize selectedReports when data changes - only if not already set or for new sales
    useEffect(() => {
        if (salesEventsData) {
            setSelectedReports(prev => {
                const next = { ...prev };
                let changed = false;
                (salesEventsData as any[]).forEach(sale => {
                    // Update if backend's selectedReportId changed, or if not yet initialized
                    const backendSelectedId = sale.selectedReportId || (sale.reports?.[0]?.id ?? null);
                    if (next[sale.id] !== backendSelectedId) {
                        next[sale.id] = backendSelectedId;
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }
    }, [salesEventsData]);

    const setActiveVersionMutation = useMutation(
        trpc.officer.sales.setActiveVersion.mutationOptions({})
    );

    const handleVersionChange = async (saleId: string, reportId: string | null) => {
        if (!reportId) return;

        setSelectedReports(prev => ({ ...prev, [saleId]: reportId }));
        setIsVersionChanging(true);

        try {
            await setActiveVersionMutation.mutateAsync({
                saleEventId: saleId,
                saleReportId: reportId
            });
            // Await refetch so backend recalculates all metrics (EPI, FCR, profit)
            if (recent) {
                await recentQuery.refetch();
            } else {
                await eventsQuery.refetch();
            }
        } finally {
            setIsVersionChanging(false);
        }
    };

    // cycleContext is now fully computed by the backend — no frontend calculations needed

    const groupedSales = useMemo(() => {
        const rawEvents = (salesEventsData || []) as any[];
        if (rawEvents.length === 0) return [];

        const events: SaleEvent[] = rawEvents.map(e => ({
            ...e,
            saleDate: new Date(e.saleDate),
            createdAt: new Date(e.createdAt),
            reports: (e.reports || []).map((r: any) => ({
                ...r,
                createdAt: new Date(r.createdAt)
            }))
        }));

        if (!farmerId) return null;

        const groups: Record<string, {
            name: string;
            sales: SaleEvent[];
            isEnded: boolean;
            doc: number;
            mortality: number;
            age: number;
            totalSold: number;
        }> = {};

        events.forEach(sale => {
            const key = sale.cycleId || sale.historyId || "unknown";

            if (!groups[key]) {
                const context = sale.cycleContext;
                groups[key] = {
                    name: sale.cycleName || "Unknown Cycle",
                    sales: [],
                    isEnded: !!sale.historyId,
                    doc: context?.doc || 0,
                    mortality: context?.mortality || 0,
                    age: context?.age || 0,
                    totalSold: 0,
                };
            }
            groups[key].sales.push(sale);
        });

        return Object.entries(groups)
            .map(([key, group]) => ({
                id: key,
                ...group
            }))
            .sort((a, b) => {
                const dateA = new Date(a.sales[0]?.saleDate || 0).getTime();
                const dateB = new Date(b.sales[0]?.saleDate || 0).getTime();
                return dateB - dateA;
            });
    }, [salesEventsData, farmerId]);

    const salesEvents = recent ? (recentQuery.data as SaleEvent[]) : (eventsQuery.data as SaleEvent[]);

    // cycleContext comes from backend response directly — no frontend aggregation needed

    if (!isPro) {
        return (
            <div className={isMobile ? "space-y-3" : "space-y-4"}>
                {!isMobile && (
                    <CardHeader className="px-0 pt-0 pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                            <ShoppingCart className="h-5 w-5 text-muted-foreground" /> Sales History
                        </CardTitle>
                    </CardHeader>
                )}
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 rounded-lg border border-indigo-100 dark:border-indigo-900/50">
                    <div className="p-3 bg-white dark:bg-indigo-950 rounded-full shadow-sm mb-4">
                        <Lock className="h-6 w-6 text-indigo-500" />
                    </div>
                    <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">Sales Tracking is a Pro Feature</h3>
                    <p className="text-sm text-indigo-700 dark:text-indigo-300 max-w-xs mb-6">
                        Upgrade to Pro to record sales, track revenue, and generate detailed financial reports.
                    </p>
                    <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md">
                        <Sparkles className="h-4 w-4 mr-2" />
                        Upgrade to Pro
                    </Button>
                </div>
            </div>
        );
    }

    if (isLoading && !salesEventsData) {
        return (
            <div className="space-y-4">
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        );
    }

    if (!salesEvents || salesEvents.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border/50">
                <ShoppingCart className="h-10 w-10 mb-3 opacity-20" />
                <p className="font-medium">No sales recorded yet.</p>
                <p className="text-xs">Sales will appear here after you record them.</p>
            </div>
        );
    }

    const renderSalesFeed = (events: SaleEvent[]) => {
        return (
            <div className={cn("relative space-y-6 transition-opacity duration-200", (isFetching || isVersionChanging) && "opacity-50 pointer-events-none")}>
                {isVersionChanging && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
                        <div className="flex flex-col items-center gap-2 p-4 bg-background rounded-xl border shadow-lg">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            <span className="text-sm font-medium text-muted-foreground">Recalculating metrics...</span>
                        </div>
                    </div>
                )}
                {isFetching && !isVersionChanging && (
                    <div className="absolute inset-x-0 -top-2 h-0.5 bg-primary/20 animate-pulse overflow-hidden">
                        <div className="h-full bg-primary animate-[shimmer_1.5s_infinite]" style={{ width: '40%' }}></div>
                    </div>
                )}
                <div className="md:hidden space-y-4">
                    {events.map((sale, index) => {
                        const cycleKey = sale.cycleId || sale.historyId || "unknown";
                        const firstOccurrenceIdx = events.findIndex(s => (s.cycleId || s.historyId || "unknown") === cycleKey);
                        const isLatestInCycle = index === firstOccurrenceIdx;

                        return (
                            <div key={sale.id} className="relative p-0 border-b pb-4 last:border-0">
                                <SaleEventCard
                                    sale={{
                                        ...sale,
                                        saleDate: new Date(sale.saleDate),
                                        createdAt: new Date(sale.createdAt),
                                        reports: (sale.reports || []).map((r: any) => ({
                                            ...r,
                                            createdAt: new Date(r.createdAt)
                                        }))
                                    }}
                                    isLatest={isLatestInCycle}
                                    indexInGroup={index}
                                    totalInGroup={events.length}
                                    selectedReportId={selectedReports[sale.id] || null}
                                    onReportSelect={(reportId) => handleVersionChange(sale.id, reportId)}
                                    hideName={hideFarmerName}
                                />
                            </div>
                        );
                    })}
                </div>

                <div className="hidden md:block bg-background rounded-xl border shadow-sm overflow-hidden">
                    <DesktopSalesTable
                        sales={events.map((sale, index) => {
                            const cycleKey = sale.cycleId || sale.historyId || "unknown";
                            const firstOccurrenceIdx = events.findIndex(s => (s.cycleId || s.historyId || "unknown") === cycleKey);
                            const isLatestInCycle = index === firstOccurrenceIdx;

                            return {
                                ...sale,
                                isLatestInCycle
                            };
                        })}
                        selectedReports={selectedReports}
                        onReportSelect={handleVersionChange}
                        hideFarmerName={hideFarmerName}
                    />
                </div>

                {showLoadMore && onLoadMore && events.length >= limit && !search && (
                    <div className="flex justify-center pt-4 pb-8">
                        <Button variant="outline" onClick={onLoadMore}>
                            Load More
                        </Button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <TooltipProvider>
            <div className={isMobile ? "space-y-3" : "space-y-4"}>
                {!isMobile && !recent && (
                    <CardHeader className="px-0 pt-0 pb-4">
                        <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                            <ShoppingCart className="h-5 w-5 text-muted-foreground" /> Sales History
                        </CardTitle>
                        <CardDescription className="text-muted-foreground">
                            {farmerId
                                ? "All recorded sales for this farmer across all cycles."
                                : "All recorded sales for this cycle. You can create adjusted versions for reports."}
                        </CardDescription>
                    </CardHeader>
                )}

                <div className="space-y-4 pr-1">
                    {farmerId && groupedSales && Array.isArray(groupedSales) ? (
                        <Accordion type="multiple" defaultValue={groupedSales.length > 0 ? [groupedSales[0].id] : []} className={cn("space-y-4 transition-opacity", isFetching && "opacity-60")}>
                            {groupedSales.map((group) => {
                                const groupSales = group.sales;
                                const firstSaleContext = groupSales[0]?.cycleContext;

                                return (
                                    <AccordionItem value={group.id} key={group.id} className="border-b last:border-0 px-0">
                                        <AccordionTrigger className="hover:no-underline py-3 px-0">
                                            <div className="grid grid-cols-12 items-center gap-x-1 sm:gap-x-2 w-full pr-6 text-[10px] xs:text-[11px] text-foreground/80 font-medium overflow-hidden">
                                                <div className="col-span-1">
                                                    <div className="shrink-0 w-fit">
                                                        {group.isEnded ? (
                                                            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                        ) : (
                                                            <CircleDashed className="h-4 w-4 text-blue-500 animate-[spin_3s_linear_infinite]" />
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="col-span-3 sm:col-span-2 font-bold text-muted-foreground/80 uppercase tracking-tighter truncate">
                                                    {group.sales.length} {group.sales.length > 1 ? "Sales" : "Sale"}
                                                </div>
                                                <div className="col-span-2 sm:col-span-3 flex items-center gap-0.5 sm:gap-1 pl-1">
                                                    <span className="text-muted-foreground/40 text-[8px] uppercase font-bold hidden sm:inline-block">Age:</span>
                                                    <span className="font-bold">{group.age}d</span>
                                                </div>
                                                <div className="col-span-3 flex items-center gap-0.5 sm:gap-1">
                                                    <span className="text-muted-foreground/40 text-[8px] uppercase font-bold hidden sm:inline-block">DOC:</span>
                                                    <span className="font-bold truncate">{group.doc.toLocaleString()}</span>
                                                </div>
                                                <div className="col-span-3 flex items-center justify-end gap-0.5 sm:gap-1">
                                                    <span className="text-muted-foreground/40 text-[8px] uppercase font-bold hidden xs:inline-block">Sold:</span>
                                                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                                        {firstSaleContext?.cumulativeBirdsSold?.toLocaleString() || group.totalSold.toLocaleString()}
                                                    </span>
                                                </div>
                                            </div>
                                        </AccordionTrigger>
                                        <AccordionContent className="pt-2 pb-4 space-y-4 px-0">
                                            {renderSalesFeed(group.sales)}
                                        </AccordionContent>
                                    </AccordionItem>
                                );
                            })}
                        </Accordion>
                    ) : (
                        renderSalesFeed(salesEventsData as SaleEvent[] || [])
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
};
