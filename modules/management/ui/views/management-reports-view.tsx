
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, ShoppingCart } from "lucide-react";
import { SalesReportTab } from "../components/reports/sales-report-tab";
import { StockReportTab } from "../components/reports/stock-report-tab";

interface ManagementReportsViewProps {
    orgId: string;
}

export function ManagementReportsView({ orgId }: ManagementReportsViewProps) {
    return (
        <div className="flex-1 space-y-8 p-4 md:p-8 pt-6 max-w-7xl mx-auto">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                        Management Reports
                    </h2>
                    <p className="text-muted-foreground">
                        Financial insights and inventory tracking
                    </p>
                </div>
            </div>
            <Tabs defaultValue="sales" className="space-y-8">
                <TabsList className="bg-muted/50 p-1 rounded-2xl border border-muted/60 backdrop-blur-sm h-auto inline-flex shadow-sm">
                    <TabsTrigger
                        value="sales"
                        className="gap-2 rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all font-medium"
                    >
                        <ShoppingCart className="h-4 w-4" />
                        Sales Analytics
                    </TabsTrigger>
                    <TabsTrigger
                        value="stock"
                        className="gap-2 rounded-xl px-6 py-2.5 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-md transition-all font-medium"
                    >
                        <ClipboardList className="h-4 w-4" />
                        Stock Ledger
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="sales" className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <SalesReportTab orgId={orgId} />
                </TabsContent>
                <TabsContent value="stock" className="space-y-4 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
                    <StockReportTab orgId={orgId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
