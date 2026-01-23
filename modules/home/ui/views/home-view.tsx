// "use client";

// import ErrorState from "@/components/error-state";
// import LoadingState from "@/components/loading-state";
// import { Button } from "@/components/ui/button";
// import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// import { useTRPC } from "@/trpc/client";
// import { useSuspenseQuery } from "@tanstack/react-query";
// import Link from "next/link";
// import { Suspense } from "react";
// import { ErrorBoundary } from "react-error-boundary";
// import { FeedConsumptionChart } from "../components/feed-consumption-chart";
// import { HistoricalAnalysis } from "../components/historical-analysis";
// import { KpiCards } from "../components/kpi-cards";
// import { PerformanceInsights } from "../components/performance-insights";
// import { QuickDetails } from "../components/quick-details";
// import { UrgentActions } from "../components/urgent-actions";

// // --- Active Operations Component ---
// // We split this out so Suspense works granularly if needed
// const OperationsContent = () => {
//   const trpc = useTRPC();
  
//   // Fetch Active Cycles
//   const { data } = useSuspenseQuery(
//     trpc.cycles.getMany.queryOptions({ status: "active", page: 1, pageSize: 100 })
//   );

//   const cycles = data.items;

//   // --- Derived Metrics ---
//   const totalBirds = cycles.reduce((acc, f) => acc + ((f.doc) - f.mortality), 0);
//   const totalFeedStock = cycles.reduce((acc, f) => acc + (f.inputFeed - f.intake), 0);
//   const avgMortality = cycles.length 
//     ? (cycles.reduce((acc, f) => acc + f.mortality, 0) / cycles.reduce((acc, f) => acc + (f.doc), 0) * 100).toFixed(2)
//     : "0";

//   // Urgent: Less than 3 bags remaining
//   const lowStockCycles = cycles
//     .filter(f => (f.inputFeed - f.intake) < 3)
//     .sort((a, b) => (a.inputFeed - a.intake) - (b.inputFeed - b.intake));

//   // Insight: Best Efficiency (Lowest Mortality %)
//   const topPerformers = [...cycles]
//     .sort((a, b) => (a.mortality / (a.doc)) - (b.mortality / (b.doc)))
//     .slice(0, 5);

//   // Chart Data: Top 7 Feed Consumers
//   const feedChartData = [...cycles]
//     .sort((a, b) => b.intake - a.intake)
//     .slice(0, 7)
//     .map(f => ({
//       name: f.name,
//       bags: f.intake
//     }));
    

//   return (
//     <div className="space-y-6 pt-2">
//       {/* 1. Top Row KPIs */}
//       <KpiCards 
//         totalBirds={totalBirds}
//         totalFeedStock={totalFeedStock}
//         lowStockCycles={lowStockCycles}
//         avgMortality={avgMortality}
//       />

//       {/* 2. Urgent Actions & Performance */}
//       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
//         <UrgentActions lowStockCycles={lowStockCycles} />
//         <PerformanceInsights topPerformers={topPerformers} />
//       </div>

//       {/* 3. Charts & Details */}
//       <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
//         <FeedConsumptionChart feedChartData={feedChartData}/>
//         <QuickDetails cycles={cycles} />
//       </div>
//     </div>
//   );
// };

// // --- Main Page Component ---
// export const HomeView = () => {
//   return (
//     <div className="flex-1 p-4 md:p-8 space-y-6 overflow-y-auto bg-slate-50/50 min-h-screen">
      
//       {/* Page Header */}
//       <div className="flex items-center justify-between">
//         <div>
//             <h2 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
//             <p className="text-muted-foreground mt-1">Overview of your poultry operations</p>
//         </div>
//         <div className="flex items-center space-x-2">
//           <Button asChild>
//              <Link href="/cycles">Manage Cycles</Link>
//           </Button>
//         </div>
//       </div>

//       {/* Tabs System */}
//       <Tabs defaultValue="operations" className="space-y-4">
//         <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
//           <TabsTrigger value="operations">Operations (Active)</TabsTrigger>
//           <TabsTrigger value="analytics">Analytics (History)</TabsTrigger>
//         </TabsList>
        
//         {/* Tab 1: Operations */}
//         <TabsContent value="operations" className="space-y-4">
//             <ErrorBoundary fallback={<ErrorState title="Error" description="Failed to load operations data" />}>
//                 <Suspense fallback={<LoadingState title="Loading Operations" description="Gathering active metrics..." />}>
//                     <OperationsContent />
//                 </Suspense>
//             </ErrorBoundary>
//         </TabsContent>
        
//         {/* Tab 2: Analytics */}
//         <TabsContent value="analytics" className="space-y-4">
//             <ErrorBoundary fallback={<ErrorState title="Error" description="Failed to load historical analysis" />}>
//                 <Suspense fallback={<LoadingState title="Loading History" description="Analyzing past cycles..." />}>
//                     <HistoricalAnalysis />
//                 </Suspense>
//             </ErrorBoundary>
//         </TabsContent>
//       </Tabs>

//     </div>
//   );
// };


const HomeView = () => {
  return (
    <div>
      <p>Hello</p>
    </div>
  )
}

export default HomeView