"use client";

import { ProBlocker } from "@/components/pro-blocker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { SaleEventCard } from "@/modules/cycles/ui/components/cycles/sales-history-card";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Archive, RefreshCw, Search, ShoppingBag } from "lucide-react";
import { useState } from "react";

export default function SalesPage() {
    const { isPro, isLoading: isOrgLoading } = useCurrentOrg();
    const [limit, setLimit] = useState(20);
    const [search, setSearch] = useState("");
    const trpc = useTRPC()
    const { data: sales, isLoading, isError, refetch } = useQuery(trpc.officer.sales.getRecentSales.queryOptions(
        { limit, search },
        { enabled: isPro }
    ));

    if (isOrgLoading) {
        return (
            <div className="p-4 space-y-4 max-w-2xl mx-auto">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!isPro) {
        return <ProBlocker feature="Sales Feed" description="View all your recent sales in one place." />;
    }

    return (
        <div className="flex flex-col min-h-screen bg-muted/5">
            <div className="flex-1 p-3 sm:p-6 space-y-6 max-w-2xl mx-auto w-full">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <ShoppingBag className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">Sales Feed</h1>
                                <p className="text-xs text-muted-foreground">Recent sales activity across your farmers</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => refetch()} title="Refresh">
                            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        </Button>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-muted-foreground/70" />
                        </div>
                        <Input
                            placeholder="Search by farmer or location..."
                            className="pl-9 bg-background/50 backdrop-blur"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {isError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>Failed to load sales data. Please try again.</AlertDescription>
                    </Alert>
                )}

                {isLoading && (
                    <div className="space-y-4">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-64 w-full rounded-xl" />
                        ))}
                    </div>
                )}

                {!isLoading && sales && sales.length === 0 && (
                    <Card className="border-dashed bg-muted/30">
                        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                <Archive className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground">No recent sales found</h3>
                            <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                                {search ? `No sales match "${search}".` : "Sales recorded for your active farmers will appear here."}
                            </p>
                        </CardContent>
                    </Card>
                )}

                <div className="space-y-6">
                    {sales?.map((sale) => (
                        <div key={sale.id} className="relative">

                            {/* @ts-ignore - mismatch in feed type inference usually but structure matches */}
                            <SaleEventCard sale={{
                                ...sale,
                                saleDate: new Date(sale.saleDate),
                                createdAt: new Date(sale.createdAt),
                                reports: sale.reports.map(r => ({
                                    ...r,
                                    createdAt: new Date(r.createdAt)
                                }))
                            }} />
                        </div>
                    ))}
                </div>

                {sales && sales.length >= limit && !search && (
                    <div className="flex justify-center pt-4 pb-8">
                        <Button variant="outline" onClick={() => setLimit(l => l + 20)}>
                            Load More
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
