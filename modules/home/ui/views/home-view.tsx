
"use client";

import ErrorState from "@/components/error-state";
import LoadingState from "@/components/loading-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { SmartWatchdogWidget } from "@/modules/shared/components/smart-watchdog-widget";
import { SupplyChainWidget } from "@/modules/shared/components/supply-chain-widget";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { FeedConsumptionChart } from "../components/feed-consumption-chart";
import { HistoricalAnalysis } from "../components/historical-analysis";
import { KpiCards } from "../components/kpi-cards";
import { PerformanceInsights } from "../components/performance-insights";
import { QuickDetails } from "../components/quick-details";
import { UrgentActions } from "../components/urgent-actions";


// --- Active Operations Component ---
const OperationsContent = ({ orgId, officerId }: { orgId: string; officerId: string }) => {
  const trpc = useTRPC();

  // Fetch Dashboard Stats
  const { data: stats } = useSuspenseQuery(
    trpc.officer.getDashboardStats.queryOptions({ orgId })
  );

  // Fetch Active Cycles (for lists/charts)
  const { data: cyclesData } = useSuspenseQuery(
    trpc.officer.cycles.listActive.queryOptions({
      orgId,
      page: 1,
      pageSize: 100
    })
  );

  const cycles = cyclesData.items;

  // --- DERIVED LISTS (Still using cycles for details) ---

  // Urgent: Less than 3 bags remaining (Deduplicated by Farmer)
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
      {/* Smart Watchdog & Supply Chain (Officer View - Compact) */}
      <div className="grid md:grid-cols-2 gap-4 mb-2">
        <SupplyChainWidget orgId={orgId} officerId={officerId} viewMode="OFFICER" />
        <SmartWatchdogWidget orgId={orgId} officerId={officerId} />
      </div>

      {/* 1. Top Row KPIs */}
      <KpiCards
        totalBirds={stats.totalBirds}
        totalFeedStock={stats.totalFeedStock}
        activeConsumption={stats.activeConsumption}
        availableStock={stats.availableStock}
        lowStockCount={stats.lowStockCount}
        avgMortality={stats.avgMortality}
        activeCyclesCount={stats.activeCyclesCount}
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

// --- Main Page Component ---
export const HomeView = ({ userId }: { userId?: string }) => {
  const { orgId, isLoading } = useCurrentOrg();

  if (isLoading) {
    return <LoadingState title="Loading Organization" description="Please wait..." />
  }

  if (!orgId) {
    return <ErrorState title="Organization Not Found" description="Could not load dashboard context." />
  }

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-slate-50/50 min-h-screen">

      {/* Page Header */}
      <div className="flex items-center justify-between flex-col w-full gap-y-2">
        <div className="w-full">
          <div className="flex items-center justify-between w-full gap-x-4">
            <h2 className="text-xl xs:text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>

            <div className="flex items-center space-x-1.5 xs:space-x-2 gap-x-2">
              <Button asChild variant="outline" className="h-7 px-2 text-[10px] xs:h-9 xs:px-4 xs:text-xs sm:text-sm">
                <Link href="/cycles">Cycles</Link>
              </Button>
              <Button asChild variant="outline" className="h-7 px-2 text-[10px] xs:h-9 xs:px-4 xs:text-xs sm:text-sm">
                <Link href="/farmers">Farmers</Link>
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-xs xs:text-sm mt-1">Overview of your poultry operations</p>
        </div>

      </div>

      {/* Tabs System */}
      <Tabs defaultValue="operations" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px] h-9 xs:h-10">
          <TabsTrigger value="operations" className="text-[10px] xs:text-xs sm:text-sm">Operations</TabsTrigger>
          <TabsTrigger value="analytics" className="text-[10px] xs:text-xs sm:text-sm">Analytics</TabsTrigger>
        </TabsList>

        {/* Tab 1: Operations */}
        <TabsContent value="operations" className="space-y-4">
          <ErrorBoundary fallback={<ErrorState title="Error" description="Failed to load operations data" />}>
            <Suspense fallback={<LoadingState title="Loading Operations" description="Gathering active metrics..." />}>
              {userId ? <OperationsContent orgId={orgId} officerId={userId} /> : <ErrorState title="User Error" description="User ID missing" />}
            </Suspense>
          </ErrorBoundary>
        </TabsContent>

        {/* Tab 2: Analytics */}
        <TabsContent value="analytics" className="space-y-4">
          <ErrorBoundary fallback={<ErrorState title="Error" description="Failed to load historical analysis" />}>
            <Suspense fallback={<LoadingState title="Loading History" description="Analyzing past cycles..." />}>
              <HistoricalAnalysis variant="officer" />
            </Suspense>
          </ErrorBoundary>
        </TabsContent>
      </Tabs>

    </div>
  );
};

export default HomeView;
