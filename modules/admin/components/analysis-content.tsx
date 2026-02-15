"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";
import {
    AlertTriangle,
    Calculator,
    Lightbulb,
    Scale,
    TrendingUp,
} from "lucide-react";

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
                                    <span className="font-bold text-foreground">{format(new Date(cycle.createdAt), "dd/MM/yyyy")}</span>
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
