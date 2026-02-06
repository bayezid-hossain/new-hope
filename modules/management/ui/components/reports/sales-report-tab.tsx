
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, DollarSign, Scale, Search, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { ReportSalesLedgerCard } from "./report-sales-ledger-card";

interface SalesReportTabProps {
    orgId: string;
}

export function SalesReportTab({ orgId }: SalesReportTabProps) {
    const trpc = useTRPC();
    // TODO: Add date range picker state
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
    const [search, setSearch] = useState("");

    const { data, isLoading } = useQuery(
        trpc.management.reports.getSalesSummary.queryOptions({
            orgId,
            startDate: dateRange.from,
            endDate: dateRange.to
        })
    );

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading sales data...</div>;
    }

    if (!data) {
        return <div className="p-8 text-center text-muted-foreground">No data available</div>;
    }

    const { metrics, farmerStats } = data;

    // Filter farmers
    const filteredFarmers = farmerStats?.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
    ) || [];

    return (
        <div className="space-y-8">
            {/* Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/10 shadow-sm hover:shadow-md transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Revenue</CardTitle>
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">৳{metrics.totalRevenue.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Across all farmers
                        </p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Birds Sold</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalBirdsSold.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Total birds
                        </p>
                    </CardContent>
                </Card>
                <Card className="hover:shadow-md transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Weight</CardTitle>
                        <Scale className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.totalWeight.toLocaleString()} kg</div>
                        <p className="text-xs text-muted-foreground">
                            Avg price: ৳{metrics.avgPricePerKg.toFixed(2)}/kg
                        </p>
                    </CardContent>
                </Card>
                <Card className="border-red-500/20 bg-red-50/50 dark:bg-red-950/10 hover:shadow-md transition-all">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-red-700 dark:text-red-400">Mortality</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-900 dark:text-red-100">{metrics.totalMortality.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Recorded at sale
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-xl font-bold tracking-tight text-foreground/90">Farmer Performance</h3>
                    {/* Search */}
                    <div className="relative max-w-xs w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-muted-foreground/70" />
                        </div>
                        <Input
                            placeholder="Search farmers..."
                            className="pl-9 bg-background/50 backdrop-blur-sm focus-visible:ring-emerald-500/20 transition-all rounded-xl"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {filteredFarmers.map((stats) => (
                        <ReportSalesLedgerCard
                            key={stats.farmerId}
                            stats={{
                                ...stats,
                                lastSaleDate: stats.lastSaleDate ? new Date(stats.lastSaleDate) : null
                            }}
                            orgId={orgId}
                        />
                    ))}

                    {filteredFarmers.length === 0 && (
                        <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-muted/50">
                            <div className="mx-auto h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                                <Search className="h-8 w-8 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-lg font-medium text-foreground">No farmers found</h3>
                            <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                                {search ? `No farmers match "${search}".` : "No sales data available."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
