
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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
        <Card className="col-span-1 md:col-span-2 lg:col-span-4 border-primary/10 bg-card/50 backdrop-blur-sm rounded-[2rem] overflow-hidden group shadow-sm hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ring-1 ring-primary/20">
                        <Trophy className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-tight">Top Performers</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                            Efficiency by Mortality Rate
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {topPerformers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed border-border/50">
                            <p className="text-xs font-bold uppercase tracking-widest opacity-40">No Performance Data</p>
                        </div>
                    ) : (
                        topPerformers.map((farmer, i) => {
                            return (
                                <div key={farmer.farmerId} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50 transition-all hover:bg-muted/50 group/item">
                                    <div className="flex items-center gap-3 md:gap-4">
                                        <div className={cn(
                                            "flex items-center justify-center h-8 w-8 md:h-10 md:w-10 rounded-xl font-black text-xs transition-all duration-300",
                                            i === 0 ? "bg-amber-500/20 text-amber-600 ring-2 ring-amber-500/30 scale-110 shadow-md" :
                                                i === 1 ? "bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/20" :
                                                    "bg-orange-500/10 text-orange-600 ring-1 ring-orange-500/20"
                                        )}>
                                            #{i + 1}
                                        </div>
                                        <div>
                                            <p className="font-black text-sm uppercase tracking-tight">{farmer.farmerName}</p>
                                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest opacity-60">
                                                {farmer.activeCyclesCount} {cycleLabel}{farmer.activeCyclesCount !== 1 ? 's' : ''}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-black uppercase tracking-tighter px-3 py-1 rounded-full">
                                            {farmer.avgMortalityRate.toFixed(1)}% <span className="ml-1 opacity-50 font-medium lowercase">mortality</span>
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
