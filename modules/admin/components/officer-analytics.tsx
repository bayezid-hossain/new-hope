"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
    ArrowRight,
    Bird,
    Loader2,
    Search,
    TrendingDown,
    User,
    Wheat
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface OfficerAnalyticsProps {
    orgId: string;
    isManagement?: boolean;
}

export function OfficerAnalytics({ orgId, isManagement }: OfficerAnalyticsProps) {
    const trpc = useTRPC();
    const [search, setSearch] = useState("");

    const { data: analytics, isLoading } = useQuery(
        trpc.management.analytics.getOfficerAnalytics.queryOptions({ orgId })
    );

    const filtered = (analytics || []).filter(a =>
        (a.name || "").toLowerCase().includes(search.toLowerCase()) ||
        (a.email || "").toLowerCase().includes(search.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    const totalOfficers = filtered.length;
    const totalActiveCycles = filtered.reduce((acc, curr) => acc + curr.activeCycles, 0);
    const totalFarmers = filtered.reduce((acc, curr) => acc + curr.farmersCount, 0);
    const totalActiveFeed = filtered.reduce((acc, curr) => acc + curr.activeIntake, 0);
    const totalMainStock = filtered.reduce((acc, curr) => acc + (curr.totalMainStock || 0), 0);
    const totalActiveBirds = filtered.reduce((acc, curr) => acc + curr.activeDoc, 0);

    return (
        <div className="space-y-8">
            {/* Header / Summary Section */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <Card className="col-span-1 shadow-sm border-slate-200">
                    <CardContent className="p-4 flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Total Officers</span>
                        <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-violet-500" />
                            <span className="text-2xl font-bold text-slate-900">{totalOfficers}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-1 shadow-sm border-slate-200">
                    <CardContent className="p-4 flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Cycles</span>
                        <div className="flex items-center gap-2">
                            <Bird className="h-4 w-4 text-emerald-500" />
                            <span className="text-2xl font-bold text-slate-900">{totalActiveCycles}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-1 shadow-sm border-slate-200">
                    <CardContent className="p-4 flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Bird Capacity</span>
                        <div className="flex items-center gap-2">
                            <Bird className="h-4 w-4 text-blue-500" />
                            <span className="text-2xl font-bold text-slate-900">{totalActiveBirds.toLocaleString()}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-1 shadow-sm border-slate-200">
                    <CardContent className="p-4 flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Active Feed Usage</span>
                        <div className="flex items-center gap-2">
                            <Wheat className="h-4 w-4 text-amber-500" />
                            <span className="text-2xl font-bold text-slate-900">{totalActiveFeed.toLocaleString()} <span className="text-xs font-normal text-slate-400">bags</span></span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-2 lg:col-span-1 shadow-sm border-slate-200 bg-amber-50/50 border-amber-100">
                    <CardContent className="p-4 flex flex-col gap-1">
                        <span className="text-[10px] uppercase font-bold text-amber-600/70 tracking-wider">Total Main Stock</span>
                        <div className="flex items-center gap-2">
                            <Wheat className="h-4 w-4 text-amber-600" />
                            <span className="text-2xl font-bold text-amber-800">{totalMainStock.toLocaleString()} <span className="text-xs font-normal text-amber-600/70">bags</span></span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-slate-900">Officer List</h2>
                    <div className="relative w-full max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search officers..."
                            className="pl-9 h-9 text-sm"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Desktop View */}
                <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                    <Table>
                        <TableHeader className="bg-slate-50/50">
                            <TableRow>
                                <TableHead className="font-semibold px-6 py-4 text-xs uppercase tracking-wider text-slate-500">Officer</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Farmers</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Cycles (Active/Past)</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Active DOC</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Main Stock</TableHead>
                                <TableHead className="font-semibold text-xs uppercase tracking-wider text-slate-500">Active Feed</TableHead>
                                <TableHead className="font-semibold px-6 text-xs uppercase tracking-wider text-slate-500">Active Mort.</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered?.map((officer) => (
                                <TableRow
                                    key={officer.officerId}
                                    className="hover:bg-slate-50/50 cursor-pointer transition-colors group"
                                    onClick={() => window.location.href = isManagement ? `/management/officers/${officer.officerId}` : `/admin/organizations/${orgId}/officers/${officer.officerId}`}
                                >
                                    <TableCell className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                                                <User className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900 leading-tight">{officer.name}</span>
                                                <Badge variant="secondary" className="w-fit mt-1 text-[9px] px-1.5 py-0 h-4 bg-slate-100 text-slate-500 border-none font-bold uppercase tracking-widest">{officer.role}</Badge>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-700">{officer.farmersCount}</TableCell>
                                    <TableCell className="font-bold text-slate-700">
                                        <div className="flex items-center gap-1">
                                            <span className="text-emerald-600">{officer.activeCycles}</span>
                                            <span className="text-slate-300">/</span>
                                            <span className="text-slate-500">{officer.pastCycles}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                            <Bird className="h-3.5 w-3.5 text-primary/40" />
                                            {officer.activeDoc.toLocaleString()}
                                            {officer.pastDoc > 0 && <span className="text-[9px] text-slate-400 font-normal ml-1">({officer.pastDoc.toLocaleString()} past)</span>}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                            <Wheat className="h-3.5 w-3.5 text-amber-500/60" />
                                            {(officer.totalMainStock || 0).toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">bags</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                            <Wheat className="h-3.5 w-3.5 text-slate-400" />
                                            {officer.activeIntake.toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">bags</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-red-600 font-mono">{officer.activeMortality}</span>
                                            <Badge variant="secondary" className={`text-[10px] border-none font-bold ${(officer.activeDoc > 0 ? (officer.activeMortality / officer.activeDoc) : 0) > 0.05
                                                ? "bg-red-100 text-red-700"
                                                : "bg-emerald-50 text-emerald-600"
                                                }`}>
                                                {officer.activeDoc > 0 ? ((officer.activeMortality / officer.activeDoc) * 100).toFixed(2) : 0}%
                                            </Badge>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-6">
                                        <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowRight className="h-4 w-4 text-slate-400" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile View: Cards */}
                <div className="md:hidden space-y-4">
                    {filtered?.map((officer) => (
                        <Link
                            key={officer.officerId}
                            href={isManagement ? `/management/officers/${officer.officerId}` : `/admin/organizations/${orgId}/officers/${officer.officerId}`}
                            className="block group"
                        >
                            <Card className="border-slate-200 shadow-sm overflow-hidden bg-white active:scale-[0.98] transition-all group-hover:border-primary/30 group-hover:shadow-md">
                                <CardHeader className="bg-slate-50/50 py-3 flex flex-row items-center justify-between border-b px-4">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-sm">
                                            <User className="h-5 w-5 text-slate-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 text-sm group-hover:text-primary transition-colors">{officer.name}</span>
                                            <div className="flex gap-2 items-center">
                                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{officer.role}</span>
                                                <span className="text-[10px] text-slate-300">•</span>
                                                <span className="text-[10px] text-slate-500 font-medium">{officer.farmersCount} Farmers</span>
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                </CardHeader>
                                <CardContent className="p-4 space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Main Stock</p>
                                            <div className="flex items-center gap-1.5">
                                                <Wheat className="h-3.5 w-3.5 text-amber-500" />
                                                <p className="text-sm font-bold text-slate-900">{(officer.totalMainStock || 0).toLocaleString()}</p>
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cycles (A/P)</p>
                                            <p className="text-sm font-bold text-slate-900"><span className="text-emerald-600">{officer.activeCycles}</span> / {officer.pastCycles}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Birds</p>
                                            <div className="flex items-center gap-1 text-sm font-bold text-slate-900">
                                                <Bird className="h-3.5 w-3.5 text-slate-400" />
                                                {officer.activeDoc.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Feed</p>
                                            <div className="flex items-center gap-1 justify-end text-sm font-bold text-slate-900">
                                                <Wheat className="h-3.5 w-3.5 text-slate-400" />
                                                {officer.activeIntake.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">bags</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t flex justify-between items-center bg-slate-50/30 -mx-4 -mb-4 px-4 py-3 mt-2">
                                        <div className="flex items-center gap-2">
                                            <TrendingDown className="h-4 w-4 text-red-500" />
                                            <span className="text-xs text-slate-500 font-medium">Mortality Records</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-red-600">{officer.activeMortality}</span>
                                            <Badge variant="secondary" className={`text-[10px] border-none font-bold ${(officer.activeDoc > 0 ? (officer.activeMortality / officer.activeDoc) : 0) > 0.05
                                                ? "bg-red-100 text-red-700"
                                                : "bg-emerald-50 text-emerald-600"
                                                }`}>
                                                {officer.activeDoc > 0 ? ((officer.activeMortality / officer.activeDoc) * 100).toFixed(2) : 0}%
                                            </Badge>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>

                {filtered?.length === 0 && (
                    <div className="text-center py-12 bg-white rounded-xl border-2 border-dashed border-slate-200">
                        <User className="h-10 w-10 mx-auto text-slate-200 mb-3" />
                        <p className="text-slate-400 text-sm italic">No officers found matching the search.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
