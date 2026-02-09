
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface UrgentActionsProps {
    lowStockCycles: Array<{
        id: string;
        name: string;
        farmerName: string;
        farmerMainStock?: number;
        availableStock: number;
    }>;
    canEdit: boolean;
}

export const UrgentActions = ({ lowStockCycles, canEdit }: UrgentActionsProps) => {
    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 border-amber-500/20 bg-card/50 backdrop-blur-sm rounded-[2rem] overflow-hidden group shadow-sm hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 ring-1 ring-amber-500/20">
                        <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-tight">Urgent Needs</CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">
                            Critical Supply Monitoring
                        </CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {lowStockCycles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed border-border/50">
                        <p className="text-xs font-bold uppercase tracking-widest opacity-40">All Farmers Stocked</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {lowStockCycles.slice(0, 3).map((cycle) => (
                            <div key={cycle.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-2xl border border-border/50 transition-all hover:bg-muted/50 group/item">
                                <div className="space-y-1">
                                    <p className="font-black text-sm uppercase tracking-tight">{cycle.farmerName}</p>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 text-[10px] font-black uppercase tracking-tighter">
                                            {cycle.availableStock < 0 ? 0 : cycle.availableStock.toFixed(1)} BAGS LEFT
                                        </Badge>
                                    </div>
                                </div>
                                {canEdit && (
                                    <Button size="sm" variant="secondary" className="h-9 px-4 font-black uppercase text-[10px] tracking-widest rounded-xl bg-background border-border/50 hover:bg-amber-500 hover:text-white transition-all shadow-sm" asChild>
                                        <Link href={`/cycles`}>
                                            Manage
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        ))}
                        {lowStockCycles.length > 3 && (
                            <div className="pt-2">
                                <Button variant="ghost" className="w-full h-10 font-black uppercase text-[10px] tracking-widest text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all" asChild>
                                    <Link href="/cycles">
                                        View {lowStockCycles.length - 3} more alerts <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                    </Link>
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
