"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Calculator, Lightbulb, Scale, TrendingUp } from "lucide-react";

export const AnalysisContent = ({
    cycle,
    history
}: {
    cycle: any,
    history: any[]
}) => {
    const doc = cycle.doc || 0;
    const mortality = cycle.mortality || 0;
    const currentMortalityRate = doc > 0 ? (mortality / doc) * 100 : 0;

    // Calculate Historical Averages (safely)
    const historicalAvgMortality = history.length > 0
        ? history.reduce((acc: number, h: any) => {
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
        ? history.reduce((acc: number, h: any) => {
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
