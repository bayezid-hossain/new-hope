"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    Crown,
    Lock,
    Skull,
    TrendingDown,
    TrendingUp,
    Trophy,
    Wheat
} from "lucide-react";

interface PerformanceBenchmarkCardProps {
    farmerId: string;
}

export function PerformanceBenchmarkCard({ farmerId }: PerformanceBenchmarkCardProps) {
    const trpc = useTRPC();
    const { orgId } = useCurrentOrg();

    const { data, isLoading, isError, error } = useQuery(
        trpc.officer.farmers.getBenchmark.queryOptions({
            farmerId,
            orgId: orgId!
        })
    );

    // Handle Pro access error
    if (isError) {
        const isForbidden = (error as any)?.data?.code === "FORBIDDEN";
        if (isForbidden) {
            return (
                <Card className="border border-border/50 shadow-sm bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 overflow-hidden">
                    <CardContent className="p-6">
                        <div className="flex flex-col items-center justify-center gap-3 py-4">
                            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
                                <Lock className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="text-center space-y-1">
                                <h3 className="font-semibold text-foreground flex items-center justify-center gap-1.5">
                                    <Crown className="h-4 w-4 text-amber-500" />
                                    Pro Feature
                                </h3>
                                <p className="text-xs text-muted-foreground max-w-[200px]">
                                    Unlock Performance Benchmarking to compare this farmer against organization averages.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            );
        }
        return null; // Other errors - hide card
    }

    if (isLoading) {
        return (
            <Card className="border border-border/50 shadow-sm bg-card overflow-hidden">
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <Skeleton className="h-4 w-32" />
                        <div className="grid grid-cols-3 gap-4">
                            <Skeleton className="h-20" />
                            <Skeleton className="h-20" />
                            <Skeleton className="h-20" />
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!data?.hasEnoughData) {
        return (
            <Card className="border border-border/50 shadow-sm bg-card overflow-hidden">
                <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center gap-2 py-4 text-muted-foreground">
                        <Activity className="h-8 w-8 opacity-50" />
                        <p className="text-sm font-medium">Not enough data</p>
                        <p className="text-xs text-center max-w-[200px]">
                            Complete at least one cycle to see performance benchmarks.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const { farmer, organization, score } = data;

    // Determine score badge color
    const getScoreColor = (s: number) => {
        if (s >= 75) return "bg-emerald-500 text-white";
        if (s >= 50) return "bg-amber-500 text-white";
        return "bg-rose-500 text-white";
    };

    const getScoreLabel = (s: number) => {
        if (s >= 75) return "Excellent";
        if (s >= 50) return "Average";
        return "Needs Improvement";
    };

    // Compare metrics
    const mortalityBetter = farmer.mortalityRate <= organization.mortalityRate;
    const fcrBetter = farmer.fcr <= organization.fcr;

    return (
        <Card className="border border-border/50 shadow-sm bg-card overflow-hidden">
            <CardContent className="p-4 xs:p-6">
                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                            <Trophy className="h-3 w-3 xs:h-4 xs:w-4 text-amber-500" />
                            Performance Score
                        </h3>
                        <Badge className={`${getScoreColor(score)} px-2 py-0.5 text-xs font-bold`}>
                            {score}/100 • {getScoreLabel(score)}
                        </Badge>
                    </div>

                    {/* Score Bar */}
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ${score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"}`}
                            style={{ width: `${score}%` }}
                        />
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-2 gap-3 xs:gap-4">
                        {/* Mortality Rate */}
                        <div className="space-y-1 p-3 rounded-lg bg-muted/30 border border-border/30">
                            <div className="flex items-center gap-1.5 text-[10px] xs:text-xs text-muted-foreground font-medium">
                                <Skull className="h-3 w-3 xs:h-4 xs:w-4" />
                                Mortality Rate
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-lg xs:text-xl font-bold ${mortalityBetter ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                    {farmer.mortalityRate.toFixed(1)}%
                                </span>
                                <span className={`text-[10px] xs:text-xs flex items-center gap-0.5 ${mortalityBetter ? "text-emerald-600" : "text-rose-600"}`}>
                                    {mortalityBetter ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                    vs {organization.mortalityRate.toFixed(1)}%
                                </span>
                            </div>
                            <p className="text-[9px] xs:text-[10px] text-muted-foreground">
                                Org Avg
                            </p>
                        </div>

                        {/* FCR */}
                        <div className="space-y-1 p-3 rounded-lg bg-muted/30 border border-border/30">
                            <div className="flex items-center gap-1.5 text-[10px] xs:text-xs text-muted-foreground font-medium">
                                <Wheat className="h-3 w-3 xs:h-4 xs:w-4" />
                                Feed/Bird (FCR)
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className={`text-lg xs:text-xl font-bold ${fcrBetter ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                    {farmer.fcr.toFixed(2)}
                                </span>
                                <span className={`text-[10px] xs:text-xs flex items-center gap-0.5 ${fcrBetter ? "text-emerald-600" : "text-rose-600"}`}>
                                    {fcrBetter ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                                    vs {organization.fcr.toFixed(2)}
                                </span>
                            </div>
                            <p className="text-[9px] xs:text-[10px] text-muted-foreground">
                                Org Avg
                            </p>
                        </div>
                    </div>

                    {/* Footer Stats */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30 text-[10px] xs:text-xs text-muted-foreground">
                        <span>Based on <strong className="text-foreground">{farmer.totalCycles}</strong> cycles</span>
                        <span>Avg age: <strong className="text-foreground">{farmer.avgAge}</strong> days</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
