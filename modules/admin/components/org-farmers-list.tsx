"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, Archive, ArrowRight, Bird, Loader2, Search, Wheat } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface OrgFarmersListProps {
    orgId: string;
    isManagement?: boolean;
    isAdmin?: boolean;
}

export const OrgFarmersList = ({ orgId, isManagement, isAdmin }: OrgFarmersListProps) => {
    const trpc = useTRPC();
    const [search, setSearch] = useState("");

    const { data: farmers, isLoading } = useQuery(
        trpc.admin.getOrgFarmers.queryOptions({ orgId })
    );

    const filteredFarmers = farmers?.filter(f =>
        f.name.toLowerCase().includes(search.toLowerCase())
    );

    const getFarmerLink = (farmerId: string) => {
        if (isAdmin) return `/admin/farmers/${farmerId}`;
        if (isManagement) return `/management/farmers/${farmerId}`;
        return `/farmers/${farmerId}`;
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Search farmers..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {!filteredFarmers || filteredFarmers.length === 0 ? (
                <div className="text-center p-8 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed">
                    No farmers found.
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="font-semibold px-6">Farmer Name</TableHead>
                                    <TableHead className="font-semibold">Status</TableHead>
                                    <TableHead className="font-semibold">Cycles</TableHead>
                                    <TableHead className="font-semibold">Stock</TableHead>
                                    <TableHead className="font-semibold">Joined</TableHead>
                                    <TableHead className="w-[50px] px-6"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredFarmers.map((farmer) => (
                                    <TableRow key={farmer.id} className="hover:bg-slate-50/50 group transition-colors">
                                        <TableCell className="font-bold text-slate-900 px-6">{farmer.name}</TableCell>
                                        <TableCell>
                                            {farmer.activeCyclesCount > 0 ? (
                                                <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold text-[10px] uppercase tracking-wider">Active</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none font-bold text-[10px] uppercase tracking-wider">Idle</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-xs">
                                                    <Activity className="h-3 w-3" />
                                                    {farmer.activeCyclesCount} Active
                                                </div>
                                                <div className="flex items-center gap-1.5 font-medium text-slate-400 text-[10px]">
                                                    <Archive className="h-3 w-3" />
                                                    {farmer.pastCyclesCount} Past
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                                <Wheat className="h-4 w-4 text-amber-400/60" />
                                                {farmer.mainStock.toFixed(1)} <span className="text-[10px] text-slate-400 font-normal">bags</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-400 text-[11px] font-medium">
                                            {format(new Date(farmer.createdAt), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="px-6">
                                            <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                                <Link href={getFarmerLink(farmer.id)}>
                                                    <ArrowRight className="h-4 w-4 text-slate-400" />
                                                </Link>
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                        {filteredFarmers.map((farmer) => (
                            <Link href={getFarmerLink(farmer.id)} key={farmer.id} className="block">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="space-y-0.5">
                                            <h3 className="font-bold text-slate-900">{farmer.name}</h3>
                                            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                                                Joined {format(new Date(farmer.createdAt), "MMM d, yyyy")}
                                            </p>
                                        </div>
                                        {farmer.activeCyclesCount > 0 ? (
                                            <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[9px]">ACTIVE</Badge>
                                        ) : (
                                            <Badge className="bg-slate-100 text-slate-500 border-none font-bold text-[9px]">IDLE</Badge>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                                                <Bird className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Production</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-emerald-600">{farmer.activeCyclesCount} Active</span>
                                                    <span className="text-slate-300">•</span>
                                                    <span className="text-xs font-medium text-slate-500">{farmer.pastCyclesCount} Past</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
                                                <Wheat className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Main Stock</span>
                                                <span className="text-sm font-bold text-slate-900">{farmer.mainStock.toFixed(1)} <small className="text-[10px] font-normal">bags</small></span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
