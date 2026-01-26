"use client";

import ErrorState from "@/components/error-state";
import LoadingState from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MembersList } from "@/modules/admin/components/members-list";
import { ProductionTree } from "@/modules/admin/components/production-tree";
import { FeedConsumptionChart } from "@/modules/home/ui/components/feed-consumption-chart";
import { HistoricalAnalysis } from "@/modules/home/ui/components/historical-analysis";
import { KpiCards } from "@/modules/home/ui/components/kpi-cards";
import { PerformanceInsights } from "@/modules/home/ui/components/performance-insights";
import { QuickDetails } from "@/modules/home/ui/components/quick-details";
import { UrgentActions } from "@/modules/home/ui/components/urgent-actions";
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
        { label: "Members", value: stats?.members, icon: Users, gradient: "from-blue-500 to-indigo-600", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
        { label: "Farmers", value: stats?.farmers, icon: Wheat, gradient: "from-amber-400 to-orange-500", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
        { label: "Active Cycles", value: stats?.activeCycles, icon: Activity, gradient: "from-violet-500 to-purple-600", iconBg: "bg-violet-100", iconColor: "text-violet-600" },
    ];

    return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
                <Card key={item.label} className="border-none shadow-sm overflow-hidden relative group">
                    <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${item.gradient}`} />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">{item.label}</CardTitle>
                        <div className={`p-2 rounded-lg ${item.iconBg} ${item.iconColor} group-hover:scale-110 transition-transform`}>
                            <item.icon className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight">{item.value?.toLocaleString() || 0}</div>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold tracking-wider">Organization Total</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

// --- Main Page Component ---
export const ManagementDashboardView = ({ orgId, orgName }: { orgId: string; orgName: string }) => {
    return (
        <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-slate-50/50 min-h-screen">

            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                        <Building2 className="h-8 w-8 text-primary" />
                        Management Dashboard
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Oversee {orgName}&apos;s personnel and production.</p>
                </div>
                <div className="flex items-center space-x-2">
                    <Button asChild variant="outline">
                        <Link href="/management/officers">Officers</Link>
                    </Button>
                    <Button asChild>
                        <Link href="/management/farmers">Farmers</Link>
                    </Button>
                </div>
            </div>

            {/* Tabs System */}
            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="grid w-full grid-cols-3 lg:w-[600px]">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="operations">Operations (Active)</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics (History)</TabsTrigger>
                </TabsList>

                {/* Tab 0: Overview (Old Management Page Content) */}
                <TabsContent value="overview" className="space-y-8 pt-2">
                    <ManagementStats orgId={orgId} />

                    <Tabs defaultValue="members" className="space-y-6">
                        <div className="flex items-center justify-between">
                            <TabsList className="bg-white border shadow-sm p-1 rounded-xl h-auto">
                                <TabsTrigger value="members" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold">
                                    <Users className="h-4 w-4" />
                                    Members
                                </TabsTrigger>

                                <TabsTrigger value="production" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold">
                                    <Scale className="h-4 w-4" />
                                    Production Tree
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="members" className="focus-visible:outline-none">
                            <MembersList orgId={orgId} />
                        </TabsContent>
                        <TabsContent value="production" className="focus-visible:outline-none">
                            <ProductionTree orgId={orgId} isManagement={true} />
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
    );
};

export default ManagementDashboardView;
