
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

interface UrgentActionsProps {
    lowStockCycles: Array<{
        id: string;
        name: string;
        farmerName: string;
        farmerMainStock: number;
    }>;
}

export const UrgentActions = ({ lowStockCycles }: UrgentActionsProps) => {
    return (
        <Card className="col-span-1 md:col-span-2 lg:col-span-3 border-amber-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                    Urgent Supply Needs
                </CardTitle>
                <CardDescription>
                    Farmers with critically low feed stock (Less than 3 bags)
                </CardDescription>
            </CardHeader>
            <CardContent>
                {lowStockCycles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[140px] text-muted-foreground bg-slate-50 rounded-lg border border-dashed">
                        <p className="text-sm">No urgent stock alerts.</p>
                        <p className="text-xs">All farmers have sufficient feed.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {lowStockCycles.slice(0, 3).map((cycle) => (
                            <div key={cycle.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-100 shadow-sm">
                                <div className="space-y-1">
                                    <p className="font-semibold text-sm text-slate-900">{cycle.farmerName}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Cycle: {cycle.name} &bull; Stock: <span className="font-medium text-amber-600">{cycle.farmerMainStock} bags</span>
                                    </p>
                                </div>
                                <Button size="sm" variant="outline" className="h-8 border-amber-200 hover:bg-amber-50 text-amber-700" asChild>
                                    <Link href={`/cycles`}>
                                        Manage
                                    </Link>
                                </Button>
                            </div>
                        ))}
                        {lowStockCycles.length > 3 && (
                            <div className="pt-2 text-center">
                                <Button variant="link" size="sm" asChild>
                                    <Link href="/cycles" className="text-amber-600">
                                        View {lowStockCycles.length - 3} more alerts <ArrowRight className="ml-1 h-3 w-3" />
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
