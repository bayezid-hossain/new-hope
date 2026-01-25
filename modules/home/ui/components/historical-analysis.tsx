"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Activity, History, TrendingUp } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FeedConsumptionChart } from "../components/feed-consumption-chart";
import { PerformanceInsights } from "../components/performance-insights";

export const HistoricalAnalysis = () => {
    const trpc = useTRPC();
    const { orgId } = useCurrentOrg();

    // Fetch last 100 cycles for broader historical context (Trend + Aggregation)
    const { data } = useSuspenseQuery(
        trpc.officer.cycles.listPast.queryOptions({
            orgId: orgId!,
            page: 1,
            pageSize: 100,
            sortBy: "createdAt",
            sortOrder: "desc"
        })
    );

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
        existing.totalIntake += (cycle.finalIntake || 0);
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
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Cycles</CardTitle>
                        <History className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalCycles}</div>
                        <p className="text-xs text-muted-foreground">
                            Completed cycles
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Mortality</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{globalAvgMortality}%</div>
                        <p className="text-xs text-muted-foreground">
                            Historical average
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Birds Processed</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalBirdsProcessed.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">
                            Total birds reared
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Row 2: Charts */}
            <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Farmer Mortality Benchmark</CardTitle>
                        <CardDescription>Cumulative avg. mortality % per farmer (Lower is better)</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={benchmarkData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        interval={0}
                                        height={60}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelStyle={{ color: '#64748b' }}
                                    />
                                    <Line type="monotone" dataKey="mortality" stroke="#10b981" strokeWidth={2} activeDot={{ r: 8 }} name="Avg Mortality %" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Farmer Efficiency Benchmark</CardTitle>
                        <CardDescription>Cumulative bags/100 birds per farmer</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={benchmarkData} margin={{ top: 5, right: 30, left: 20, bottom: 50 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        angle={-45}
                                        textAnchor="end"
                                        interval={0}
                                        height={60}
                                        tick={{ fontSize: 10 }}
                                    />
                                    <YAxis />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Line type="monotone" dataKey="efficiency" stroke="#f59e0b" strokeWidth={2} name="Bags/100 Birds" />
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
