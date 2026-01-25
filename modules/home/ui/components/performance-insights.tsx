
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy } from "lucide-react";

interface PerformanceInsightsProps {
    topPerformers: Array<{
        farmerId: string;
        farmerName: string;
        activeCyclesCount: number;
        totalDoc: number;
        avgMortalityRate: number; // Percent
    }>;
    cycleLabel?: string;
    title?: string;
    description?: string;
}

export const PerformanceInsights = ({
    topPerformers,
    cycleLabel = "Active Cycle",
    title = "Top Performing Farmers",
    description = "Best efficiency based on lowest average mortality across active cycles"
}: PerformanceInsightsProps) => {
    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-emerald-100 bg-gradient-to-br from-white to-emerald-50/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-emerald-500" />
                    {title}
                </CardTitle>
                <CardDescription>
                    {description}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {topPerformers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[140px] text-muted-foreground bg-white/50 rounded-lg border border-dashed">
                            <p className="text-sm">No performance data available.</p>
                        </div>
                    ) : (
                        topPerformers.map((farmer, i) => {
                            return (
                                <div key={farmer.farmerId} className="flex items-center justify-between p-3 bg-white rounded-lg border border-slate-100 shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className={`flex items-center justify-center h-8 w-8 rounded-full font-bold text-xs
                                            ${i === 0 ? "bg-amber-100 text-amber-700 ring-1 ring-amber-200" :
                                                i === 1 ? "bg-slate-100 text-slate-600" :
                                                    "bg-orange-50 text-orange-700"
                                            }`}>
                                            #{i + 1}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-sm text-slate-900">{farmer.farmerName}</p>
                                            <p className="text-xs text-muted-foreground">{farmer.activeCyclesCount} {cycleLabel}{farmer.activeCyclesCount !== 1 ? 's' : ''}</p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                            {farmer.avgMortalityRate.toFixed(2)}% Avg Mort.
                                        </Badge>
                                    </div>
                                </div>
                            )
                        })
                    )}
                </div>
            </CardContent>
        </Card>
    );
};
