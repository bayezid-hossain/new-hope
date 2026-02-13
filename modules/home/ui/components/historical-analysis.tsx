"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Activity, History, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FeedConsumptionChart } from "../components/feed-consumption-chart";
import { PerformanceInsights } from "../components/performance-insights";

export const HistoricalAnalysis = ({ variant = "officer" }: { variant?: "officer" | "management" }) => {
    const trpc = useTRPC();
    const { orgId } = useCurrentOrg();

    // Select the appropriate query based on variant
    const queryOptions = variant === "management"
        ? trpc.management.cycles.listPast.queryOptions({
            orgId: orgId!,
            page: 1,
            pageSize: 100,
            sortBy: "createdAt",
            sortOrder: "desc"
        })
        : trpc.officer.cycles.listPast.queryOptions({
            orgId: orgId!,
            page: 1,
            pageSize: 100,
            sortBy: "createdAt",
            sortOrder: "desc"
        });

    // Fetch last 100 cycles for broader historical context (Trend + Aggregation)
    const { data } = useSuspenseQuery(queryOptions as any) as {
        data: {
            items: {
                doc: number;
                mortality: number;
                farmerId: string;
                farmerName: string;
                intake: number | null;
                // Add other necessary fields if used, but these are the ones causing errors
            }[];
            total: number;
        }
    };

    const history = data.items;

    if (!history || history.length === 0) {
        return (
            <Card className="border-dashed">
                <CardHeader>
                    <CardTitle>Historical Analytics</CardTitle>
                    <CardDescription>No archived cycles found.</CardDescription>
                </CardHeader>
                <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
                    Complete cycles to see trends and insights here.
                </CardContent>
            </Card>
        )
    }

    // --- Analytics Calculations ---

    // 1. Global KPIs
    const totalCycles = data.total;
    const totalBirdsProcessed = history.reduce((acc, c) => acc + c.doc, 0);
    const totalMortality = history.reduce((acc, c) => acc + c.mortality, 0);
    const globalAvgMortality = totalBirdsProcessed > 0
        ? ((totalMortality / totalBirdsProcessed) * 100).toFixed(2)
        : "0.00";

    // 2. Cumulative Aggregation by Farmer
    const farmerStats = new Map<string, {
        farmerId: string;
        farmerName: string;
        totalIntake: number;
        totalDoc: number;
        totalMortality: number;
        cyclesCount: number;
    }>();

    history.forEach(cycle => {
        const existing = farmerStats.get(cycle.farmerId) || {
            farmerId: cycle.farmerId,
            farmerName: cycle.farmerName,
            totalIntake: 0,
            totalDoc: 0,
            totalMortality: 0,
            cyclesCount: 0
        };
        existing.totalIntake += (cycle.intake || 0);
        existing.totalDoc += cycle.doc;
        existing.totalMortality += cycle.mortality;
        existing.cyclesCount += 1;
        farmerStats.set(cycle.farmerId, existing);
    });

    const aggregatedFarmers = Array.from(farmerStats.values());

    // 3. Prepare Chart Data (One point per farmer = Cumulative Average)
    const benchmarkData = aggregatedFarmers
        .map(f => {
            const avgMortality = f.totalDoc > 0 ? (f.totalMortality / f.totalDoc) * 100 : 0;
            const avgEfficiency = f.totalDoc > 0 ? (f.totalIntake / f.totalDoc) * 100 : 0;
            return {
                name: f.farmerName,
                mortality: parseFloat(avgMortality.toFixed(2)),
                efficiency: parseFloat(avgEfficiency.toFixed(2)),
            };
        })
        .sort((a, b) => a.mortality - b.mortality); // Sort by Best Mortality (Ascending)

    // Top Historical Performers (Lowest Avg Mortality)
    const topHistoricalPerformers = [...aggregatedFarmers]
        .sort((a, b) => {
            const rateA = a.totalDoc > 0 ? a.totalMortality / a.totalDoc : 0;
            const rateB = b.totalDoc > 0 ? b.totalMortality / b.totalDoc : 0;
            return rateA - rateB;
        })
        .slice(0, 5)
        .map(f => ({
            ...f,
            activeCyclesCount: f.cyclesCount, // Mapping for component prop
            avgMortalityRate: f.totalDoc > 0 ? (f.totalMortality / f.totalDoc) * 100 : 0
        }));

    // Historical Feed Consumption
    const historicalFeedChartData = [...aggregatedFarmers]
        .sort((a, b) => b.totalIntake - a.totalIntake)
        .slice(0, 7)
        .map(f => ({
            name: f.farmerName,
            bags: f.totalIntake
        }));


    return (
        <div className="space-y-6">
            {/* Row 1: High Level KPIs */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group rounded-2xl md:rounded-[2rem]">
                    <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 p-5 md:p-6">
                        <span className="text-[10px] md:text-[11px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">Total Cycles</span>
                        <div className="p-2.5 rounded-xl md:rounded-2xl ring-1 ring-border/50 bg-primary/5 text-primary transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
                            <History className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 md:px-6 pb-5 md:pb-6">
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-foreground group-hover:translate-x-1 transition-transform">{totalCycles}</div>
                        <p className="mt-2 text-[10px] md:text-xs text-muted-foreground/50 font-bold uppercase tracking-widest">Completed cycles</p>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group rounded-2xl md:rounded-[2rem]">
                    <div className="absolute top-0 left-0 w-1 h-full bg-violet-500/20 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 p-5 md:p-6">
                        <span className="text-[10px] md:text-[11px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">Avg. Mortality</span>
                        <div className="p-2.5 rounded-xl md:rounded-2xl ring-1 ring-border/50 bg-violet-500/5 text-violet-500 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
                            <Activity className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 md:px-6 pb-5 md:pb-6">
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-foreground group-hover:translate-x-1 transition-transform">{globalAvgMortality}%</div>
                        <p className="mt-2 text-[10px] md:text-xs text-muted-foreground/50 font-bold uppercase tracking-widest">Historical average</p>
                    </CardContent>
                </Card>

                <Card className="relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 group rounded-2xl md:rounded-[2rem]">
                    <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20 opacity-20 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="flex flex-row items-center justify-between pb-2 p-5 md:p-6">
                        <span className="text-[10px] md:text-[11px] font-black uppercase text-muted-foreground/60 tracking-[0.15em]">Birds Processed</span>
                        <div className="p-2.5 rounded-xl md:rounded-2xl ring-1 ring-border/50 bg-emerald-500/5 text-emerald-500 transition-all duration-500 group-hover:scale-110 group-hover:rotate-6">
                            <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 md:px-6 pb-5 md:pb-6">
                        <div className="text-2xl md:text-3xl font-black tracking-tighter text-foreground group-hover:translate-x-1 transition-transform">{totalBirdsProcessed.toLocaleString()}</div>
                        <p className="mt-2 text-[10px] md:text-xs text-muted-foreground/50 font-bold uppercase tracking-widest">Total birds reared</p>
                    </CardContent>
                </Card>
            </div>

            {/* Row 2: Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
                <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-[2rem] overflow-hidden group shadow-sm hover:shadow-lg transition-all duration-300">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-black uppercase tracking-tight">Farmer Mortality Benchmark</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Cumulative avg. mortality % per farmer</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={benchmarkData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        interval={0}
                                        height={60}
                                        tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--muted-foreground)' }}
                                        className="uppercase tracking-tighter"
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '16px',
                                            backgroundColor: 'var(--card)',
                                            border: '1px solid var(--border)',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            padding: '12px'
                                        }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}
                                        labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}
                                    />
                                    <Line type="monotone" dataKey="mortality" stroke="var(--primary)" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }} activeDot={{ r: 8, strokeWidth: 0 }} name="Avg Mortality %" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-border/50 bg-card/50 backdrop-blur-sm rounded-[2rem] overflow-hidden group shadow-sm hover:shadow-lg transition-all duration-300">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-sm font-black uppercase tracking-tight">Farmer Efficiency Benchmark</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Cumulative bags/100 birds per farmer</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={benchmarkData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        interval={0}
                                        height={60}
                                        tick={{ fontSize: 10, fontWeight: 700, fill: 'var(--muted-foreground)' }}
                                        className="uppercase tracking-tighter"
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis tick={{ fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{
                                            borderRadius: '16px',
                                            backgroundColor: 'var(--card)',
                                            border: '1px solid var(--border)',
                                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                                            padding: '12px'
                                        }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 900, textTransform: 'uppercase' }}
                                        labelStyle={{ color: 'var(--muted-foreground)', marginBottom: '4px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}
                                    />
                                    <Line type="monotone" dataKey="efficiency" stroke="oklch(0.7 0.15 70)" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: 'var(--background)' }} activeDot={{ r: 8, strokeWidth: 0 }} name="Bags/100 Birds" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Row 3: Aggregated Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
                {/* Left Column: Feed Trends */}
                {/* min-w-0 prevents the chart from forcing the column to expand */}
                <div className="min-w-0">
                    <FeedConsumptionChart
                        feedChartData={historicalFeedChartData}
                        history
                    />
                </div>

                {/* Right Column: Top Performers */}
                <div className="min-w-0">
                    <PerformanceInsights
                        topPerformers={topHistoricalPerformers}
                        cycleLabel="Completed Cycle"
                        title="Historical Top Performers"
                        description="Best efficiency based on cumulative historical mortality"
                    />
                </div>
            </div>
        </div>
    );
};
