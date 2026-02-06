
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, DollarSign, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface FarmerSalesStats {
    farmerId: string;
    name: string;
    totalRevenue: number;
    birdsSold: number;
    lastSaleDate: Date | null;
}

interface ReportSalesLedgerCardProps {
    stats: FarmerSalesStats;
    orgId: string;
}

export function ReportSalesLedgerCard({ stats, orgId }: ReportSalesLedgerCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const trpc = useTRPC();

    // Lazy load history using management router
    const { data: ledgerData, isLoading } = useQuery(trpc.management.reports.getSalesLedger.queryOptions(
        {
            orgId,
            farmerId: stats.farmerId,
            pageSize: 50
        },
        { enabled: isExpanded }
    ));

    const history = ledgerData?.items || [];

    return (
        <Card className={`group overflow-hidden transition-all duration-300 hover:shadow-lg border-muted/60 bg-gradient-to-br from-card to-muted/20 ${isExpanded ? 'ring-2 ring-emerald-500/10 shadow-md' : ''}`}>
            <div
                className="p-5 cursor-pointer relative"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center transition-colors duration-300 ${isExpanded ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' : 'bg-emerald-500/10 text-emerald-600'}`}>
                            <DollarSign className="h-6 w-6" />
                        </div>
                        <div>
                            <Link
                                href={`/management/farmers/${stats.farmerId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="hover:underline"
                            >
                                <h3 className="font-bold text-lg tracking-tight group-hover:text-emerald-700 transition-colors duration-300">
                                    {stats.name}
                                </h3>
                            </Link>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground font-medium mt-0.5">
                                <span className="flex items-center gap-1">
                                    <ShoppingCart className="h-3 w-3" />
                                    {stats.birdsSold.toLocaleString()} birds
                                </span>
                                {stats.lastSaleDate && (
                                    <>
                                        <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                                        <span>Last sale: {format(new Date(stats.lastSaleDate), "MMM dd")}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                        <div className="flex flex-col items-end">
                            <div className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground tabular-nums">
                                ৳{stats.totalRevenue.toLocaleString()}
                            </div>
                            <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50 px-2 py-0.5 rounded-full">
                                Total Revenue
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full hover:bg-muted/50 transition-colors">
                            {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                        </Button>
                    </div>
                </div>
                {/* Decorative background blob */}
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl group-hover:bg-emerald-500/10 transition-colors duration-500" />
            </div>

            {isExpanded && (
                <CardContent className="p-0 border-t bg-background/50 backdrop-blur-sm">
                    <div className="max-h-[400px] overflow-y-auto premium-scrollbar">
                        {isLoading ? (
                            <div className="p-6 space-y-4">
                                <Skeleton className="h-10 w-full rounded-lg" />
                                <Skeleton className="h-10 w-full rounded-lg" />
                            </div>
                        ) : history && history.length > 0 ? (
                            <div className="divide-y divide-border/50">
                                <div className="bg-muted/30 px-5 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex justify-between sticky top-0 backdrop-blur-md z-10">
                                    <span>Date & Details</span>
                                    <span>Amount</span>
                                </div>
                                {history.map((sale) => (
                                    <Link
                                        key={sale.id}
                                        href={`/management/cycles/${(sale as any).cycleId || (sale as any).historyId}`}
                                        className="p-4 hover:bg-muted/40 transition-colors flex items-center justify-between group/row"
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className="mt-1 h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                                                <ShoppingCart className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-sm text-foreground">
                                                        {format(new Date(sale.date), "dd MMM yyyy")}
                                                    </span>
                                                    {sale.location && (
                                                        <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 border rounded-md">
                                                            {sale.location}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground mt-0.5 font-medium">
                                                    {sale.birds} birds • {sale.weight} kg • ৳{parseFloat(sale.price.toString()).toFixed(2)}/kg
                                                </div>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <div className="font-bold text-sm text-emerald-600">
                                                ৳{parseFloat(sale.amount.toString()).toLocaleString()}
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center">
                                <p className="text-muted-foreground text-sm">No detailed sales history found.</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}
