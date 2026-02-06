
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Package, Search } from "lucide-react";
import { useState } from "react";
import { ReportStockLedgerCard } from "./report-stock-ledger-card";

interface StockReportTabProps {
    orgId: string;
}

export function StockReportTab({ orgId }: StockReportTabProps) {
    const trpc = useTRPC();
    const [search, setSearch] = useState("");

    // Fetch Stock Summary (contains all farmers)
    const { data: summary, isLoading: isSummaryLoading } = useQuery(
        trpc.management.reports.getStockSummary.queryOptions({ orgId })
    );

    if (isSummaryLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading stock data...</div>;
    }

    const filteredFarmers = summary?.farmers.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
    ) || [];

    return (
        <div className="space-y-6">
            {/* Overview Card */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Card className="col-span-1 border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-primary">Total Feed in Stock</CardTitle>
                        <Package className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">{summary?.totalStock.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">bags</span></div>
                        <p className="text-xs text-muted-foreground/80 mt-1">
                            Current active stock across all farmers
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Farmer Stock Ledgers</h3>
                    {/* Search */}
                    <div className="relative max-w-xs w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-muted-foreground/70" />
                        </div>
                        <Input
                            placeholder="Search farmers..."
                            className="pl-9 bg-background/50"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredFarmers.map((farmer) => (
                        <ReportStockLedgerCard
                            key={farmer.id}
                            farmer={{
                                ...farmer,
                                updatedAt: new Date(farmer.updatedAt!)
                            }}
                            orgId={orgId}
                        />
                    ))}
                </div>

                {filteredFarmers.length === 0 && (
                    <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-muted/50">
                        <div className="mx-auto h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                            <Search className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No farmers found</h3>
                        <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                            {search ? `No farmers match "${search}".` : "No active farmers with stock data."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
