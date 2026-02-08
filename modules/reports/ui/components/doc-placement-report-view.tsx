"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { format } from "date-fns";
import { ChevronDown, ChevronRight, FileSpreadsheet, Filter } from "lucide-react";
import { useState } from "react";

interface DocPlacementReportViewProps {
    isManagement?: boolean;
    orgId?: string;
}

export function DocPlacementReportView({ isManagement = false, orgId }: DocPlacementReportViewProps) {
    const trpc = useTRPC();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [selectedOfficerId, setSelectedOfficerId] = useState<string>("");
    const [expandedFarmerId, setExpandedFarmerId] = useState<string | null>(null);

    // Fetch Officers (Management Only)
    const { data: officers } = useQuery(
        trpc.management.officers.getAll.queryOptions(
            { orgId: orgId! },
            { enabled: isManagement && !!orgId }
        )
    );

    // Fetch Report Data
    // We conditionally use the correct query based on role
    const officerQueryOptions = trpc.officer.reports.getMonthlyDocPlacements.queryOptions(
        { month, year },
        { enabled: !isManagement }
    );

    const managementQueryOptions = trpc.management.reports.getMonthlyDocPlacements.queryOptions(
        { month, year, orgId: orgId!, officerId: selectedOfficerId },
        { enabled: isManagement && !!selectedOfficerId && !!orgId }
    );

    const { data, isLoading } = useQuery(
        isManagement ? managementQueryOptions : officerQueryOptions
    );

    const reportData = data;

    const toggleExpand = (farmerId: string) => {
        setExpandedFarmerId(expandedFarmerId === farmerId ? null : farmerId);
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i); // Last 5 years

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-end justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">DOC Placement Report</h2>
                    <p className="text-muted-foreground">
                        Month-wise breakdown of Day Old Chick placements.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <Card>
                <CardHeader className="pb-4">
                    <CardTitle className="text-base font-medium flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Report Filters
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Officer Selector (Management Only) */}
                    {isManagement && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Select Officer</label>
                            <Select value={selectedOfficerId} onValueChange={setSelectedOfficerId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select an officer" />
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

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Month</label>
                        <Select value={month.toString()} onValueChange={(v) => setMonth(Number(v))}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map((m, i) => (
                                    <SelectItem key={i + 1} value={(i + 1).toString()}>
                                        {m}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Year</label>
                        <Select value={year.toString()} onValueChange={(v) => setYear(Number(v))}>
                            <SelectTrigger>
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

                    <div className="space-y-2 flex items-end">

                    </div>
                </CardContent>
            </Card>

            {/* Report Content */}
            {isLoading ? (
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-24 bg-muted/20 rounded-xl animate-pulse" />
                    ))}
                </div>
            ) : !reportData ? (
                isManagement && !selectedOfficerId ? (
                    <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-muted/50">
                        <div className="mx-auto h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                            <Filter className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">Select an Officer</h3>
                        <p className="text-muted-foreground mt-1">
                            Please select an officer to generate the report.
                        </p>
                    </div>
                ) : (
                    <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-muted/50">
                        <div className="mx-auto h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                            <FileSpreadsheet className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No Data Found</h3>
                        <p className="text-muted-foreground mt-1">
                            No DOC placements found for {months[month - 1]} {year}.
                        </p>
                    </div>
                )
            ) : (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total DOC Placed</CardTitle>
                                <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{reportData.summary.totalDoc.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">
                                    in {months[month - 1]} {year}
                                </p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Farmers Restocked</CardTitle>
                                <div className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{reportData.summary.farmerCount}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Batches</CardTitle>
                                <div className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{reportData.summary.cycleCount}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Detailed List */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Farmer Breakdown</CardTitle>
                            <CardDescription>
                                List of farmers who received DOCs in {months[month - 1]} {year}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {reportData.farmers.map((farmer) => (
                                    <div key={farmer.farmerName} className="border rounded-lg overflow-hidden">
                                        <div
                                            className="p-4 flex items-center justify-between bg-muted/5 cursor-pointer hover:bg-muted/10 transition-colors"
                                            onClick={() => toggleExpand(farmer.farmerName)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                                    {expandedFarmerId === farmer.farmerName ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold">{farmer.farmerName}</h3>
                                                    <p className="text-sm text-muted-foreground">{farmer.cycles.length} Batches</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <Badge variant="secondary" className="text-sm font-mono">
                                                    {farmer.totalDoc.toLocaleString()} DOC
                                                </Badge>
                                            </div>
                                        </div>

                                        {expandedFarmerId === farmer.farmerName && (
                                            <div className="border-t bg-card animate-in slide-in-from-top-1">
                                                <Table>
                                                    <TableHeader>
                                                        <TableRow>
                                                            <TableHead>Batch Name</TableHead>
                                                            <TableHead>Date</TableHead>
                                                            <TableHead>Status</TableHead>
                                                            <TableHead className="text-right">DOC</TableHead>
                                                        </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                        {farmer.cycles.map((cycle, idx) => (
                                                            <TableRow key={idx}>
                                                                <TableCell className="font-medium">{cycle.name}</TableCell>
                                                                <TableCell>{format(new Date(cycle.date), 'dd/MM/yyyy')}</TableCell>
                                                                <TableCell>
                                                                    <Badge variant="outline" className="text-xs uppercase">
                                                                        {cycle.status}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono">
                                                                    {cycle.doc.toLocaleString()}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
