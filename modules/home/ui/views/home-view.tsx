
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
import { Activity } from "lucide-react";
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
const OperationsContent = ({ orgId, officerId, canEdit }: { orgId: string; officerId: string; canEdit: boolean }) => {
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
        <UrgentActions lowStockCycles={lowStockCycles} canEdit={canEdit} />
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
  const { orgId, isLoading, canEdit } = useCurrentOrg();

  if (isLoading) {
    return <LoadingState title="Loading Organization" description="Please wait..." />
  }

  if (!orgId) {
    return <ErrorState title="Organization Not Found" description="Could not load dashboard context." />
  }

  return (
    <div className="flex-1 space-y-6 overflow-y-auto bg-background min-h-screen pb-10">
      {/* Premium Sticky Header */}
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm">
        <div className="max-w-7xl mx-auto p-4 md:p-8 py-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
                <Activity className="h-5 w-5 md:h-6 md:w-6" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-foreground uppercase mb-0.5">
                  Dashboard
                </h1>
                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Poultry Operations Intelligence</p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button asChild variant="secondary" className="flex-1 sm:flex-initial h-10 px-4 text-xs font-bold rounded-xl bg-muted/50 hover:bg-muted text-foreground border-none transition-all">
                <Link href="/cycles">Active Cycles</Link>
              </Button>
              <Button asChild variant="secondary" className="flex-1 sm:flex-initial h-10 px-4 text-xs font-bold rounded-xl bg-muted/50 hover:bg-muted text-foreground border-none transition-all">
                <Link href="/farmers">Farmer Directory</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-8 space-y-8">

        {/* Tabs System */}
        <Tabs defaultValue="operations" className="space-y-6">
          <TabsList className="inline-flex h-11 items-center justify-center rounded-xl bg-muted/50 p-1 text-muted-foreground border border-border/50 backdrop-blur-sm">
            <TabsTrigger value="operations" className="rounded-lg px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Operations</TabsTrigger>
            <TabsTrigger value="analytics" className="rounded-lg px-6 py-2 text-xs font-bold uppercase tracking-widest transition-all data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Analytics</TabsTrigger>
          </TabsList>

          {/* Tab 1: Operations */}
          <TabsContent value="operations" className="space-y-4">
            <ErrorBoundary fallback={<ErrorState title="Error" description="Failed to load operations data" />}>
              <Suspense fallback={<LoadingState title="Loading Operations" description="Gathering active metrics..." />}>
                {userId ? <OperationsContent orgId={orgId} officerId={userId} canEdit={canEdit} /> : <ErrorState title="User Error" description="User ID missing" />}
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
    </div>
  );
};

export default HomeView;
