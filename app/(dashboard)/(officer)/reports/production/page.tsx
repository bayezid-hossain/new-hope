"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ProductionRecordTable } from "@/modules/reports/ui/components/production-record-table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

import { useState } from "react";

export default function OfficerProductionReportPage() {
    // Default to current month
    const [date, setDate] = useState(() => new Date());
    const trpc = useTRPC()
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11

    const { data, isLoading } = useQuery(trpc.officerPerformance.getMonthlyProductionRecord.queryOptions({
        year,
        month,
    }));

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i); // Last 5 years

    const monthName = months[month];

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Monthly Production Record</h1>
                    <p className="text-muted-foreground">
                        Performance metrics for cycles ended in specific months.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Month Picker */}
                    <Select
                        value={month.toString()}
                        onValueChange={(v) => {
                            const newDate = new Date(date);
                            newDate.setMonth(parseInt(v));
                            setDate(newDate);
                        }}
                    >
                        <SelectTrigger className="w-[130px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map((m, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                    {m}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Year Picker */}
                    <Select
                        value={year.toString()}
                        onValueChange={(v) => {
                            const newDate = new Date(date);
                            newDate.setFullYear(parseInt(v));
                            setDate(newDate);
                        }}
                    >
                        <SelectTrigger className="w-[110px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map((y) => (
                                <SelectItem key={y} value={y.toString()}>
                                    {y}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
