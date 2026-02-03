"use client";

import ErrorState from "@/components/error-state";
import LoadingState from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { MembersList } from "@/modules/admin/components/members-list";
import { ProductionTree } from "@/modules/admin/components/production-tree";
import { FeedConsumptionChart } from "@/modules/home/ui/components/feed-consumption-chart";
import { HistoricalAnalysis } from "@/modules/home/ui/components/historical-analysis";
import { KpiCards } from "@/modules/home/ui/components/kpi-cards";
import { PerformanceInsights } from "@/modules/home/ui/components/performance-insights";
import { QuickDetails } from "@/modules/home/ui/components/quick-details";
import { UrgentActions } from "@/modules/home/ui/components/urgent-actions";
import { SmartWatchdogWidget } from "@/modules/shared/components/smart-watchdog-widget";
import { SupplyChainWidget } from "@/modules/shared/components/supply-chain-widget";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, Scale, Users, Wheat } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";


// --- Active Operations Component for Management ---
const ManagementOperationsContent = ({ orgId }: { orgId: string }) => {
    const trpc = useTRPC();

    // Fetch ALL Active Cycles in the Org
    const { data, isLoading } = useQuery(
        trpc.management.cycles.listActive.queryOptions({
            orgId,
            page: 1,
            pageSize: 100
        })
    );

    if (isLoading || !data) {
        return <LoadingState title="Loading Operations" description="Gathering active metrics..." />;
    }

    const cycles = data.items;

    // --- Derived Metrics ---
    const totalBirds = cycles.reduce((acc, f) => acc + ((f.doc) - f.mortality), 0);

    // Calculate Total Feed Stock (Sum of UNIQUE Farmers' mainStock)
    const uniqueFarmers = new Map();
    cycles.forEach(c => {
        if (!uniqueFarmers.has(c.farmerId)) {
            uniqueFarmers.set(c.farmerId, c.farmerMainStock || 0);
        }
    });
    const totalMainStock = Array.from(uniqueFarmers.values()).reduce((acc, stock) => acc + stock, 0);

    // Calculate Total Active Consumption
    const totalActiveConsumption = cycles.reduce((acc, c) => acc + c.intake, 0);

    // Effective Available Stock
    const totalAvailableStock = totalMainStock - totalActiveConsumption;

    const avgMortality = cycles.length
        ? (cycles.reduce((acc, f) => acc + f.mortality, 0) / cycles.reduce((acc, f) => acc + (f.doc), 0) * 100).toFixed(2)
        : "0";

    // Urgent: Less than 3 bags remaining (Based on Calculated Available Stock)
    const farmerConsumptionMap = new Map<string, number>();
    cycles.forEach(c => {
        const current = farmerConsumptionMap.get(c.farmerId) || 0;
        farmerConsumptionMap.set(c.farmerId, current + c.intake);
    });

    const lowStockCycles = cycles
        .map(c => {
            const totalConsumption = farmerConsumptionMap.get(c.farmerId) || 0;
            const initialStock = c.farmerMainStock || 0;
            const availableStock = initialStock - totalConsumption;
            return { ...c, availableStock };
        })
        .filter((c, index, self) =>
            // Deduplicate by farmer
            index === self.findIndex((t) => t.farmerId === c.farmerId)
        )
        .filter(c => c.availableStock < 3)
        .sort((a, b) => a.availableStock - b.availableStock);

    // --- Aggregation grouped by Farmer ---
    const farmerStats = new Map<string, {
        farmerId: string;
        farmerName: string;
        totalIntake: number;
        totalDoc: number;
        totalMortality: number;
        activeCyclesCount: number;
    }>();

    cycles.forEach(cycle => {
        const existing = farmerStats.get(cycle.farmerId) || {
            farmerId: cycle.farmerId,
            farmerName: cycle.farmerName,
            totalIntake: 0,
            totalDoc: 0,
            totalMortality: 0,
            activeCyclesCount: 0
        };

        existing.totalIntake += cycle.intake;
        existing.totalDoc += cycle.doc;
        existing.totalMortality += cycle.mortality;
        existing.activeCyclesCount += 1;

        farmerStats.set(cycle.farmerId, existing);
    });

    const aggregatedFarmers = Array.from(farmerStats.values());

    // Insight: Best Efficiency (Lowest Mortality %) - Aggregated
    const topPerformers = [...aggregatedFarmers]
        .sort((a, b) => {
            const rateA = a.totalDoc > 0 ? a.totalMortality / a.totalDoc : 0;
            const rateB = b.totalDoc > 0 ? b.totalMortality / b.totalDoc : 0;
            return rateA - rateB;
        })
        .slice(0, 5)
        .map(f => ({
            ...f,
            avgMortalityRate: f.totalDoc > 0 ? (f.totalMortality / f.totalDoc) * 100 : 0
        }));

    // Chart Data: Top 7 Feed Consumers - Aggregated
    const feedChartData = [...aggregatedFarmers]
        .sort((a, b) => b.totalIntake - a.totalIntake)
        .slice(0, 7)
        .map(f => ({
            name: f.farmerName,
            bags: f.totalIntake
        }));


    return (
        <div className="space-y-6 pt-2">
            {/* 1. Top Row KPIs */}
            <KpiCards
                totalBirds={totalBirds}
                totalFeedStock={totalMainStock}
                activeConsumption={totalActiveConsumption}
                availableStock={totalAvailableStock}
                lowStockCount={lowStockCycles.length}
                avgMortality={avgMortality}
                activeCyclesCount={cycles.length}
            />

            {/* 2. Urgent Actions & Performance */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <UrgentActions lowStockCycles={lowStockCycles} />
                <PerformanceInsights topPerformers={topPerformers} />
            </div>

            {/* 3. Charts & Details */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <FeedConsumptionChart feedChartData={feedChartData} />
                <QuickDetails cycles={cycles} />
            </div>
        </div>
    );
};

function ManagementStats({ orgId }: { orgId: string }) {
    const trpc = useTRPC();
    const { data: stats, isLoading } = useQuery(trpc.management.analytics.getDashboardStats.queryOptions({ orgId }));

    if (isLoading) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 h-32 animate-pulse bg-slate-100 rounded-xl" />;

    const items = [
        { label: "Members", value: stats?.members, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", description: "Organization Total" },
        { label: "Farmers", value: stats?.farmers, icon: Wheat, color: "text-amber-500", bg: "bg-amber-500/10", description: "Total Active Farmers" },
        { label: "Active Cycles", value: stats?.activeCycles, icon: Activity, color: "text-violet-500", bg: "bg-violet-500/10", description: "Production Cycles" },
    ];

    return (
        <div className="space-y-8">
            <div className="grid gap-4 xs:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item, i) => (
                    <Card key={item.label} className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group rounded-[2rem]">
                        <div className={cn(
                            "absolute top-0 left-0 w-1 h-full opacity-20 group-hover:opacity-100 transition-opacity",
                            item.color.replace("text-", "bg-")
                        )} />

                        <CardHeader className="flex flex-row items-center justify-between pb-2 p-5 md:p-6">
                            <span className="text-[10px] md:text-[11px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">{item.label}</span>
                            <div className={cn(
                                "p-2.5 rounded-2xl ring-1 ring-border/50 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm",
                                item.bg
                            )}>
                                <item.icon className={cn("h-4 w-4 md:h-5 md:w-5", item.color)} />
                            </div>
                        </CardHeader>

                        <CardContent className="px-5 md:px-6 pb-5 md:pb-6">
                            <div className="text-3xl md:text-4xl font-black tracking-tighter text-foreground group-hover:translate-x-1 transition-transform">
                                {item.value?.toLocaleString() || 0}
                            </div>
                            <p className="mt-2 text-[10px] md:text-xs text-muted-foreground/50 font-bold uppercase tracking-widest">{item.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                <SmartWatchdogWidget orgId={orgId} />
                <SupplyChainWidget orgId={orgId} viewMode="ADMIN" />
            </div>
        </div>
    );
}

// --- Main Page Component ---
export const ManagementDashboardView = ({ orgId, orgName }: { orgId: string; orgName: string }) => {
    return (
        <div className="flex-1 space-y-6 overflow-y-auto bg-background min-h-screen pb-10">
            {/* Premium Sticky Header */}
            <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm">
                <div className="max-w-7xl mx-auto p-4 md:p-8 py-6">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
                                <Building2 className="h-5 w-5 md:h-6 md:w-6" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground uppercase mb-0.5">
                                    Management
                                </h1>
                                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] opacity-60">
                                    Overseeing {orgName}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Button asChild variant="secondary" className="flex-1 sm:flex-initial h-10 px-4 text-xs font-bold rounded-xl bg-muted/50 hover:bg-muted text-foreground border-none transition-all">
                                <Link href="/management/officers">Officer List</Link>
                            </Button>
                            <Button asChild variant="secondary" className="flex-1 sm:flex-initial h-10 px-4 text-xs font-bold rounded-xl bg-muted/50 hover:bg-muted text-foreground border-none transition-all">
                                <Link href="/management/farmers">Farmer Directory</Link>
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-8">

                {/* Tabs System */}
                <Tabs defaultValue="overview" className="space-y-6">
                    <TabsList className="inline-flex h-11 items-center justify-center rounded-xl bg-muted/50 p-1 text-muted-foreground border border-border/50 backdrop-blur-sm">
                        <TabsTrigger value="overview" className="rounded-lg px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Overview</TabsTrigger>
                        <TabsTrigger value="operations" className="rounded-lg px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Active</TabsTrigger>
                        <TabsTrigger value="analytics" className="rounded-lg px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">History</TabsTrigger>
                    </TabsList>

                    {/* Tab 0: Overview (Old Management Page Content) */}
                    <TabsContent value="overview" className="space-y-8 pt-0 outline-none">
                        <ManagementStats orgId={orgId} />

                        <Tabs defaultValue="members" className="space-y-6">
                            <TabsList className="inline-flex h-11 items-center justify-center rounded-xl bg-muted/50 p-1 text-muted-foreground border border-border/50 backdrop-blur-sm">
                                <TabsTrigger value="members" className="rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                                    <Users className="h-3.5 w-3.5 mr-2" />
                                    Members
                                </TabsTrigger>
                                <TabsTrigger value="production" className="rounded-lg px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                                    <Scale className="h-3.5 w-3.5 mr-2" />
                                    Production Tree
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="members" className="focus-visible:outline-none mt-0">
                                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden p-4 md:p-8">
                                    <MembersList orgId={orgId} />
                                </div>
                            </TabsContent>
                            <TabsContent value="production" className="focus-visible:outline-none mt-0">
                                <div className="rounded-[2rem] border border-border/50 bg-card/50 backdrop-blur-sm shadow-sm overflow-hidden p-6 overflow-x-auto">
                                    <ProductionTree orgId={orgId} isManagement={true} />
                                </div>
                            </TabsContent>
                        </Tabs>
                    </TabsContent>

                    {/* Tab 1: Operations */}
                    <TabsContent value="operations" className="space-y-4">
                        <ErrorBoundary fallback={<ErrorState title="Error" description="Failed to load operations data" />}>
                            <Suspense fallback={<LoadingState title="Loading Operations" description="Gathering active metrics..." />}>
                                <ManagementOperationsContent orgId={orgId} />
                            </Suspense>
                        </ErrorBoundary>
                    </TabsContent>

                    {/* Tab 2: Analytics */}
                    <TabsContent value="analytics" className="space-y-4">
                        <ErrorBoundary fallback={<ErrorState title="Error" description="Failed to load historical analysis" />}>
                            <Suspense fallback={<LoadingState title="Loading History" description="Analyzing past cycles..." />}>
                                <HistoricalAnalysis variant="management" />
                            </Suspense>
                        </ErrorBoundary>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
};

export default ManagementDashboardView;
