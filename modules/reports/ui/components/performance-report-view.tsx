"use client";

import ErrorState from "@/components/error-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Filter, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";

interface PerformanceReportViewProps {
    isManagement?: boolean;
    orgId?: string;
}

export function PerformanceReportView({ isManagement = false, orgId }: PerformanceReportViewProps) {
    const trpc = useTRPC();
    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedOfficerId, setSelectedOfficerId] = useState<string>("");

    // Fetch Officers (Management Only)
    const { data: officers } = useQuery(
        trpc.management.officers.getAll.queryOptions(
            { orgId: orgId! },
            { enabled: isManagement && !!orgId }
        )
    );

    // Fetch available years
    const { data: yearsData, isLoading: isLoadingYears } = useQuery(
        trpc.officer.performanceReports.getAvailableYears.queryOptions(
            { officerId: selectedOfficerId || undefined },
            { enabled: !isManagement || !!selectedOfficerId }
        )
    );

    // Auto-select latest year when data loads
    useEffect(() => {
        if (yearsData?.years && yearsData.years.length > 0) {
            // Only set if we haven't manually changed it or if it's the initial render
            // Since we want the LATEST, and it's sorted DESC by the server
            setSelectedYear(yearsData.years[0]);
        }
    }, [yearsData?.years]);

    // Fetch annual performance data
    // Managers use the same endpoint but provide an officerId
    const targetOfficerId = isManagement ? selectedOfficerId : undefined;

    const { data: performanceData, isLoading, error } = useQuery(
        trpc.officer.performanceReports.getAnnualPerformance.queryOptions(
            {
                year: selectedYear,
                officerId: targetOfficerId || undefined,
            },
            {
                enabled: !isManagement || !!selectedOfficerId
            }
        )
    );

    const formatNumber = (num: number) => {
        return new Intl.NumberFormat('en-US').format(Math.round(num));
    };

    const formatDecimal = (num: number, decimals = 2) => {
        return num.toFixed(decimals);
    };

    if (error) {
        return <ErrorState title="Error Loading Performance Data" description={error.message} />;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Performance Reports</h1>
                    <p className="text-muted-foreground">
                        Monthly broiler performance metrics and analytics
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {isManagement && (
                        <div className="w-[200px]">
                            <Select value={selectedOfficerId} onValueChange={setSelectedOfficerId}>
                                <SelectTrigger>
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
                        </div>
                    )}

                    {(!isManagement || selectedOfficerId) && yearsData?.years && yearsData.years.length > 0 && (
                        <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                            <SelectTrigger className="w-[120px]">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {yearsData.years.map((year) => (
                                    <SelectItem key={year} value={year.toString()}>
                                        {year}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            {isManagement && !selectedOfficerId ? (
                <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-muted/50">
                    <div className="mx-auto h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                        <Filter className="h-8 w-8 text-muted-foreground/40" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">Select an Officer</h3>
                    <p className="text-muted-foreground mt-1">
                        Please select an officer to view their performance analytics.
                    </p>
                </div>
            ) : (
                <>
                    {/* Summary Cards */}
                    {isLoading ? (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {[...Array(4)].map((_, i) => (
                                <Card key={i}>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <Skeleton className="h-4 w-24" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-8 w-20" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        performanceData && (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Total DOC Placed</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{formatNumber(performanceData.totalChicksIn)}</div>
                                        <p className="text-xs text-muted-foreground">
                                            Birds started in {selectedYear}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Total Sold</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{formatNumber(performanceData.totalChicksSold)}</div>
                                        <p className="text-xs text-muted-foreground">
                                            {performanceData.totalChicksIn > 0
                                                ? `${formatDecimal((performanceData.totalChicksSold / performanceData.totalChicksIn) * 100, 1)}% of total placed`
                                                : "0% of total placed"
                                            }
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Avg FCR</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{formatDecimal(performanceData.averageFCR)}</div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            {performanceData.averageFCR < 1.7 ? (
                                                <>
                                                    <TrendingUp className="h-3 w-3 text-green-600" />
                                                    <span className="text-green-600">Excellent</span>
                                                </>
                                            ) : performanceData.averageFCR < 2.0 ? (
                                                <>
                                                    <Minus className="h-3 w-3 text-yellow-600" />
                                                    <span className="text-yellow-600">Good</span>
                                                </>
                                            ) : (
                                                <>
                                                    <TrendingDown className="h-3 w-3 text-red-600" />
                                                    <span className="text-red-600">Needs improvement</span>
                                                </>
                                            )}
                                        </p>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Avg EPI</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{formatNumber(performanceData.averageEPI)}</div>
                                        <p className="text-xs text-muted-foreground">
                                            {formatDecimal(performanceData.averageSurvivalRate, 1)}% survival rate
                                        </p>
                                    </CardContent>
                                </Card>
                            </div>
                        )
                    )}

                    {/* Monthly Performance Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Monthly Breakdown</CardTitle>
                            <CardDescription>
                                Detailed performance metrics for each month of {selectedYear}
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="space-y-4">
                                    {[...Array(5)].map((_, i) => (
                                        <Skeleton key={i} className="h-12 w-full" />
                                    ))}
                                </div>
                            ) : (
                                performanceData && (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[100px]">Month</TableHead>
                                                    <TableHead className="text-right">Chicks IN</TableHead>
                                                    <TableHead className="text-right">Sold</TableHead>
                                                    <TableHead className="text-right">Age (Days)</TableHead>
                                                    <TableHead className="text-right">Weight (kg)</TableHead>
                                                    <TableHead className="text-right">Feed (Bags)</TableHead>
                                                    <TableHead className="text-right">Survival %</TableHead>
                                                    <TableHead className="text-right">EPI</TableHead>
                                                    <TableHead className="text-right">FCR</TableHead>
                                                    <TableHead className="text-right">Price (৳/kg)</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {performanceData.monthlyData.map((month) => (
                                                    <TableRow key={month.monthNumber} className={month.chicksSold === 0 ? "opacity-50" : ""}>
                                                        <TableCell className="font-medium">{month.month}</TableCell>
                                                        <TableCell className="text-right">{month.chicksIn > 0 ? formatNumber(month.chicksIn) : "-"}</TableCell>
                                                        <TableCell className="text-right">{month.chicksSold > 0 ? formatNumber(month.chicksSold) : "-"}</TableCell>
                                                        <TableCell className="text-right">{month.averageAge > 0 ? formatDecimal(month.averageAge, 0) : "-"}</TableCell>
                                                        <TableCell className="text-right">{month.totalBirdWeight > 0 ? formatNumber(month.totalBirdWeight) : "-"}</TableCell>
                                                        <TableCell className="text-right">{month.feedConsumption > 0 ? formatNumber(month.feedConsumption) : "-"}</TableCell>
                                                        <TableCell className="text-right">{month.survivalRate > 0 ? formatDecimal(month.survivalRate, 1) + "%" : "-"}</TableCell>
                                                        <TableCell className="text-right">{month.epi > 0 ? formatNumber(month.epi) : "-"}</TableCell>
                                                        <TableCell className="text-right">{month.fcr > 0 ? formatDecimal(month.fcr) : "-"}</TableCell>
                                                        <TableCell className="text-right">{month.averagePrice > 0 ? formatDecimal(month.averagePrice) : "-"}</TableCell>
                                                    </TableRow>
                                                ))}

                                                {/* Summary Row */}
                                                <TableRow className="bg-muted/50 font-semibold">
                                                    <TableCell>TOTAL/AVG</TableCell>
                                                    <TableCell className="text-right">{formatNumber(performanceData.totalChicksIn)}</TableCell>
                                                    <TableCell className="text-right">{formatNumber(performanceData.totalChicksSold)}</TableCell>
                                                    <TableCell className="text-right">-</TableCell>
                                                    <TableCell className="text-right">-</TableCell>
                                                    <TableCell className="text-right">-</TableCell>
                                                    <TableCell className="text-right">{formatDecimal(performanceData.averageSurvivalRate, 1)}%</TableCell>
                                                    <TableCell className="text-right">{formatNumber(performanceData.averageEPI)}</TableCell>
                                                    <TableCell className="text-right">{formatDecimal(performanceData.averageFCR)}</TableCell>
                                                    <TableCell className="text-right">-</TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                )
                            )}
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
