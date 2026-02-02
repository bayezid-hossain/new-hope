
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, AlertTriangle, Bird, Layers } from "lucide-react";

interface KpiCardsProps {
    totalBirds: number;
    totalFeedStock: number;
    activeConsumption: number;
    availableStock: number;
    lowStockCount: number;
    avgMortality: string;
    activeCyclesCount: number;
}

export const KpiCards = ({ totalBirds, totalFeedStock, activeConsumption, availableStock, lowStockCount, avgMortality, activeCyclesCount }: KpiCardsProps) => {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 xs:pb-2">
                    <CardTitle className="text-[10px] xs:text-sm font-medium">Active Birds</CardTitle>
                    <Bird className="h-3 w-3 xs:h-4 xs:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg xs:text-2xl font-bold">{totalBirds.toLocaleString()}</div>
                    <p className="text-[9px] xs:text-xs text-muted-foreground">
                        Across {activeCyclesCount} active cycles
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 xs:pb-2">
                    <CardTitle className="text-[10px] xs:text-sm font-medium">Feed Inventory</CardTitle>
                    <Layers className="h-3 w-3 xs:h-4 xs:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg xs:text-2xl font-bold">{availableStock.toFixed(2)} <span className="text-[10px] xs:text-sm font-normal text-muted-foreground">bags</span></div>
                    <div className="mt-1 xs:mt-2 text-[9px] xs:text-xs space-y-0.5 xs:space-y-1">
                        <div className="flex justify-between text-amber-600/80">
                            <span>Active:</span>
                            <span className="font-medium">+{activeConsumption.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground pt-0.5 xs:pt-1 border-t border-dashed">
                            <span>Total:</span>
                            <span className="font-medium text-slate-500">{totalFeedStock.toFixed(2)}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 xs:pb-2">
                    <CardTitle className="text-[10px] xs:text-sm font-medium">Avg. Mortality</CardTitle>
                    <Activity className="h-3 w-3 xs:h-4 xs:w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-lg xs:text-2xl font-bold">{avgMortality}%</div>
                    <p className="text-[9px] xs:text-xs text-muted-foreground">
                        Active average
                    </p>
                </CardContent>
            </Card>

            <Card className={lowStockCount > 0 ? "border-red-200 bg-red-50" : ""}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 xs:pb-2">
                    <CardTitle className="text-[10px] xs:text-sm font-medium">Low Stock</CardTitle>
                    <AlertTriangle className={`h-3 w-3 xs:h-4 xs:w-4 ${lowStockCount > 0 ? "text-red-500" : "text-muted-foreground"}`} />
                </CardHeader>
                <CardContent>
                    <div className={`text-lg xs:text-2xl font-bold ${lowStockCount > 0 ? "text-red-600" : ""}`}>{lowStockCount}</div>
                    <p className={`text-[9px] xs:text-xs ${lowStockCount > 0 ? "text-red-600/80" : "text-muted-foreground"}`}>
                        Alerts
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
