"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    ArrowRight,
    Bird,
    Calendar,
    ChevronRight,
    Loader2,
    Search,
    Users,
    Wheat
} from "lucide-react";
import Link from "next/link"; // Assuming Next.js navigation
import { useState } from "react";

// --- Mobile Farmer Card Component ---
const MobileFarmerCard = ({ farmer }: { farmer: any }) => (
    <Card className="border-slate-200 shadow-sm overflow-hidden active:bg-slate-50 transition-colors">
        <CardContent className="p-4 space-y-4">
            {/* Header section with Name & Badge */}
            <div className="flex justify-between items-start">
                <div className="flex flex-col gap-1">
                    <Link href={`/farmers/${farmer.id}/history`} className="group flex items-center gap-1.5 focus:outline-none">
                        <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors underline decoration-slate-200 underline-offset-4">{farmer.name}</h3>
                        <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                    </Link>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Joined {format(new Date(farmer.createdAt), "MMM d, yyyy")}
                    </div>
                </div>

                {farmer.activeCyclesCount > 0 ? (
                    <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-[10px] px-2 py-0 h-5 shadow-sm">Active</Badge>
                ) : (
                    <Badge variant="secondary" className="text-[10px] px-2 py-0 h-5">Idle</Badge>
                )}
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 gap-3 py-1">
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                        <Bird className="h-3.5 w-3.5" /> Production
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-slate-900 leading-none">{farmer.activeCyclesCount}</span>
                        <span className="text-[10px] text-slate-500 font-medium lowercase">Active Cycles</span>
                    </div>
                </div>

                <div className="bg-amber-50/50 p-2.5 rounded-xl border border-amber-100 flex flex-col gap-1">
                    <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                        <Wheat className="h-3.5 w-3.5" /> Feed Stock
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-lg font-black text-amber-900 leading-none">{farmer.mainStock.toFixed(1)}</span>
                        <span className="text-[10px] text-amber-700/70 font-medium">bags</span>
                    </div>
                </div>
            </div>

            {/* View Details Button */}
            <Button variant="outline" className="w-full text-xs font-semibold h-9 rounded-lg border-slate-200 text-slate-600 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all group" asChild>
                <Link href={`/farmers/${farmer.id}/history`}>
                    View History & Details
                    <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
            </Button>
        </CardContent>
    </Card>
);

export const FarmersListView = () => {
    const { orgId } = useCurrentOrg();
    const trpc = useTRPC();

    // Local state for search
    const [searchTerm, setSearchTerm] = useState("");
    // Debounce search to avoid spamming the API (optional but recommended)
    // If you don't have a debounce hook, just pass searchTerm directly for now.
    const debouncedSearch = searchTerm;

    const { data, isLoading } = useQuery(
        trpc.farmers.getMany.queryOptions({
            orgId: orgId!,
            search: debouncedSearch,
            pageSize: 50, // Fetch a good amount for the list
        }, { enabled: !!orgId })
    );

    return (
        <div className="space-y-6 w-full max-w-6xl mx-auto p-4 md:p-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Farmers Directory</h1>
                    <p className="text-muted-foreground">Manage and monitor all farmers in your organization.</p>
                </div>
                {/* Search Bar */}
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search name or phone..."
                        className="pl-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Farmers Table Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5 text-muted-foreground" />
                                All Farmers
                            </CardTitle>
                            <CardDescription>
                                Total Registered: {data?.total || 0}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Desktop View: Table */}
                    <div className="hidden md:block rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="h-9 sm:h-11 text-[10px] sm:text-[11px] px-4">Farmer Name</TableHead>
                                    <TableHead className="h-9 sm:h-11 text-[10px] sm:text-[11px] px-4">Status</TableHead>
                                    <TableHead className="h-9 sm:h-11 text-[10px] sm:text-[11px] px-4">Active Cycles</TableHead>
                                    <TableHead className="h-9 sm:h-11 text-[10px] sm:text-[11px] px-4">Current Stock</TableHead>
                                    <TableHead className="text-right h-9 sm:h-11 text-[10px] sm:text-[11px] px-4">Joined</TableHead>
                                    <TableHead className="w-[50px] h-9 sm:h-11 text-[10px] sm:text-[11px] px-4"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-24 text-center">
                                            <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                <Loader2 className="h-4 w-4 animate-spin" /> Loading farmers...
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : data?.items.map((farmer) => (
                                    <TableRow key={farmer.id} className="group">
                                        {/* Name & Phone */}
                                        <TableCell className="px-4 py-3 text-xs sm:text-sm">
                                            <div className="font-medium">{farmer.name}</div>

                                        </TableCell>

                                        {/* Status (derived logic) */}
                                        <TableCell className="px-4 py-3">
                                            {farmer.activeCyclesCount > 0 ? (
                                                <Badge variant="default" className="bg-emerald-600 hover:bg-emerald-600 text-[10px] px-2 py-0">Active</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[10px] px-2 py-0">Idle</Badge>
                                            )}
                                        </TableCell>

                                        {/* Active Cycles Count */}
                                        <TableCell className="px-4 py-3 text-xs sm:text-sm">
                                            <div className="flex items-center gap-1.5">
                                                <Bird className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-medium">{farmer.activeCyclesCount}</span>
                                                <span className="text-[10px] text-muted-foreground">cycles</span>
                                            </div>
                                        </TableCell>

                                        {/* Main Warehouse Stock */}
                                        <TableCell className="px-4 py-3 text-xs sm:text-sm">
                                            <div className="flex items-center gap-1.5">
                                                <Wheat className="h-4 w-4 text-muted-foreground" />
                                                <span className="font-mono font-medium">{farmer.mainStock.toFixed(1)}</span>
                                                <span className="text-[10px] text-muted-foreground">bags</span>
                                            </div>
                                        </TableCell>

                                        {/* Joined Date */}
                                        <TableCell className="text-right text-muted-foreground text-[10px] sm:text-sm px-4 py-3">
                                            {format(new Date(farmer.createdAt), "MMM d, yyyy")}
                                        </TableCell>

                                        {/* Action: Link to History View */}
                                        <TableCell>
                                            <Button size="icon" variant="ghost" asChild>
                                                {/* Update this HREF to match your routing structure */}
                                                <Link href={`/farmers/${farmer.id}/history`}>
                                                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}

                                {!isLoading && data?.items.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                            No farmers found matching "{searchTerm}".
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile View: Cards */}
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="text-sm font-medium">Loading directory...</span>
                            </div>
                        ) : data?.items.map((farmer) => (
                            <MobileFarmerCard key={farmer.id} farmer={farmer} />
                        ))}

                        {!isLoading && data?.items.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-12 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 text-slate-400">
                                <Search className="h-8 w-8 opacity-20 mb-2" />
                                <p className="text-sm font-medium">No results for "{searchTerm}"</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};