"use client";

import ErrorState from "@/components/error-state";
import LoadingState from "@/components/loading-state";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Farmer, FarmerHistory } from "@/modules/cycles/types";
import { LogsTimeline } from "@/modules/cycles/ui/components/cycles/logs-timeline";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { ActionsCell, getHistoryColumns, HistoryActionsCell } from "@/modules/cycles/ui/components/shared/columns-factory";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    AlertTriangle,
    Archive,
    ArrowLeft,
    Calculator,
    History,
    Lightbulb,
    Scale,
    ShoppingCart,
    TrendingUp,
    Wheat,
    Wrench
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

// EndCycle/ReopenCycle modals imported via columns-factory now
// import { EndCycleModal } from "@/modules/cycles/ui/components/cycles/end-cycle-modal";
// import { ReopenCycleModal } from "@/modules/cycles/ui/components/cycles/reopen-cycle-modal";

// ... existing imports

interface NormalizedCycle {
    id: string;
    name: string;
    doc: number;
    birdsSold: number;
    mortality: number;
    age: number;
    intake: number;
    startDate: Date;
    endDate: Date | null;
    status: "active" | "archived";
}

interface ActiveCycle {
    id: string;
    name: string;
    farmerId: string;
    organizationId: string;
    doc: number;
    birdsSold: number;
    mortality: number;
    age: number;
    intake: number;
    createdAt: Date;
    updatedAt: Date;
    status: string;
    farmer: { name: string; mainStock: number };
}

interface HistoryRecord {
    id: string;
    cycleName: string;
    farmerId: string;
    organizationId: string | null;
    doc: number;
    birdsSold: number;
    mortality: number;
    age: number;
    finalIntake: number;
    startDate: Date;
    endDate: Date;
    status: string;
    farmer?: { name: string; mainStock: number };
}

// --- Analysis Content Component ---
const AnalysisContent = ({
    cycle,
    history
}: {
    cycle: NormalizedCycle,
    history: HistoryRecord[]
}) => {
    const doc = cycle.doc || 0;
    const mortality = cycle.mortality || 0;
    const currentMortalityRate = doc > 0 ? (mortality / doc) * 100 : 0;

    // Calculate Historical Averages (safely)
    const historicalAvgMortality = history.length > 0
        ? history.reduce((acc: number, h: HistoryRecord) => {
            const hDoc = h.doc || 0;
            const hMort = h.mortality || 0;
            return acc + (hDoc > 0 ? (hMort / hDoc * 100) : 0);
        }, 0) / history.length
        : 0;

    // Feed Calculations
    const intake = cycle.intake || 0;
    const age = cycle.age || 0;
    const avgDailyIntake = age > 0 ? (intake / age) : 0;

    // Feed per Bird (Efficiency Proxy)
    const liveBirds = Math.max(0, doc - mortality);
    const currentFeedPerBird = liveBirds > 0 ? (intake / liveBirds) : 0; // Bags per bird

    const historicalAvgFeedPerBird = history.length > 0
        ? history.reduce((acc: number, h: HistoryRecord) => {
            const hLive = (h.doc || 0) - (h.mortality || 0);
            const hIntake = h.finalIntake || 0;
            return acc + (hLive > 0 ? hIntake / hLive : 0);
        }, 0) / history.length
        : 0;

    // --- Logic-Based Suggestions ---
    const suggestions = [];

    // Mortality Logic
    if (currentMortalityRate > 5) {
        suggestions.push({
            type: "critical",
            title: "High Mortality Alert",
            text: `Current mortality (${currentMortalityRate.toFixed(2)}%) is above the 5% warning threshold. Isolate sick birds immediately.`
        });
    } else if (history.length > 0 && currentMortalityRate > historicalAvgMortality * 1.2) {
        suggestions.push({
            type: "warning",
            title: "Performance Dip",
            text: `Mortality is 20% higher than your historical average (${historicalAvgMortality.toFixed(2)}%). Review ventilation or litter quality.`
        });
    }

    return (
        <Card className="border-none shadow-sm bg-card overflow-hidden">
            <CardContent className="p-6">
                <div className="space-y-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Card className="bg-muted/30 border-border/50 shadow-sm py-2">
                            <CardHeader className="pb-2 px-4 sm:px-6">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Calculator className="h-4 w-4 text-primary" /> Consumption Insights
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-4 sm:px-6 pb-4">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <div className="text-xl sm:text-2xl font-bold text-foreground">
                                            {avgDailyIntake.toFixed(2)} bags
                                        </div>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-tight font-medium">Daily Avg Consumption</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-foreground">{currentFeedPerBird.toFixed(3)}</div>
                                        <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-tight font-medium">Bags per Bird</p>
                                    </div>
                                </div>
                                <p className="text-[10px] sm:text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50 italic">
                                    Efficiency calculated on {liveBirds} live birds.
                                </p>
                            </CardContent>
                        </Card>

                        {/* BENCHMARKING CARD */}
                        <Card className="bg-card border-border/50 shadow-sm py-2">
                            <CardHeader className="pb-2 px-4 sm:px-6">
                                <CardTitle className="text-sm font-medium flex items-center gap-2">
                                    <Scale className="h-4 w-4 text-primary" /> Historical Benchmark
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 px-4 sm:px-6 pb-4">
                                <div className="space-y-1">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-muted-foreground uppercase tracking-tight text-[10px] font-medium">Mortality Status</span>
                                        <span className={currentMortalityRate <= historicalAvgMortality ? "text-emerald-500 font-bold" : "text-destructive font-bold"}>
                                            {currentMortalityRate <= historicalAvgMortality ? "Better" : "Worse"} than usual
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[10px] text-muted-foreground">
                                        <span>Current: {currentMortalityRate.toFixed(2)}%</span>
                                        <span>Avg: {historicalAvgMortality.toFixed(2)}%</span>
                                    </div>
                                </div>

                                {historicalAvgFeedPerBird > 0 && (
                                    <div className="space-y-1 pt-2">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground uppercase tracking-tight text-[10px] font-medium">Avg Consumed</span>
                                            <span className="font-medium text-[11px] text-foreground transform-gpu">{historicalAvgFeedPerBird.toFixed(3)} bags/bird</span>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* SUGGESTIONS LIST */}
                    <Card className="bg-card border-border/50 shadow-sm py-2 overflow-hidden">
                        <CardHeader className="px-4 sm:px-6">
                            <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-foreground">
                                <Lightbulb className="h-5 w-5 text-amber-500" />
                                Smart Suggestions
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">Automated insights from your data</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 px-4 sm:px-6 pb-6">
                            {suggestions.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-muted/30 border-border/50">
                                    Everything looks good! No critical alerts at this time.
                                </div>
                            ) : (suggestions.map((s, i) => (
                                <Alert key={i} variant={s.type === 'critical' ? 'destructive' : 'default'} className={s.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : ''}>
                                    {s.type === 'critical' ? <AlertTriangle className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                                    <AlertTitle className={s.type === 'warning' ? 'text-amber-800 dark:text-amber-400 text-sm' : 'text-sm'}>
                                        {s.title}
                                    </AlertTitle>
                                    <AlertDescription className={s.type === 'warning' ? 'text-amber-700 dark:text-amber-500 text-xs mt-1' : 'text-xs mt-1'}>
                                        {s.text}
                                    </AlertDescription>
                                </Alert>
                            )))}
                        </CardContent>
                    </Card>
                </div>
            </CardContent>
        </Card>
    );
};

// --- Sub-components for better organization ---

const LogsTabContent = ({ isActive, logs, isMobile }: { isActive: boolean; logs: any[]; isMobile?: boolean }) => (
    <div className={isMobile ? "space-y-0" : "space-y-6"}>
        {!isMobile && (
            <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                    <History className="h-5 w-5 text-muted-foreground" /> Audit Trail
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                    {isActive
                        ? "Real-time records of feed inputs and mortality reports for this cycle."
                        : "Complete historical record of all events recorded during this cycle."}
                </CardDescription>
            </CardHeader>
        )}
        <LogsTimeline
            logs={logs.map((log: any) => ({
                id: log.id,
                type: log.type || "NOTE",
                valueChange: log.valueChange || 0,
                previousValue: log.previousValue,
                newValue: log.newValue,
                createdAt: log.createdAt,
                note: log.note
            }))}
            height={isMobile ? "max-h-[350px]" : "max-h-[300px]"}
            isActive={isActive}
        />
    </div>
);

const OtherCyclesTabContent = ({ history, cycleId, farmerName, isMobile }: { history: any[]; cycleId: string; farmerName: string; isMobile?: boolean }) => (
    <div className={isMobile ? "space-y-0" : "space-y-6"}>
        {!isMobile && (
            <CardHeader className="px-0 pt-0 pb-4">
                <CardTitle className="text-lg text-foreground">Other Farmer Cycles</CardTitle>
                <CardDescription className="text-muted-foreground">View all production records for {farmerName}, excluding the current session.</CardDescription>
            </CardHeader>
        )}
        {history && history.filter((h: any) => h.id !== cycleId).length > 0 ? (
            <DataTable
                columns={getHistoryColumns({ enableActions: true, currentId: cycleId })}
                data={history.filter((h: any) => h.id !== cycleId)}
            />
        ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-border/50">
                <History className="h-10 w-10 mb-3 opacity-20" />
                <p className="font-medium">No other cycles found.</p>
                <p className="text-xs">This farmer has no other recorded production history yet.</p>
            </div>
        )}
    </div>
);

import { SalesHistoryCard } from "@/modules/cycles/ui/components/cycles/sales-history-card";
import { EditFarmerNameModal } from "@/modules/farmers/ui/components/edit-farmer-name-modal";

const CycleDetailsContent = ({ id }: { id: string }) => {
    const trpc = useTRPC();
    const { data, isLoading, error } = useQuery(trpc.officer.cycles.getDetails.queryOptions({ id }));
    const [showEndCycleModal, setShowEndCycleModal] = useState(false);
    const [showReopenModal, setShowReopenModal] = useState(false);
    const [showEditFarmerModal, setShowEditFarmerModal] = useState(false);

    // --- Data Normalization Hook ---
    const normalized = useMemo(() => {
        if (!data) return null;

        const { type, data: rawData } = data;
        const isActive = type === "active";

        const normalizedCycle: NormalizedCycle = {
            id: rawData.id,
            name: (rawData as any).farmer?.name || (isActive ? (rawData as ActiveCycle).name : (rawData as HistoryRecord).cycleName),
            doc: rawData.doc || 0,
            birdsSold: rawData.birdsSold || 0,
            mortality: rawData.mortality || 0,
            age: rawData.age || 0,
            intake: isActive ? ((rawData as ActiveCycle).intake || 0) : ((rawData as HistoryRecord).finalIntake || 0),
            startDate: new Date(isActive ? (rawData as ActiveCycle).createdAt : (rawData as HistoryRecord).startDate),
            endDate: isActive ? null : new Date((rawData as HistoryRecord).endDate),
            status: isActive ? "active" : "archived",
        };

        return {
            cycle: normalizedCycle,
            logs: data.logs || [],
            history: (data.history || []) as unknown as HistoryRecord[],
            farmerContext: data.farmerContext
        };
    }, [data]);

    if (isLoading) return <LoadingState title="Loading" description="Fetching cycle details..." />;
    if (error || !normalized) return <ErrorState title="Error" description={error?.message || "Cycle not found."} />;

    const { cycle, logs, history, farmerContext } = normalized;

    const liveBirds = Math.max(0, cycle.doc - cycle.mortality - cycle.birdsSold);
    const survivalRate = cycle.doc > 0
        ? ((liveBirds / cycle.doc) * 100).toFixed(2)
        : "0.00";

    const isActive = cycle.status === "active";

    return (
        <div className="flex-1 p-3 sm:p-6 lg:p-8 space-y-4 sm:space-y-6 bg-background max-w-7xl mx-auto w-full min-h-screen">
            {/* Header */}
            <div className="flex flex-col gap-4 border-b border-border/50 bg-card p-4 sm:p-0 sm:bg-transparent rounded-xl sm:rounded-none shadow-sm sm:shadow-none mb-2 mt-4 sm:mt-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                    <div className="flex items-center gap-3 pb-2 sm:gap-4">
                        <Button variant="ghost" size="icon" asChild className="rounded-full hover:bg-muted">
                            <Link href="/cycles"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold tracking-tight text-foreground">{cycle.name}</h1>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                {isActive ? (
                                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 gap-1.5 px-2.5">
                                        <Activity className="h-3 w-3" /> Active Cycle
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="bg-muted text-muted-foreground border-border/50 gap-1.5 px-2.5">
                                        <Archive className="h-3 w-3" /> Archived Cycle
                                    </Badge>
                                )}
                                <span>•</span>
                                <div className="flex items-center gap-1">
                                    <span className="font-medium text-foreground">{farmerContext.name}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                        onClick={() => setShowEditFarmerModal(true)}
                                    >
                                        <Wrench className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto ml-auto">
                        <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:gap-1 text-xs sm:text-sm text-muted-foreground sm:text-right">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-end gap-1 sm:gap-2 bg-muted/30 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                                <span className="font-semibold sm:font-medium text-muted-foreground text-[10px] sm:text-sm uppercase sm:normal-case">Started</span>
                                <span className="text-foreground font-medium sm:font-normal">{cycle.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            </div>
                            {!isActive && cycle.endDate && (
                                <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-end gap-1 sm:gap-2 bg-muted/30 sm:bg-transparent p-2 sm:p-0 rounded-lg">
                                    <span className="font-semibold sm:font-medium text-muted-foreground text-[10px] sm:text-sm uppercase sm:normal-case">Ended</span>
                                    <span className="text-foreground font-medium sm:font-normal">{cycle.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                </div>
                            )}
                        </div>

                        {/* Unified Actions Dropdown */}
                        <div className="bg-card border border-border/50 rounded-md shadow-sm h-8 w-8 flex items-center justify-center ml-2">
                            {isActive ? (
                                <ActionsCell
                                    cycle={{
                                        ...cycle,
                                        farmerName: farmerContext.name,
                                        farmerId: farmerContext.id,
                                        organizationId: farmerContext.organizationId,
                                        status: "active",
                                        // Ensure mandatory fields for Farmer type
                                        createdAt: cycle.startDate, // Approximate if not available, or add to NormalizedCycle
                                        updatedAt: new Date(),
                                        officerName: null,
                                        // Ensure all required fields from Farmer type are present or mocked safely
                                        age: cycle.age,
                                        doc: cycle.doc,
                                        birdsSold: cycle.birdsSold,
                                        mortality: cycle.mortality,
                                        intake: cycle.intake
                                    } as unknown as Farmer}
                                />
                            ) : (
                                <HistoryActionsCell
                                    history={{
                                        ...cycle,
                                        cycleName: cycle.name,
                                        birdsSold: cycle.birdsSold,
                                        finalIntake: cycle.intake,
                                        farmerId: farmerContext.id,
                                        organizationId: farmerContext.organizationId,
                                        status: "history",
                                        officerName: null
                                    } as unknown as FarmerHistory}
                                />
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <EditFarmerNameModal
                farmerId={farmerContext.id}
                currentName={farmerContext.name}
                open={showEditFarmerModal}
                onOpenChange={setShowEditFarmerModal}
            />



            <div className="grid gap-6 md:grid-cols-7 w-full overflow-hidden">
                {/* LEFT SIDE: Stats & Overview */}
                <div className="col-span-7 lg:col-span-2 space-y-4 sm:space-y-6 min-w-0">
                    <Card className="shadow-sm overflow-hidden border-border/50 bg-card">
                        <CardHeader className="bg-muted/50 border-b border-border/50 py-2 sm:py-3">
                            <CardTitle className="text-sm sm:text-base text-foreground">Cycle Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3 sm:space-y-4 py-2 sm:py-3">
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">Cycle Age</span>
                                <span className="font-bold text-lg sm:text-xl text-foreground">{cycle.age} {cycle.age > 1 ? "Days" : "Day"}</span>
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">Live Birds</span>
                                <div className="text-right">
                                    <div className="font-bold text-sm sm:text-base text-foreground">{liveBirds.toLocaleString()}</div>
                                    <div className="text-[10px] sm:text-xs text-muted-foreground">Initial DOC: {cycle.doc}</div>
                                </div>
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">Birds Sold</span>
                                <span className="font-medium text-sm sm:text-base text-foreground">{cycle.birdsSold} birds</span>
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">Mortality</span>
                                <span className="font-medium text-sm sm:text-base text-foreground">{cycle.mortality} birds</span>
                            </div>
                            <Separator className="bg-border/50" />
                            <div className="flex justify-between items-center">
                                <span className="text-xs sm:text-sm text-muted-foreground">Survival Rate</span>
                                <span className={`font-bold text-sm sm:text-base ${parseFloat(survivalRate) > 95 ? "text-emerald-500" : "text-amber-500"}`}>
                                    {survivalRate}%
                                </span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-amber-500/10 border-amber-500/20 shadow-sm gap-2">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-xs sm:text-sm font-semibold flex items-center gap-2 text-amber-500 pt-2 pb-0">
                                <Wheat className="h-4 w-4" /> Consumption
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="py-2">
                            <div className="text-2xl sm:text-3xl font-bold mb-1 text-amber-500">{cycle.intake.toFixed(2)} <span className="text-xs sm:text-sm font-normal text-amber-500/80">Bags</span></div>
                            <div className="text-[10px] sm:text-xs text-amber-500/70">
                                Total {isActive ? 'current' : 'final'} consumption records found.
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* RIGHT SIDE: Tabs/Accordion System */}
                <div className="col-span-7 lg:col-span-5 space-y-4 sm:space-y-6 min-w-0 w-full">
                    {/* Desktop View: Tabs */}
                    <div className="hidden sm:block">
                        <Tabs defaultValue="logs" className="w-full">
                            <TabsList className="grid w-full grid-cols-4 h-11 bg-muted/50 p-1 rounded-xl border border-border/50">
                                <TabsTrigger value="logs" className="text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg transition-all font-bold">Logs</TabsTrigger>
                                <TabsTrigger value="sales" className="text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg transition-all font-bold">Sales</TabsTrigger>
                                <TabsTrigger value="history" className="text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg transition-all font-bold">Other Cycles</TabsTrigger>
                                <TabsTrigger value="analysis" className="text-sm data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-lg transition-all font-bold">Analysis</TabsTrigger>
                            </TabsList>

                            <TabsContent value="logs" className="mt-6">
                                <Card className="shadow-sm border-border/50 bg-card">
                                    <CardContent className="pt-6">
                                        <LogsTabContent isActive={isActive} logs={logs} />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="sales" className="mt-6">
                                <Card className="shadow-sm border-border/50 bg-card">
                                    <CardContent className="pt-6">
                                        <SalesHistoryCard cycleId={isActive ? cycle.id : undefined} historyId={!isActive ? cycle.id : undefined} />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="history" className="mt-6">
                                <Card className="shadow-sm border-border/50 bg-card">
                                    <CardContent className="pt-6">
                                        <OtherCyclesTabContent history={history} cycleId={cycle.id} farmerName={farmerContext.name} />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="analysis" className="mt-6">
                                <AnalysisContent cycle={cycle} history={history.filter((h: any) => h.id !== cycle.id) || []} />
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Mobile View: Accordion */}
                    <div className="block sm:hidden">
                        <Accordion type="single" collapsible defaultValue="logs" className="space-y-4">
                            <AccordionItem value="logs" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
                                <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                                    <div className="flex items-center gap-2">
                                        <History className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-semibold tracking-tight">Activity Logs</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <LogsTabContent isActive={isActive} logs={logs} isMobile />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="sales" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
                                <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                                    <div className="flex items-center gap-2">
                                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-semibold tracking-tight">Sales History</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <SalesHistoryCard cycleId={isActive ? cycle.id : undefined} historyId={!isActive ? cycle.id : undefined} isMobile />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="history" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
                                <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                                    <div className="flex items-center gap-2">
                                        <Archive className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-semibold tracking-tight">Other Cycles</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <OtherCyclesTabContent history={history} cycleId={cycle.id} farmerName={farmerContext.name} isMobile />
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="analysis" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-2 border-border/50">
                                <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                                    <div className="flex items-center gap-2">
                                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                                        <span className="font-semibold tracking-tight">Analysis Insights</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                    <AnalysisContent cycle={cycle} history={history.filter((h: any) => h.id !== cycle.id) || []} />
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </div>
            </div>
        </div >
    );
};

export default function CycleDetailsPage() {
    const params = useParams();
    const id = Array.isArray(params.id) ? params.id[0] : params.id;

    if (!id) return <ErrorState title="Error" description="No cycle ID provided." />;

    return (
        <ErrorBoundary fallback={<ErrorState title="Error" description="An unexpected error occurred while loading cycle details." />}>
            <Suspense fallback={<LoadingState title="Loading" description="Preparing cycle dashboard..." />}>
                <CycleDetailsContent id={id} />
            </Suspense>
        </ErrorBoundary>
    );
}
