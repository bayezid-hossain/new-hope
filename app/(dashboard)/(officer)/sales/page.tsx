"use client";

import { ProBlocker } from "@/components/pro-blocker";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Search, ShoppingBag } from "lucide-react";
import { useState } from "react";

import { SalesHistoryCard } from "@/modules/cycles/ui/components/cycles/sales-history-card";

export default function SalesPage() {
    const { isPro, isLoading: isOrgLoading } = useCurrentOrg();
    const [limit, setLimit] = useState(20);
    const [search, setSearch] = useState("");
    // Data fetching handled by SalesHistoryCard component

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
            <div className="flex-1 p-3 sm:p-6 space-y-6 max-w-5xl mx-auto w-full">
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
                    </div>

                    {/* Search and Filters */}
                    <div className="flex items-center gap-2">
                        <div className="relative flex-1">
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
                </div>


                <div className="space-y-6 p-0">
                    <SalesHistoryCard
                        recent={true}
                        limit={limit}
                        search={search}
                        showLoadMore={true}
                        onLoadMore={() => setLimit(l => l + 20)}
                    />
                </div>
            </div>
        </div>
    );
}
