"use client";

import { ProBlocker } from "@/components/pro-blocker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { StockLedgerCard } from "@/modules/officer/ui/components/stock-ledger-card";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronDown, ClipboardList, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";

export default function StockLedgerPage() {
    const { isPro, isLoading: isOrgLoading } = useCurrentOrg();
    const [search, setSearch] = useState("");
    const trpc = useTRPC()

    const {
        data,
        isLoading,
        isError,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch
    } = useInfiniteQuery(
        trpc.officer.stock.getAllFarmersStock.infiniteQueryOptions(
            { limit: 20 },
        )
    );

    const farmers = useMemo(() => {
        return data?.pages.flatMap((page) => page.items) || [];
    }, [data]);

    if (isOrgLoading) {
        return (
            <div className="p-4 space-y-4 max-w-2xl mx-auto">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    if (!isPro) {
        return <ProBlocker feature="Stock Ledger" description="Access full stock history and realtime balances for all farmers." />;
    }

    const filteredFarmers = farmers.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="flex flex-col min-h-screen bg-muted/5">
            <div className="flex-1 p-3 sm:p-6 space-y-8 max-w-7xl mx-auto w-full">
                {/* Header */}
                <div className="flex flex-col gap-6 mb-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20 text-primary-foreground">
                                <ClipboardList className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                                    Stock Ledger
                                </h1>
                                <p className="text-sm text-muted-foreground font-medium">Real-time inventory tracking</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh" className="h-10 w-10 shrink-0">
                                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                            </Button>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative max-w-md">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-muted-foreground/70" />
                        </div>
                        <Input
                            placeholder="Search farmers..."
                            className="pl-9 bg-background/50 backdrop-blur border-muted-foreground/20 focus-visible:ring-primary/20 rounded-xl h-10 transition-all hover:bg-background"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {isError && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>Failed to load stock data.</AlertDescription>
                    </Alert>
                )}

                {isLoading && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[...Array(6)].map((_, i) => (
                            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
                        ))}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredFarmers.map((farmer) => (
                        <StockLedgerCard key={farmer.id} farmer={{
                            ...farmer,
                            updatedAt: new Date(farmer.updatedAt)
                        }} />
                    ))}
                </div>
                {!isLoading && filteredFarmers.length === 0 && (
                    <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-muted/50 col-span-full">
                        <div className="mx-auto h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                            <Search className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No farmers found</h3>
                        <p className="text-muted-foreground mt-1 max-w-sm mx-auto">
                            {search ? `No farmers match "${search}". Try a different term.` : "You don't have any active farmers with stock data yet."}
                        </p>
                    </div>
                )}

                {hasNextPage && (
                    <div className="flex justify-center pt-6 pb-12">
                        <Button
                            variant="outline"
                            size="lg"
                            className="min-w-[150px] shadow-sm hover:bg-accent/50"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                        >
                            {isFetchingNextPage ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                                    Loading...
                                </>
                            ) : (
                                <>
                                    Load More
                                    <ChevronDown className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
