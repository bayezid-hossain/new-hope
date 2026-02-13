"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { ProductionRecordTable } from "@/modules/reports/ui/components/production-record-table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { User } from "lucide-react";
import { useState } from "react";

export default function ManagementProductionReportPage() {
    // Default to previous month
    const [date, setDate] = useState(() => new Date());
    const [selectedOfficerId, setSelectedOfficerId] = useState<string | undefined>(undefined);
    const { orgId } = useCurrentOrg();
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11
    const trpc = useTRPC()
    // Fetch officers for dropdown
    const { data: officers } = useQuery(trpc.managementPerformance.getOfficersInOrg.queryOptions({ orgId: orgId! }));

    // Fetch report data only if officer is selected (or we could show empty state)
    const { data, isLoading } = useQuery(trpc.managementPerformance.getMonthlyProductionRecord.queryOptions(
        {
            orgId: orgId!,
            year,
            month,
            officerId: selectedOfficerId!,
        },
        {
            enabled: !!selectedOfficerId,
        }
    ));

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
                        Review officer performance and farmer production metrics.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Officer Selector */}
                    <Select
                        value={selectedOfficerId}
                        onValueChange={setSelectedOfficerId}
                    >
                        <SelectTrigger className="w-[180px]">
                            <User className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Select Officer" />
                        </SelectTrigger>
                        <SelectContent>
                            {officers?.map((officer) => (
                                <SelectItem key={officer.id} value={officer.id}>
                                    {officer.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

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
                    <CardTitle>
                        {selectedOfficerId
                            ? `${monthName} ${year} Production for ${officers?.find(o => o.id === selectedOfficerId)?.name}`
                            : "Select an Officer"}
                    </CardTitle>
                    <CardDescription>
                        {selectedOfficerId
                            ? `Consolidated performance record for cycles ended in ${monthName}.`
                            : "Please select an officer to view their monthly production records."}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {selectedOfficerId ? (
                        <ProductionRecordTable
                            data={data}
                            isLoading={isLoading}
                            monthName={monthName}
                            year={year}
                        />
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-center border rounded-md border-dashed">
                            <User className="h-10 w-10 text-muted-foreground mb-4" />
                            <h3 className="text-lg font-medium">No Officer Selected</h3>
                            <p className="text-muted-foreground max-w-sm">
                                Select an officer from the dropdown above to view their production performance.
                            </p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
