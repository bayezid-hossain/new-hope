"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogsTimeline } from "@/modules/cycles/ui/components/cycles/logs-timeline";
import { MobileCycleCard } from "@/modules/cycles/ui/components/cycles/mobile-cycle-card";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Activity,
    AlertTriangle,
    Archive,
    Bird,
    Calculator,
    ChevronLeft,
    History,
    Lightbulb,
    Loader2,
    Scale,
    TrendingUp
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { getAdminHistoryColumns } from "./admin-columns";

// --- Sub-components replicating standard detail page logic ---

const AnalysisContent = ({
    cycle,
    history
}: {
    cycle: any,
    history: any[]
}) => {
    const doc = cycle.doc || 0;
    const mortality = cycle.mortality || 0;
    const currentMortalityRate = doc > 0 ? (mortality / doc) * 100 : 0;

    const historicalAvgMortality = history.length > 0
        ? history.reduce((acc: number, h: any) => {
            const hDoc = h.doc || 0;
            const hMort = h.mortality || 0;
            return acc + (hDoc > 0 ? (hMort / hDoc * 100) : 0);
        }, 0) / history.length
        : 0;

    const intake = cycle.intake || 0;
    const age = cycle.age || 0;
    const avgDailyIntake = age > 0 ? (intake / age) : 0;

    const liveBirds = Math.max(0, doc - mortality);
    const currentFeedPerBird = liveBirds > 0 ? (intake / liveBirds) : 0;

    const historicalAvgFeedPerBird = history.length > 0
        ? history.reduce((acc: number, h: any) => {
            const hLive = (h.doc || 0) - (h.mortality || 0);
            const hIntake = h.finalIntake || h.intake || 0;
            return acc + (hLive > 0 ? hIntake / hLive : 0);
        }, 0) / history.length
        : 0;

    const suggestions = [];
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

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
                <Card className="bg-slate-50 border-slate-200 shadow-sm py-2">
                    <CardHeader className="pb-2 px-6">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-blue-600" /> Intake Insights
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-6 pb-4">
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <div className="text-2xl font-bold text-slate-900">
                                    {avgDailyIntake.toFixed(2)} bags
                                </div>
                                <p className="text-xs text-muted-foreground uppercase tracking-tight font-medium">Daily Avg Consumption</p>
                            </div>
                            <div className="text-right">
                                <div className="text-sm font-medium">{currentFeedPerBird.toFixed(3)}</div>
                                <p className="text-xs text-muted-foreground uppercase tracking-tight font-medium">Bags per Bird</p>
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-3 pt-3 border-t italic">
                            Efficiency calculated on {liveBirds} live birds.
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-sm py-2">
                    <CardHeader className="pb-2 px-6">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Scale className="h-4 w-4 text-purple-600" /> Historical Benchmark
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 px-6 pb-4">
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground uppercase tracking-tight text-[10px] font-medium">Mortality Status</span>
                                <span className={currentMortalityRate <= historicalAvgMortality ? "text-emerald-600 font-bold" : "text-red-500 font-bold"}>
                                    {currentMortalityRate <= historicalAvgMortality ? "Better" : "Worse"} than usual
                                </span>
                            </div>
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Current: {currentMortalityRate.toFixed(1)}%</span>
                                <span>Avg: {historicalAvgMortality.toFixed(1)}%</span>
                            </div>
                        </div>

                        {historicalAvgFeedPerBird > 0 && (
                            <div className="space-y-1 pt-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground uppercase tracking-tight text-[10px] font-medium">Avg Consumed</span>
                                    <span className="font-medium text-[11px]">{historicalAvgFeedPerBird.toFixed(3)} bags/bird</span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold text-slate-400 uppercase tracking-widest">Production Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                            <span className="text-slate-500 text-sm">Start Date</span>
                            <span className="font-bold text-slate-900">{format(new Date(cycle.createdAt), "dd MMM, yyyy")}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                            <span className="text-slate-500 text-sm">Initial Stock (DOC)</span>
                            <span className="font-bold text-slate-900">{cycle.doc} Birds</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-slate-50">
                            <span className="text-slate-500 text-sm">Survival Rate</span>
                            <span className={`font-bold ${currentMortalityRate < 5 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {(100 - currentMortalityRate).toFixed(2)}%
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="shadow-sm py-2 overflow-hidden border-none bg-white">
                <CardHeader className="px-6">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Lightbulb className="h-5 w-5 text-amber-500" />
                        Smart Suggestions
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-6">
                    {suggestions.length === 0 ? (
                        <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-slate-50/50">
                            Everything looks good! No critical alerts at this time.
                        </div>
                    ) : (suggestions.map((s, i) => (
                        <Alert key={i} variant={s.type === 'critical' ? 'destructive' : 'default'} className={s.type === 'warning' ? 'bg-amber-50 border-amber-200' : ''}>
                            {s.type === 'critical' ? <AlertTriangle className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                            <AlertTitle className="text-sm font-bold">
                                {s.title}
                            </AlertTitle>
                            <AlertDescription className="text-xs mt-1">
                                {s.text}
                            </AlertDescription>
                        </Alert>
                    )))}
                </CardContent>
            </Card>
        </div>
    );
};

const OtherCyclesTabContent = ({ history, isAdmin, isManagement, currentId }: { history: any[], isAdmin?: boolean, isManagement?: boolean, currentId?: string }) => {
    const prefix = isAdmin ? "/admin" : (isManagement ? "/management" : "");
    return (
        <Card className="border-none shadow-sm bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50 pb-4">
                <CardTitle className="text-lg font-bold text-slate-900">Other Farmer Cycles</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="p-4">
                    {history && history.length > 0 ? (
                        <>
                            <div className="hidden md:block">
                                <DataTable
                                    columns={getAdminHistoryColumns({ prefix, currentId })}
                                    data={history}
                                />
                            </div>
                            <div className="md:hidden space-y-3">
                                {history.map((h) => (
                                    <MobileCycleCard key={h.id} cycle={h} prefix={prefix} currentId={currentId} />
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <History className="h-10 w-10 mb-3 opacity-20" />
                            <p className="font-medium">No other cycles found.</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

interface CycleDetailsProps {
    cycleId: string;
    isAdmin?: boolean;
    isManagement?: boolean;
}

export const CycleDetails = ({ cycleId, isAdmin, isManagement }: CycleDetailsProps) => {
    const trpc = useTRPC();
    const router = useRouter();

    const { data: response, isLoading } = useQuery(
        trpc.cycles.getDetails.queryOptions({ id: cycleId })
    );

    const normalizedCycle = useMemo(() => {
        if (!response || !response.data) return null;
        const { data: cycle, type, farmerContext } = response;
        return {
            name: type === 'active' ? (cycle as any).name : (cycle as any).cycleName,
            doc: (cycle as any).doc,
            mortality: (cycle as any).mortality,
            age: (cycle as any).age,
            intake: type === 'active' ? (cycle as any).intake : (cycle as any).finalIntake,
            createdAt: type === 'active' ? (cycle as any).createdAt : (cycle as any).startDate,
            farmerName: farmerContext.name,
            status: type === 'active' ? 'active' : 'archived'
        };
    }, [response]);

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!response || !response.data || !normalizedCycle) {
        return <div className="p-8 text-center text-slate-500">Cycle not found.</div>;
    }

    const { logs, history = [] } = response;
    const mortalityRate = normalizedCycle.doc > 0 ? (normalizedCycle.mortality / normalizedCycle.doc) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shadow-sm bg-white">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold tracking-tight text-slate-900"> <Link
                            href={isAdmin ? `/admin/farmers/${response?.data?.farmerId}` : (isManagement ? `/management/farmers/${response?.data?.farmerId}` : `/farmers/${response?.data?.farmerId}`)}
                            className="text-slate-900 font-bold hover:underline hover:text-primary transition-colors underline decoration-slate-200"
                        >{normalizedCycle.farmerName}</Link></h1>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] font-bold uppercase">
                                {isAdmin ? "Admin View" : "Management View"}
                            </Badge>
                            {normalizedCycle.status === 'active' ? (
                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold text-[10px] uppercase tracking-wider">
                                    <Activity className="h-3 w-3 mr-1" /> Active
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none font-bold text-[10px] uppercase tracking-wider">
                                    <Archive className="h-3 w-3 mr-1" /> Archived
                                </Badge>
                            )}

                        </div>
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Age</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-slate-900">{normalizedCycle.age}</span>
                            <span className="text-slate-400 text-xs font-medium">days</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Chicks (DOC)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-slate-900">{normalizedCycle.doc.toLocaleString()}</span>
                            <Bird className="h-4 w-4 text-slate-300" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mortality</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-bold ${normalizedCycle.mortality > 0 ? "text-rose-600" : "text-slate-900"}`}>
                                {normalizedCycle.mortality}
                            </span>
                            <span className="text-xs text-rose-500 font-bold">({mortalityRate.toFixed(1)}%)</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Intake</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-emerald-600">{normalizedCycle.intake.toFixed(1)}</span>
                            <span className="text-slate-400 text-xs font-medium">bags consumed</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="timeline" className="space-y-6">
                <TabsList className="bg-white border shadow-sm p-1 rounded-xl h-auto inline-flex overflow-x-auto max-w-full">
                    <TabsTrigger value="timeline" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold whitespace-nowrap">
                        <History className="h-4 w-4" /> Timeline
                    </TabsTrigger>
                    <TabsTrigger value="others" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold whitespace-nowrap">
                        <Archive className="h-4 w-4" /> Other Cycles
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-primary/5 data-[state=active]:text-primary font-bold whitespace-nowrap">
                        <TrendingUp className="h-4 w-4" /> Analytics
                    </TabsTrigger>

                </TabsList>

                <TabsContent value="timeline" className="mt-0 focus-visible:outline-none">
                    <Card className="border-none shadow-sm bg-white overflow-hidden">
                        <CardHeader className="border-b border-slate-50 pb-4">
                            <CardTitle className="text-lg font-bold text-slate-900">Activity Logs</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="p-6">
                                <LogsTimeline logs={logs as any[]} height="500px" />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="analytics" className="mt-0 focus-visible:outline-none">
                    <AnalysisContent
                        cycle={normalizedCycle}
                        history={history.filter((h: any) => h.id !== cycleId)}
                    />
                </TabsContent>

                <TabsContent value="others" className="mt-0 focus-visible:outline-none">
                    <OtherCyclesTabContent
                        history={history}
                        isAdmin={isAdmin}
                        isManagement={isManagement}
                        currentId={cycleId}
                    />
                </TabsContent>
            </Tabs>
        </div>
    );
};
