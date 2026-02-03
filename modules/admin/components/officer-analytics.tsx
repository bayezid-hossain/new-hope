"use client";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
            {/* Header / Summary Section */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-5">
                {[
                    { label: "Total Officers", value: totalOfficers, icon: User, color: "text-primary", bg: "bg-card" },
                    { label: "Active Cycles", value: totalActiveCycles, icon: Bird, color: "text-primary", bg: "bg-card" },
                    { label: "Active Bird Capacity", value: totalActiveBirds.toLocaleString(), icon: Bird, color: "text-blue-500", bg: "bg-card" },
                    { label: "Active Feed Usage", value: `${totalActiveFeed.toLocaleString()} bags`, icon: Wheat, color: "text-amber-500", bg: "bg-card" },
                ].map((item, idx) => (
                    <Card key={idx} className={cn("col-span-1 border-border/50 bg-card overflow-hidden relative group transition-all duration-300 hover:shadow-md")}>
                        <div className="absolute top-0 left-0 w-1 h-full bg-primary/20 group-hover:bg-primary transition-colors" />
                        <CardContent className="p-5 flex flex-col gap-2">
                            <span className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-[0.15em]">{item.label}</span>
                            <div className="flex items-center gap-3">
                                <item.icon className={cn("h-4 w-4", item.color)} />
                                <span className="text-2xl font-black text-foreground tracking-tighter">{item.value}</span>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                <Card className="col-span-2 lg:col-span-1 border-primary/20 bg-primary/5 dark:bg-primary/10 relative overflow-hidden group shadow-lg shadow-primary/5">
                    <div className="absolute top-0 right-0 p-2 opacity-5 pointer-events-none transition-transform group-hover:scale-110">
                        <Wheat className="h-16 w-16 text-primary" />
                    </div>
                    <CardContent className="p-5 flex flex-col gap-2">
                        <span className="text-[10px] uppercase font-black text-primary/70 tracking-[0.15em]">Main Feed Stock</span>
                        <div className="flex items-center gap-3">
                            <Wheat className="h-4 w-4 text-primary" />
                            <span className="text-2xl font-black text-primary tracking-tighter">
                                {totalMainStock.toLocaleString()} <span className="text-[10px] font-bold uppercase ml-1 opacity-70">bags</span>
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6 pt-6">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div className="flex items-baseline gap-3">
                        <h2 className="text-xl font-black text-foreground uppercase tracking-tight">Personnel Directory</h2>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black text-[10px] h-5 px-2">
                            {analytics?.length || 0} TOTAL
                        </Badge>
                    </div>
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-primary/50" />
                        <Input
                            placeholder="Identify by name or email..."
                            className="pl-11 h-12 bg-card border-border/50 shadow-sm focus-visible:ring-primary/20 transition-all rounded-2xl font-medium"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Desktop View */}
                <div className="hidden md:block rounded-[2rem] border border-border/50 overflow-hidden bg-card shadow-xl shadow-foreground/5">
                    <Table>
                        <TableHeader className="bg-muted/30 border-b border-border/50">
                            <TableRow className="hover:bg-transparent border-none">
                                <TableHead className="font-black px-8 py-6 text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Officer Personnel</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Farmers</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Cycles</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Active Capacity</TableHead>
                                <TableHead className="font-black text-[10px] uppercase tracking-[0.15em] text-muted-foreground text-right px-8">Operational Performance</TableHead>
                                <TableHead className="w-[80px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered?.map((officer) => (
                                <TableRow
                                    key={officer.officerId}
                                    className="hover:bg-muted/30 cursor-pointer transition-colors group border-border/10"
                                    onClick={() => window.location.href = isManagement ? `/management/officers/${officer.officerId}` : `/admin/organizations/${orgId}/officers/${officer.officerId}`}
                                >
                                    <TableCell className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:rotate-6 transition-all duration-300 shadow-inner border border-border/50">
                                                <User className="h-5 w-5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-foreground tracking-tight text-base uppercase">{officer.name}</span>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest leading-none ring-1 ring-border/50 px-2 py-0.5 rounded-full">{officer.role}</span>
                                                    <span className="text-[10px] font-bold text-primary uppercase bg-primary/5 px-2 py-0.5 rounded-full ring-1 ring-primary/10">Active System</span>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-black text-foreground tracking-tighter text-lg">{officer.farmersCount}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 font-black text-foreground text-base tracking-tighter">
                                                {officer.activeCycles} <span className="text-[10px] text-primary uppercase font-black opacity-60">Live</span>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{officer.pastCycles} Past History</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-2 font-black text-foreground text-base tracking-tighter">
                                                <Bird className="h-4 w-4 text-primary/40" />
                                                {officer.activeDoc.toLocaleString()}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <Wheat className="h-3 w-3 text-amber-500/50" />
                                                <span className="text-[10px] text-muted-foreground font-bold uppercase">{(officer.totalMainStock || 0).toLocaleString()} Bags</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-8 text-right">
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-destructive font-mono uppercase">{officer.activeMortality} Loss</span>
                                                <Badge variant="outline" className={cn(
                                                    "text-[10px] border-none font-black px-3 py-1 rounded-full",
                                                    (officer.activeDoc > 0 ? (officer.activeMortality / officer.activeDoc) : 0) > 0.05
                                                        ? "bg-destructive/10 text-destructive"
                                                        : "bg-primary/10 text-primary"
                                                )}>
                                                    {officer.activeDoc > 0 ? ((officer.activeMortality / officer.activeDoc) * 100).toFixed(2) : 0}%
                                                </Badge>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Wheat className="h-3 w-3 text-muted-foreground/30" />
                                                <span className="text-[10px] text-muted-foreground/60 font-black uppercase tracking-widest">{officer.activeIntake.toFixed(2)} Bags consumption</span>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="px-8">
                                        <div className="h-10 w-10 rounded-full border border-border/50 flex items-center justify-center group-hover:border-primary/50 group-hover:bg-primary/5 transition-all">
                                            <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>

                {/* Mobile View: Cards */}
                <div className="md:hidden space-y-5">
                    {filtered?.map((officer) => (
                        <Link
                            key={officer.officerId}
                            href={isManagement ? `/management/officers/${officer.officerId}` : `/admin/organizations/${orgId}/officers/${officer.officerId}`}
                            className="block group"
                        >
                            <Card className="border-border/50 shadow-sm overflow-hidden bg-card active:scale-[0.98] transition-all rounded-[2rem] group-hover:border-primary/30 group-hover:shadow-lg">
                                <div className="p-5 space-y-5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center text-muted-foreground shadow-inner border border-border/50">
                                                <User className="h-6 w-6 text-muted-foreground/50" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-black text-foreground text-base uppercase tracking-tight group-hover:text-primary transition-colors">{officer.name}</span>
                                                <div className="flex gap-2 items-center mt-0.5">
                                                    <span className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">{officer.role}</span>
                                                    <span className="text-muted-foreground/30 text-[10px]">•</span>
                                                    <span className="text-[10px] text-primary font-black uppercase tracking-tight">{officer.farmersCount} Farmers</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="h-8 w-8 rounded-full border border-border/50 flex items-center justify-center group-hover:bg-primary/5 transition-all">
                                            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-6 bg-muted/20 p-4 rounded-2xl border border-border/30">
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest leading-none">Main Stock</p>
                                            <div className="flex items-center gap-2">
                                                <Wheat className="h-3.5 w-3.5 text-amber-500/60" />
                                                <p className="text-sm font-black text-foreground tracking-tighter">{(officer.totalMainStock || 0).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">Bags</span></p>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 text-right">
                                            <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest leading-none">Cycles (A/P)</p>
                                            <p className="text-sm font-black text-foreground tracking-tighter"><span className="text-primary">{officer.activeCycles}</span> <span className="mx-0.5 opacity-20">/</span> {officer.pastCycles}</p>
                                        </div>
                                        <div className="space-y-1.5">
                                            <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest leading-none">Active Birds</p>
                                            <div className="flex items-center gap-2 text-sm font-black text-foreground tracking-tighter">
                                                <Bird className="h-3.5 w-3.5 text-primary/40" />
                                                {officer.activeDoc.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 text-right">
                                            <p className="text-[10px] text-muted-foreground/60 uppercase font-black tracking-widest leading-none">Active Feed</p>
                                            <div className="flex items-center gap-2 justify-end text-sm font-black text-foreground tracking-tighter">
                                                <Wheat className="h-3.5 w-3.5 text-muted-foreground/30" />
                                                {officer.activeIntake.toFixed(1)} <span className="text-[10px] font-normal text-muted-foreground">Bags</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center py-1">
                                        <div className="flex items-center gap-2.5">
                                            <div className="h-8 w-8 rounded-xl bg-destructive/5 flex items-center justify-center">
                                                <TrendingDown className="h-4 w-4 text-destructive/70" />
                                            </div>
                                            <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-wide">Operational Loss</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-base font-black text-destructive tracking-tighter">{officer.activeMortality}</span>
                                            <Badge variant="outline" className={cn(
                                                "text-[10px] border-none font-black px-2.5 py-1 rounded-full",
                                                (officer.activeDoc > 0 ? (officer.activeMortality / officer.activeDoc) : 0) > 0.05
                                                    ? "bg-destructive/10 text-destructive"
                                                    : "bg-primary/10 text-primary"
                                            )}>
                                                {officer.activeDoc > 0 ? ((officer.activeMortality / officer.activeDoc) * 100).toFixed(2) : 0}%
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}
                </div>

                {filtered?.length === 0 && (
                    <div className="text-center py-12 bg-card rounded-xl border-2 border-dashed border-border">
                        <User className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
                        <p className="text-muted-foreground text-sm italic">No officers found matching the search.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
