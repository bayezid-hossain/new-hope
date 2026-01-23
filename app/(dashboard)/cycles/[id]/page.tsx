"use client";
import ErrorState from "@/components/error-state";
import LoadingState from "@/components/loading-state";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cycle, CycleHistory } from "@/modules/cycles/types";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { historyColumns } from "@/modules/cycles/ui/components/history/history-columns";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
    Activity,
    AlertTriangle,
    Archive, ArrowLeft,
    Calculator,
    History,
    Lightbulb,
    Scale,
    TrendingUp,
    Wheat
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { LogsTimeline } from "./component/logs-timeline";

// --- Types ---
interface Log {
  id: string;
  type: "FEED" | "MORTALITY" | "NOTE";
  valueChange: number;
  previousValue: number;
  newValue: number;
  createdAt: string | Date;
  note?:string;
}

// --- Helper for Logs Tab ---

const AnalysisContent = ({ cycle, history }: { cycle: Cycle, history: CycleHistory[] }) => {
  // --- 1. Calculations ---
  const currentMortalityRate = (cycle.mortality / (cycle.doc)) * 100;
  
  // Calculate Historical Averages
  const historicalAvgMortality = history.length > 0
    ? history.reduce((acc, h) => acc + (h.mortality / (h.doc) * 100), 0) / history.length
    : 0;

  // Feed Calculations
  const remainingFeed = (cycle.inputFeed || 0) - (cycle.intake || 0);
  const avgDailyIntake = cycle.age > 0 ? (cycle.intake / cycle.age) : 0;
  const daysUntilEmpty = avgDailyIntake > 0 ? (remainingFeed / avgDailyIntake) : 0;
  
  // Feed per Bird (Efficiency Proxy)
  const liveBirds = (cycle.doc) - cycle.mortality;
  const currentFeedPerBird = liveBirds > 0 ? (cycle.intake / liveBirds) : 0; // Bags per bird

  const historicalAvgFeedPerBird = history.length > 0
    ? history.reduce((acc, h) => {
        const hLive = (h.doc) - h.mortality;
        return acc + (hLive > 0 ? h.finalIntake / hLive : 0);
      }, 0) / history.length
    : 0;

  // --- 2. Logic-Based Suggestions ---
  const suggestions = [];

  // Mortality Logic
  if (currentMortalityRate > 5) {
    suggestions.push({
      type: "critical",
      title: "High Mortality Alert",
      text: `Current mortality (${currentMortalityRate.toFixed(1)}%) is above the 5% warning threshold. Isolate sick birds immediately.`
    });
  } else if (history.length > 0 && currentMortalityRate > historicalAvgMortality * 1.2) {
    suggestions.push({
      type: "warning",
      title: "Performance Dip",
      text: `Mortality is 20% higher than your historical average (${historicalAvgMortality.toFixed(1)}%). Review ventilation or litter quality.`
    });
  }

  // Feed Logic
  if (remainingFeed < 3) {
    suggestions.push({
      type: "urgent",
      title: "Feed Stock Critical",
      text: `You have less than 3 bags left. At current rates, you will run out in ${daysUntilEmpty.toFixed(1)} days.`
    });
  } else if (daysUntilEmpty < 4) {
    suggestions.push({
      type: "info",
      title: "Restock Soon",
      text: `Feed stock covers the next ${daysUntilEmpty.toFixed(0)} days. Plan your next purchase.`
    });
  }

  return (
    <div className="space-y-6">
      
      {/* 1. FORECASTING CARD */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-slate-50 border-slate-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calculator className="h-4 w-4 text-blue-600" /> Feed Runout Predictor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-end mb-2">
              <div>
                <div className="text-2xl font-bold text-slate-900">
                    {daysUntilEmpty === Infinity ? "N/A" : `${daysUntilEmpty.toFixed(1)} Days`}
                </div>
                <p className="text-xs text-muted-foreground">until stock reaches 0</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{avgDailyIntake.toFixed(2)} bags</div>
                <p className="text-xs text-muted-foreground">Daily Consumption</p>
              </div>
            </div>
            {remainingFeed > 0 && avgDailyIntake > 0 && (
                <Progress value={Math.max(0, 100 - (daysUntilEmpty * 10))} className="h-2" />
            )}
            <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
              Based on average daily intake of current cycle.
            </p>
          </CardContent>
        </Card>

        {/* 2. BENCHMARKING CARD */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4 text-purple-600" /> Historical Benchmark
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mortality Compare */}
            <div className="space-y-1">
                <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Mortality vs Average</span>
                    <span className={currentMortalityRate < historicalAvgMortality ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                        {currentMortalityRate < historicalAvgMortality ? "Better" : "Worse"} than usual
                    </span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div className="bg-slate-300" style={{ width: '50%' }} /> {/* Center line marker */}
                    {/* Visualizing deviation could be complex, keeping it simple text for now */}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>Current: {currentMortalityRate.toFixed(1)}%</span>
                    <span>Avg: {historicalAvgMortality.toFixed(1)}%</span>
                </div>
            </div>

            {/* Feed Efficiency Compare */}
            {historicalAvgFeedPerBird > 0 && (
                 <div className="space-y-1 pt-2">
                    <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Feed/Bird (Accumulated)</span>
                        <span>{currentFeedPerBird.toFixed(3)} bags</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>Hist Avg (End of Cycle): {historicalAvgFeedPerBird.toFixed(3)}</span>
                    </div>
                </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 3. SUGGESTIONS LIST */}
      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                Smart Suggestions
            </CardTitle>
            <CardDescription>Automated insights based on your data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            {suggestions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                    Everything looks good! No critical alerts at this time.
                </div>
            ) : (
                suggestions.map((s, i) => (
                    <Alert key={i} variant={s.type === 'critical' ? 'destructive' : 'default'} className={s.type === 'info' ? 'bg-blue-50 border-blue-200' : s.type === 'warning' ? 'bg-amber-50 border-amber-200' : ''}>
                        {s.type === 'critical' || s.type === 'urgent' ? <AlertTriangle className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                        <AlertTitle className={s.type === 'warning' ? 'text-amber-800' : s.type === 'info' ? 'text-blue-800' : ''}>
                            {s.title}
                        </AlertTitle>
                        <AlertDescription className={s.type === 'warning' ? 'text-amber-700' : s.type === 'info' ? 'text-blue-700' : ''}>
                            {s.text}
                        </AlertDescription>
                    </Alert>
                ))
            )}
        </CardContent>
      </Card>
    </div>
  );
};
const CycleDetailsContent = ({ id }: { id: string }) => {
  const trpc = useTRPC();
  // Changed query option to use 'id' not 'name' as per your previous setup, ensure this matches your router input
  const { data } = useSuspenseQuery(trpc.cycles.getDetails.queryOptions({ id: id }));

  const { cycle, logs, history } = data;
  
  // Safe Calculations
  const docCount = cycle.doc || 0;
  const liveBirds = Math.max(0, docCount - cycle.mortality);
  const survivalRate = docCount > 0 
    ? ((liveBirds / docCount) * 100).toFixed(2) 
    : "0.00";
    
  const remainingFeed = (cycle.inputFeed || 0) - (cycle.intake || 0);
  const feedProgress = cycle.inputFeed > 0 
    ? Math.min(100, (remainingFeed / cycle.inputFeed) * 100) 
    : 0;

  const isActive = cycle.status === "active";

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 bg-white">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
            <Link href={isActive?"/cycles":"/history"}><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
            <h1 className="text-2xl font-bold tracking-tight">{cycle.name}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {/* DYNAMIC BADGE */}
                {isActive ? (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 gap-1">
                        <Activity className="h-3 w-3" /> Active Cycle
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 gap-1">
                        <Archive className="h-3 w-3" /> Archived Cycle
                    </Badge>
                )}
                <span>•</span>
                <span>Started {new Date(cycle.createdAt).toLocaleDateString()}</span>
                {!isActive && (
                    <>
                        <span>•</span>
                        <span>Ended {new Date(cycle.updatedAt).toLocaleDateString()}</span>
                    </>
                )}
            </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-7">
        
        {/* LEFT SIDE: Stats & Overview */}
        <div className="col-span-7 md:col-span-2 space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Cycle Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Cycle Age</span>
                        <span className="font-bold text-xl">{cycle.age} Days</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Live Birds</span>
                        <div className="text-right">
                            <div className="font-bold">{liveBirds.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">DOC: {cycle.doc}</div>
                        </div>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Survival Rate</span>
                        <span className={`font-bold ${parseFloat(survivalRate) > 95 ? "text-emerald-600" : "text-orange-500"}`}>
                            {survivalRate}%
                        </span>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-slate-50 border-slate-200">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Wheat className="h-4 w-4" /> Feed Inventory
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold mb-1">{remainingFeed.toFixed(2)} Bags</div>
                    <div className="text-xs text-muted-foreground flex justify-between">
                        <span>Intake: {cycle.intake?.toFixed(2) || 0}</span>
                        <span>Total: {cycle.inputFeed}</span>
                    </div>
                    {/* Feed Progress Bar */}
                    <div className="mt-3 h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                        <div 
                            className={`h-full ${!isActive ? 'bg-slate-400' : remainingFeed < 5 ? 'bg-red-500' : 'bg-amber-500'}`}
                            style={{ width: `${feedProgress}%` }} 
                        />
                    </div>
                </CardContent>
            </Card>
        </div>

        {/* RIGHT SIDE: Tabs System */}
        <div className="col-span-7 md:col-span-5">
            <Tabs defaultValue="logs" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="logs">Activity Logs</TabsTrigger>
                    <TabsTrigger value="history">Other Cycles</TabsTrigger>
                    <TabsTrigger value="analysis">Analysis (Pro)</TabsTrigger>
                </TabsList>
                
                {/* 1. LOGS TAB */}
                <TabsContent value="logs" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <History className="h-4 w-4" /> Audit Trail
                            </CardTitle>
                            <CardDescription>
                                {isActive 
                                    ? "Live record of feed inputs and mortality reports."
                                    : "Archived record of inputs for this closed cycle."}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <LogsTimeline logs={logs as Log[]} />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 2. HISTORY TAB */}
                <TabsContent value="history" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Previous Production Cycles</CardTitle>
                            <CardDescription>Historical performance for {cycle.name}</CardDescription>
                        </CardHeader>
                        <CardContent>
                             {history.length > 0 ? (
                                <DataTable 
                                    columns={historyColumns} 
                                    data={history} 
                                    deleteButton={false}
                                />
                             ) : (
                                 <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                                    <History className="h-8 w-8 mb-2 opacity-20" />
                                    <p>No past cycles found for this cycle.</p>
                                 </div>
                             )}
                        </CardContent>
                    </Card>
                </TabsContent>
                {/* 3. ANALYSIS TAB */}
                <TabsContent value="analysis" className="mt-4">
            {/* Check if active, otherwise historical analysis might be static */}
            <AnalysisContent cycle={cycle} history={history} />
        </TabsContent>
            </Tabs>
        </div>
      </div>
    </div>
  );
};

export default function CycleDetailsPage() {
  const params = useParams();
  // Using ID, not Name, as the primary key
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  return (
    <ErrorBoundary fallback={<ErrorState title="Error" description="Failed to load cycle details" />}>
      <Suspense fallback={<LoadingState title="Loading" description="Fetching cycle logs..." />}>
        <CycleDetailsContent id={id??""} />
      </Suspense>
    </ErrorBoundary>
  );
}