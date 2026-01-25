"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, Bird, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export const OrgCyclesList = ({ orgId }: { orgId: string }) => {
    const trpc = useTRPC();
    const [search, setSearch] = useState("");

    const { data: cycles, isLoading } = useQuery(
        trpc.admin.getOrgCycles.queryOptions({ orgId })
    );

    const filteredCycles = cycles?.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.farmerName.toLowerCase().includes(search.toLowerCase())
    );

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
                    placeholder="Search cycles or farmers..."
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {!filteredCycles || filteredCycles.length === 0 ? (
                <div className="text-center p-8 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed">
                    No active production cycles found.
                </div>
            ) : (
                <>
                    {/* Desktop Table */}
                    <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                        <Table>
                            <TableHeader className="bg-slate-50/50">
                                <TableRow>
                                    <TableHead className="font-semibold px-6">Cycle Name</TableHead>
                                    <TableHead className="font-semibold">Farmer</TableHead>
                                    <TableHead className="font-semibold">Status</TableHead>
                                    <TableHead className="font-semibold">Age</TableHead>
                                    <TableHead className="font-semibold">Birds (DOC)</TableHead>
                                    <TableHead className="font-semibold">Started</TableHead>
                                    <TableHead className="w-[50px] px-6"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredCycles.map((cycle) => (
                                    <TableRow key={cycle.id} className="hover:bg-slate-50/50 group transition-colors">
                                        <TableCell className="font-bold text-slate-900 px-6">{cycle.name}</TableCell>
                                        <TableCell className="text-slate-600 font-medium">{cycle.farmerName}</TableCell>
                                        <TableCell>
                                            <Badge className="bg-violet-100 text-violet-700 hover:bg-violet-100 border-none font-bold text-[10px] uppercase tracking-wider">Active</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 font-bold text-slate-700">
                                                {cycle.age} <span className="text-[10px] text-slate-400 font-normal lowercase">days</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                                                <Bird className="h-4 w-4 text-violet-400/60" />
                                                {cycle.doc}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-slate-400 text-[11px] font-medium">
                                            {format(new Date(cycle.createdAt), "MMM d, yyyy")}
                                        </TableCell>
                                        <TableCell className="px-6">
                                            <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                                <Link href={`/cycles/${cycle.id}`}>
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
                        {filteredCycles.map((cycle) => (
                            <Link href={`/cycles/${cycle.id}`} key={cycle.id} className="block">
                                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm active:scale-[0.98] transition-transform">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="space-y-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="font-bold text-slate-900">{cycle.name}</h3>
                                                <Badge className="bg-violet-100 text-violet-700 border-none font-bold text-[8px] h-4">ACTIVE</Badge>
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-medium">Farmer: <span className="text-slate-900 font-bold">{cycle.farmerName}</span></p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-50">
                                        <div className="space-y-1">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">Age</span>
                                            <p className="text-sm font-bold text-slate-900">{cycle.age} <small className="text-[10px] font-normal">days old</small></p>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight">DOC Count</span>
                                            <div className="flex items-center gap-1 justify-end">
                                                <Bird className="h-3.5 w-3.5 text-slate-400" />
                                                <p className="text-sm font-bold text-slate-900">{cycle.doc.toLocaleString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-2 flex justify-between items-center text-[10px] text-slate-400">
                                        <span className="font-medium">Started {format(new Date(cycle.createdAt), "MMM d, yyyy")}</span>
                                        <span className="flex items-center gap-1 text-primary hover:text-primary/80 font-bold">
                                            View Details <ArrowRight className="h-3 w-3" />
                                        </span>
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
