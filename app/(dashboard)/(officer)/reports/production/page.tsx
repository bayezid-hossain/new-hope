"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProductionRecordTable } from "@/modules/reports/ui/components/production-record-table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

import { addMonths, format, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function OfficerProductionReportPage() {
    // Default to previous month as it's more likely to have completed cycles
    const [date, setDate] = useState(() => subMonths(new Date(), 1));
    const trpc = useTRPC()
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11

    const { data, isLoading } = useQuery(trpc.officerPerformance.getMonthlyProductionRecord.queryOptions({
        year,
        month,
    }));

    const handlePreviousMonth = () => {
        setDate((prev) => subMonths(prev, 1));
    };

    const handleNextMonth = () => {
        setDate((prev) => addMonths(prev, 1));
    };

    const monthName = format(date, "MMMM");

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Monthly Production Record</h1>
                    <p className="text-muted-foreground">
                        Performance metrics for cycles ended in specific months.
                    </p>
                </div>

                <div className="flex items-center gap-2 bg-card p-1 rounded-md border shadow-sm">
                    <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <div className="w-40 text-center font-medium">
                        {monthName} {year}
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNextMonth}
                        disabled={addMonths(date, 1) > new Date()}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle>{monthName} {year} Production</CardTitle>
                    <CardDescription>
                        Consolidated performance record for all your farmers whose cycles ended in {monthName}.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ProductionRecordTable
                        data={data}
                        isLoading={isLoading}
                        monthName={monthName}
                        year={year}
                    />
                </CardContent>
            </Card>
        </div>
    );
}
