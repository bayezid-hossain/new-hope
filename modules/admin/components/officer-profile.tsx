"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, Archive, ArrowRight, Bird, ChevronLeft, Loader2, Mail, User, Wheat } from "lucide-react";
import Link from "next/link";

interface OfficerProfileProps {
    orgId: string;
    userId: string;
    backUrl: string;
    isAdminView?: boolean;
}

export const OfficerProfile = ({ orgId, userId, backUrl, isAdminView }: OfficerProfileProps) => {
    const trpc = useTRPC();

    const adminQuery = trpc.admin.officers.getDetails.queryOptions({ orgId, userId });
    const managementQuery = trpc.management.officers.getDetails.queryOptions({ orgId, userId });

    const queryOptions = isAdminView ? adminQuery : managementQuery;

    const { data: profile, isLoading } = useQuery(queryOptions);

    if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (!profile) return <div>Officer not found.</div>;

    const statsItems = [
        { label: "Active Cycles", value: profile.stats.activeCycles, icon: Bird, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Past Cycles", value: profile.stats.pastCycles, icon: Bird, color: "text-slate-600", bg: "bg-slate-50" },
        { label: "Total Birds", value: profile.stats.totalDoc.toLocaleString(), icon: Bird, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Acc. Feed", value: `${profile.stats.totalIntake.toFixed(1)} b`, icon: Wheat, color: "text-amber-600", bg: "bg-amber-50" },
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                    <Link href={backUrl}>
                        <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Link>
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-6">
                {/* Left Column: User Info & Stats */}
                <div className="w-full md:w-1/3 space-y-6">
                    <Card className="border-none shadow-sm overflow-hidden bg-white">
                        <div className="h-24 bg-gradient-to-r from-primary/10 to-primary/5" />
                        <CardContent className="px-6 -mt-12">
                            <div className="flex flex-col items-center text-center space-y-4">
                                <div className="h-24 w-24 rounded-full border-4 border-white bg-slate-100 flex items-center justify-center shadow-sm">
                                    <User className="h-12 w-12 text-slate-400" />
                                </div>
                                <div className="space-y-1">
                                    <h2 className="text-2xl font-bold text-slate-900">{profile.officer.name}</h2>
                                    <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-bold uppercase tracking-wider text-[10px]">
                                        {profile.role}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-slate-500 text-sm">
                                    <Mail className="h-4 w-4" />
                                    {profile.officer.email}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="grid grid-cols-2 gap-4">
                        {statsItems.map((item) => (
                            <Card key={item.label} className="border-none shadow-sm">
                                <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                                    <div className={`p-2 rounded-lg ${item.bg}`}>
                                        <item.icon className={`h-4 w-4 ${item.color}`} />
                                    </div>
                                    <span className="text-xl font-bold text-slate-900">{item.value}</span>
                                    <span className="text-[10px] text-slate-400 uppercase font-bold tracking-tight">{item.label}</span>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>

                {/* Right Column: Managed Farmers */}
                <div className="w-full md:w-2/3 space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h3 className="text-lg font-bold text-slate-900">Managed Farmers</h3>
                        <Badge variant="outline" className="text-slate-500">{profile.farmers.length} Total</Badge>
                    </div>

                    <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="font-semibold">Farmer Name</TableHead>
                                    <TableHead className="font-semibold">Status</TableHead>
                                    <TableHead className="font-semibold text-right">Cycles</TableHead>
                                    <TableHead className="font-semibold text-right">Stock</TableHead>
                                    <TableHead className="w-[50px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {profile.farmers.map((farmer) => (
                                    <TableRow key={farmer.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <TableCell className="font-bold text-slate-900">{farmer.name}</TableCell>
                                        <TableCell>
                                            {farmer.activeCyclesCount > 0 ? (
                                                <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px]">ACTIVE</Badge>
                                            ) : (
                                                <Badge className="bg-slate-100 text-slate-400 border-none font-bold text-[10px]">IDLE</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-xs">
                                                    <Activity className="h-3 w-3" />
                                                    {farmer.activeCyclesCount}
                                                </div>
                                                <div className="flex items-center gap-1.5 font-medium text-slate-400 text-[10px]">
                                                    <Archive className="h-3 w-3" />
                                                    {farmer.pastCyclesCount}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right font-bold text-slate-700">
                                            {farmer.mainStock.toFixed(1)} <small className="text-[10px] font-normal text-slate-400">bags</small>
                                        </TableCell>
                                        <TableCell>
                                            <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100" asChild>
                                                <Link href={isAdminView ? `/admin/organizations/${orgId}/farmers/${farmer.id}` : `/management/farmers/${farmer.id}`}>
                                                    <ArrowRight className="h-4 w-4" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="md:hidden space-y-3">
                        {profile.farmers.map((farmer) => (
                            <Link key={farmer.id} href={isAdminView ? `/admin/organizations/${orgId}/farmers/${farmer.id}` : `/management/farmers/${farmer.id}`}>
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-bold text-slate-900">{farmer.name}</h4>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-tight">{farmer.activeCyclesCount} Active</span>
                                            <span className="text-slate-300">•</span>
                                            <span className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">{farmer.pastCyclesCount} Past</span>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-4 w-4 text-slate-300" />
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
