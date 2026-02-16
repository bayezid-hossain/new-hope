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
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import { ProUpgradeTeaser } from "@/modules/shared/components/pro-upgrade-teaser";
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
    const { isPro } = useCurrentOrg();
    const now = new Date();
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [year, setYear] = useState(now.getFullYear());
    const [selectedOfficerId, setSelectedOfficerId] = useState<string>("");
    const [expandedFarmerId, setExpandedFarmerId] = useState<string | null>(null);

    // Fetch Officers (Management Only)
    const { data: officers } = useQuery({
        ...trpc.management.officers.getAll.queryOptions(
            { orgId: orgId! }
        ),
        enabled: isManagement && !!orgId && isPro
    });

    // Fetch Report Data
    // We conditionally use the correct query based on role
    const officerQueryOptions = trpc.officer.reports.getMonthlyDocPlacements.queryOptions(
        { month, year }
    );

    const managementQueryOptions = trpc.management.reports.getMonthlyDocPlacements.queryOptions(
        { month, year, orgId: orgId!, officerId: selectedOfficerId }
    );

    const { data, isLoading } = useQuery({
        ...(isManagement ? managementQueryOptions : officerQueryOptions),
        enabled: isPro && (isManagement ? (!!selectedOfficerId && !!orgId) : true)
    });

    const reportData = data;

    // Summary data for mobile quick look
    const totalDoc = reportData?.summary.totalDoc || 0;
    const farmerCount = reportData?.summary.farmerCount || 0;
    const cycleCount = reportData?.summary.cycleCount || 0;

    const toggleExpand = (farmerId: string) => {
        setExpandedFarmerId(expandedFarmerId === farmerId ? null : farmerId);
    };

    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 5 }, (_, i) => currentYear - i); // Last 5 years

    if (!isPro) {
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

                <ProUpgradeTeaser
                    title="Placement Analytics Locked"
                    description="Monthly DOC placement reports and historical trends are available for Pro organizations."
                    className="py-24"
                />
            </div>
        );
    }

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
                                <CardTitle className="text-sm font-medium">Total Farmers</CardTitle>
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
                        <CardContent className="px-1">
                            <div className="space-y-4">
                                {reportData.farmers.map((farmer) => {
                                    const isSingleBatch = farmer.cycles.length === 1;
                                    const singleCycle = isSingleBatch ? farmer.cycles[0] : null;
                                    const isExpanded = expandedFarmerId === farmer.farmerName;

                                    return (
                                        <div key={farmer.farmerName} className="border-b border-muted/30 last:border-0 pb-1">
                                            <div
                                                className={cn(
                                                    "p-3 sm:p-4 flex items-center justify-between transition-colors",
                                                    !isSingleBatch ? "cursor-pointer hover:bg-muted/5" : ""
                                                )}
                                                onClick={() => !isSingleBatch && toggleExpand(farmer.farmerName)}
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className={cn(
                                                        "h-8 w-8 rounded-full flex items-center justify-center transition-colors shrink-0",
                                                        isExpanded ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary",
                                                        isSingleBatch && "opacity-50"
                                                    )}>
                                                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h3 className="font-semibold text-sm sm:text-base truncate">{farmer.farmerName}</h3>
                                                        {isSingleBatch && singleCycle ? (
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-tight">
                                                                    {format(new Date(singleCycle.date), 'dd MMM yyyy')}
                                                                </span>
                                                                <Badge variant="outline" className="text-[9px] uppercase h-4 px-1 leading-none border-muted-foreground/20 text-muted-foreground">
                                                                    {singleCycle.status}
                                                                </Badge>
                                                            </div>
                                                        ) : (
                                                            <p className="text-[10px] sm:text-xs text-muted-foreground uppercase font-bold tracking-wider">{farmer.cycles.length} Batches</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <Badge variant="secondary" className="text-xs sm:text-sm font-mono font-bold bg-primary/5 text-primary border-primary/10">
                                                        {farmer.totalDoc.toLocaleString()} DOC
                                                    </Badge>
                                                </div>
                                            </div>

                                            {!isSingleBatch && isExpanded && (
                                                <div className="bg-muted/5 animate-in slide-in-from-top-1 px-3 sm:px-4 pb-4">
                                                    {/* Mobile List View */}
                                                    <div className="sm:hidden divide-y divide-muted/30 border-t border-muted/30">
                                                        {farmer.cycles.map((cycle, idx) => (
                                                            <div key={idx} className="py-3 flex items-center justify-between">
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="text-[11px] font-bold text-muted-foreground/80">
                                                                        {format(new Date(cycle.date), 'dd MMM yyyy')}
                                                                    </span>
                                                                    <Badge variant="outline" className="text-[9px] uppercase h-4 px-1 w-fit border-muted-foreground/20 text-muted-foreground">
                                                                        {cycle.status}
                                                                    </Badge>
                                                                </div>
                                                                <span className="font-mono font-bold text-sm text-foreground">
                                                                    {cycle.doc.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">DOC</span>
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Desktop Table View */}
                                                    <div className="hidden sm:block border rounded-lg overflow-hidden bg-card">
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow className="bg-muted/30">
                                                                    <TableHead className="h-10 text-[10px] uppercase font-bold tracking-wider">Date</TableHead>
                                                                    <TableHead className="h-10 text-[10px] uppercase font-bold tracking-wider">Status</TableHead>
                                                                    <TableHead className="h-10 text-right text-[10px] uppercase font-bold tracking-wider">DOC</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {farmer.cycles.map((cycle, idx) => (
                                                                    <TableRow key={idx} className="hover:bg-muted/5 transition-colors">
                                                                        <TableCell className="py-3 text-sm">{format(new Date(cycle.date), 'dd/MM/yyyy')}</TableCell>
                                                                        <TableCell className="py-3">
                                                                            <Badge variant="outline" className="text-[10px] uppercase border-muted-foreground/20">
                                                                                {cycle.status}
                                                                            </Badge>
                                                                        </TableCell>
                                                                        <TableCell className="text-right py-3 font-mono font-bold">{cycle.doc.toLocaleString()}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                            </TableBody>
                                                        </Table>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}
        </div>
    );
}
