"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Farmer, FarmerHistory } from "@/modules/cycles/types";
import { LogsTimeline } from "@/modules/cycles/ui/components/cycles/logs-timeline";
import { MobileCycleCard } from "@/modules/cycles/ui/components/cycles/mobile-cycle-card";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { ActionsCell, getHistoryColumns, HistoryActionsCell } from "@/modules/cycles/ui/components/shared/columns-factory";
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
    ShoppingCart,
    Trash2,
    TrendingUp,
    UsersIcon
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

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

    const liveBirds = Math.max(0, doc - mortality - (cycle.birdsSold || 0));
    const currentFeedPerBird = liveBirds > 0 ? (intake / liveBirds) : 0;

    const historicalAvgFeedPerBird = history.length > 0
        ? history.reduce((acc: number, h: any) => {
            const hLive = (h.doc || 0) - (h.mortality || 0);
            const hIntake = h.intake || h.finalIntake || 0;
            return acc + (hLive > 0 ? hIntake / hLive : 0);
        }, 0) / history.length
        : 0;

    const suggestions = [];
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
                            <CardHeader className="pb-2 px-6">
                                <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                                    <Calculator className="h-4 w-4 text-primary" /> Intake Insights
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-6 pb-4">
                                <div className="flex justify-between items-end mb-2">
                                    <div>
                                        <div className="text-2xl font-bold text-foreground">
                                            {avgDailyIntake.toFixed(2)} bags
                                        </div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-tight font-medium">Daily Avg Consumption</p>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-sm font-medium text-foreground">{currentFeedPerBird.toFixed(3)}</div>
                                        <p className="text-xs text-muted-foreground uppercase tracking-tight font-medium">Bags per Bird</p>
                                    </div>
                                </div>
                                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50 italic">
                                    Efficiency calculated on {liveBirds} live birds.
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="bg-card border-border/50 shadow-sm py-2">
                            <CardHeader className="pb-2 px-6">
                                <CardTitle className="text-sm font-medium flex items-center gap-2 text-foreground">
                                    <Scale className="h-4 w-4 text-primary" /> Historical Benchmark
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4 px-6 pb-4">
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

                    <div className="grid gap-6 md:grid-cols-2">
                        <Card className="border-border/10 shadow-sm bg-card">
                            <CardHeader>
                                <CardTitle className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Production Summary</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-muted-foreground text-sm">Start Date</span>
                                    <span className="font-bold text-foreground">{format(new Date(cycle.createdAt), "dd MMM, yyyy")}</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-muted-foreground text-sm">Initial Stock (DOC)</span>
                                    <span className="font-bold text-foreground">{cycle.doc} Birds</span>
                                </div>
                                <div className="flex items-center justify-between py-2 border-b border-border/50">
                                    <span className="text-muted-foreground text-sm">Survival Rate</span>
                                    <span className={`font-bold ${currentMortalityRate < 5 ? 'text-primary' : 'text-destructive'}`}>
                                        {(100 - currentMortalityRate).toFixed(2)}%
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    <Card className="shadow-sm border-border/50 bg-card overflow-hidden">
                        <CardHeader className="px-6">
                            <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                                <Lightbulb className="h-5 w-5 text-amber-500" />
                                Smart Suggestions
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 px-6 pb-6">
                            {suggestions.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground text-sm border-2 border-dashed border-border/50 rounded-lg bg-muted/30">
                                    Everything looks good! No critical alerts at this time.
                                </div>
                            ) : (suggestions.map((s, i) => (
                                <Alert key={i} variant={s.type === 'critical' ? 'destructive' : 'default'} className={s.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600' : ''}>
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
            </CardContent>
        </Card>
    );
};

const OtherCyclesTabContent = ({ history, isAdmin, isManagement, currentId, orgId }: { history: any[], isAdmin?: boolean, isManagement?: boolean, currentId?: string, orgId?: string }) => {
    const prefix = isAdmin ? `/admin/organizations/${orgId}` : (isManagement ? "/management" : "");
    return (
        <Card className="border-none shadow-sm bg-card overflow-hidden">
            <CardHeader className="border-b border-border/50 pb-4">
                <CardTitle className="text-lg font-bold text-foreground">Other Farmer Cycles</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <div className="p-4">
                    {history && history.length > 0 ? (
                        <>
                            <div className="hidden md:block">
                                <DataTable
                                    columns={getHistoryColumns({ prefix, currentId })}
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
                {/* Navigation Aid: Nearby Farmers */}
                {!currentId && (
                    <div className="mt-8 pt-8 border-t border-dashed border-border">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-4 px-1 uppercase tracking-wider">Quick Navigation</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <Link href={prefix + "/farmers"} className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-card hover:border-primary/30 hover:shadow-md transition-all text-center group">
                                <UsersIcon className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50 group-hover:text-primary" />
                                <span className="text-xs font-bold text-muted-foreground group-hover:text-primary block">All Farmers</span>
                            </Link>
                            {/* We could potentially fetch next/prev farmers here if we had the context, 
                                    for now we link back to main lists or related views */}
                        </div>
                    </div>
                )}
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
    const { orgId } = useCurrentOrg()
    const [showReopenModal, setShowReopenModal] = useState(false);

    const { data: response, isLoading } = useQuery(
        isAdmin
            ? trpc.admin.cycles.getDetails.queryOptions({ id: cycleId })
            : isManagement
                ? trpc.management.cycles.getDetails.queryOptions({ id: cycleId })
                : trpc.officer.cycles.getDetails.queryOptions({ id: cycleId })
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
            createdAt: (cycle as any).createdAt,
            farmerName: farmerContext.name,
            birdsSold: (cycle as any).birdsSold || 0,
            status: type === 'active' ? 'active' : (cycle as any).status
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
        return <div className="p-8 text-center text-muted-foreground italic">Cycle not found.</div>;
    }

    const { logs, history = [] } = response;
    const mortalityRate = normalizedCycle.doc > 0 ? (normalizedCycle.mortality / normalizedCycle.doc) * 100 : 0;

    return (
        <div className="space-y-6 w-full">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shadow-sm bg-card border border-border/50 transition-all hover:bg-muted">
                        <ChevronLeft className="h-5 w-5 text-foreground" />
                    </Button>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground"> <Link
                            href={isAdmin ? `/admin/organizations/${orgId}/farmers/${response?.data?.farmerId}` : (isManagement ? `/management/farmers/${response?.data?.farmerId}` : `/farmers/${response?.data?.farmerId}`)}
                            className="text-foreground font-bold hover:underline hover:text-primary transition-colors underline decoration-border/50"
                        >{normalizedCycle.farmerName}</Link></h1>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] font-bold uppercase">
                                {isAdmin ? "Admin View" : "Management View"}
                            </Badge>
                            {normalizedCycle.status === 'active' ? (
                                <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none font-bold text-[10px] uppercase tracking-wider">
                                    <Activity className="h-3 w-3 mr-1" /> Active
                                </Badge>
                            ) : normalizedCycle.status === 'deleted' ? (
                                <Badge variant="destructive" className="bg-destructive/10 text-destructive border-none font-bold text-[10px] uppercase tracking-wider">
                                    <Trash2 className="h-3 w-3 mr-1" /> Deleted by Officer
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="bg-muted text-muted-foreground border-none font-bold text-[10px] uppercase tracking-wider">
                                    <Archive className="h-3 w-3 mr-1" /> Archived
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto ml-auto">
                    {/* Unified Actions Dropdown */}
                    <div className="bg-card border border-border rounded-md shadow-sm h-8 w-8 flex items-center justify-center ml-2">
                        {normalizedCycle.status === "active" ? (
                            <ActionsCell
                                prefix={isAdmin ? `/admin/organizations/${orgId}` : (isManagement ? `/management` : undefined)}
                                cycle={{
                                    ...normalizedCycle,
                                    id: cycleId,
                                    farmerId: (response.data as any).farmerId, // or derive
                                    organizationId: (response.data as any).organizationId,
                                    status: "active",
                                    officerName: null,
                                    createdAt: new Date(normalizedCycle.createdAt),
                                    updatedAt: new Date(),
                                    intake: normalizedCycle.intake.toString()
                                } as unknown as Farmer}
                            />
                        ) : (
                            <HistoryActionsCell
                                prefix={isAdmin ? `/admin/organizations/${orgId}` : (isManagement ? `/management` : undefined)}
                                history={{
                                    id: cycleId,
                                    cycleName: normalizedCycle.name,
                                    farmerName: normalizedCycle.farmerName,
                                    finalIntake: normalizedCycle.intake,
                                    doc: normalizedCycle.doc,
                                    mortality: normalizedCycle.mortality,
                                    age: normalizedCycle.age,
                                    status: "history",
                                    startDate: new Date(normalizedCycle.createdAt),
                                    endDate: new Date(), // Mock end date or fetch it
                                    farmerId: (response.data as any).farmerId,
                                    organizationId: (response.data as any).organizationId,
                                } as unknown as FarmerHistory}
                            />
                        )}
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
                <Card className="border-border/10 shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Age</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-foreground">{normalizedCycle.age}</span>
                            <span className="text-muted-foreground text-xs font-medium">{normalizedCycle.age > 1 ? "days" : "day"}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/10 shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live Birds</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-primary">{(normalizedCycle.doc - normalizedCycle.mortality - normalizedCycle.birdsSold).toLocaleString()}</span>
                                <Bird className="h-4 w-4 text-muted-foreground/30" />
                            </div>
                            <span className="text-[10px] text-muted-foreground">of {normalizedCycle.doc.toLocaleString()} DOC</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/10 shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sold</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-foreground">{normalizedCycle.birdsSold.toLocaleString()}</span>
                            <ShoppingCart className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/10 shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mortality</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-bold ${normalizedCycle.mortality > 0 ? "text-destructive" : "text-foreground"}`}>
                                {normalizedCycle.mortality}
                            </span>
                            <span className="text-xs text-destructive font-bold">({mortalityRate.toFixed(2)}%)</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/10 shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Intake</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-amber-500">{normalizedCycle.intake.toFixed(2)}</span>
                            <span className="text-muted-foreground text-xs font-medium">bags</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="timeline" className="space-y-6">
                <TabsList className="bg-muted/50 border border-border/50 shadow-sm p-1 rounded-xl h-auto inline-flex overflow-x-auto max-w-full">
                    <TabsTrigger value="timeline" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold whitespace-nowrap transition-all">
                        <History className="h-4 w-4" /> Timeline
                    </TabsTrigger>
                    <TabsTrigger value="others" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold whitespace-nowrap transition-all">
                        <Archive className="h-4 w-4" /> Other Cycles
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold whitespace-nowrap transition-all">
                        <TrendingUp className="h-4 w-4" /> Analytics
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="timeline" className="mt-0 focus-visible:outline-none">
                    <Card className="border-none shadow-sm bg-card overflow-hidden">
                        <CardHeader className="border-b border-border/50 pb-4">
                            <CardTitle className="text-lg font-bold text-foreground">Activity Logs</CardTitle>
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
                        orgId={orgId ?? ""}
                    />
                </TabsContent>
            </Tabs>

        </div>
    );
};
