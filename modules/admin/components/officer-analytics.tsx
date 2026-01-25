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
        trpc.management.getOfficerAnalytics.queryOptions({ orgId })
    );

    const filtered = analytics?.filter(a =>
        a.name.toLowerCase().includes(search.toLowerCase()) ||
        a.email.toLowerCase().includes(search.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Search officers..."
                    className="pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {/* Desktop View */}
            <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50/50">
                        <TableRow>
                            <TableHead className="font-semibold px-6">Officer</TableHead>
                            <TableHead className="font-semibold">Farmers</TableHead>
                            <TableHead className="font-semibold">Cycles (A/P)</TableHead>
                            <TableHead className="font-semibold">Total DOC</TableHead>
                            <TableHead className="font-semibold">Feed Usage</TableHead>
                            <TableHead className="font-semibold px-6">Mortality</TableHead>
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
                                        <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-primary group-hover:text-white transition-all">
                                            <User className="h-5 w-5" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-900 leading-tight">{officer.name}</span>
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{officer.role}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="font-bold text-slate-700">{officer.farmersCount}</TableCell>
                                <TableCell className="font-bold text-slate-700">{officer.activeCycles} / {officer.pastCycles}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                        <Bird className="h-4 w-4 text-primary/40" />
                                        {officer.totalDoc.toLocaleString()}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                        <Wheat className="h-4 w-4 text-amber-400/60" />
                                        {officer.totalIntake.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">bags</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-red-600 font-mono">{officer.totalMortality}</span>
                                        <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-600 border-none font-bold">
                                            {officer.totalDoc > 0 ? ((officer.totalMortality / officer.totalDoc) * 100).toFixed(1) : 0}%
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
                        className="block"
                    >
                        <Card className="border-slate-200 shadow-sm overflow-hidden bg-white active:scale-[0.98] transition-transform">
                            <CardHeader className="bg-slate-50/50 py-3 flex flex-row items-center justify-between border-b">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600">
                                        <User className="h-4 w-4" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900 text-sm">{officer.name}</span>
                                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight">{officer.role}</span>
                                    </div>
                                </div>
                                <ArrowRight className="h-4 w-4 text-slate-300" />
                            </CardHeader>
                            <CardContent className="p-4 space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Farmers</p>
                                        <p className="text-sm font-bold text-slate-900">{officer.farmersCount}</p>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Cycles (A/P)</p>
                                        <p className="text-sm font-bold text-slate-900">{officer.activeCycles} / {officer.pastCycles}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Birds (DOC)</p>
                                        <div className="flex items-center gap-1 text-sm font-bold text-slate-900">
                                            <Bird className="h-3.5 w-3.5 text-slate-400" />
                                            {officer.totalDoc.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="space-y-1 text-right">
                                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Feed Intake</p>
                                        <div className="flex items-center gap-1 justify-end text-sm font-bold text-slate-900">
                                            <Wheat className="h-3.5 w-3.5 text-slate-400" />
                                            {officer.totalIntake.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">bags</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 border-t flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <TrendingDown className="h-4 w-4 text-red-500" />
                                        <span className="text-xs text-slate-500 font-medium">Mortality Records</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-red-600">{officer.totalMortality}</span>
                                        <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-600 border-none font-bold">
                                            {officer.totalDoc > 0 ? ((officer.totalMortality / officer.totalDoc) * 100).toFixed(1) : 0}%
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
    );
}
