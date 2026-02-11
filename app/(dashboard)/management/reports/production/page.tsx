"use client";

import { Button } from "@/components/ui/button";
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
import { addMonths, format, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { useState } from "react";

export default function ManagementProductionReportPage() {
    // Default to previous month
    const [date, setDate] = useState(() => subMonths(new Date(), 1));
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
                        Review officer performance and farmer production metrics.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Officer Selector */}
                    <Select
                        value={selectedOfficerId}
                        onValueChange={setSelectedOfficerId}
                    >
                        <SelectTrigger className="w-[200px]">
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
                    <div className="flex items-center gap-2 bg-card p-1 rounded-md border shadow-sm">
                        <Button variant="ghost" size="icon" onClick={handlePreviousMonth}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="w-32 text-center font-medium">
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
