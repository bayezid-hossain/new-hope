"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
    Activity,
    Archive,
    ArrowRight,
    Bird,
    ChevronRight,
    Loader2,
    Mail,
    User,
    Wheat,
} from "lucide-react";
import Link from "next/link";

interface ProductionTreeProps {
    orgId: string;
    isAdmin?: boolean;
    isManagement?: boolean;
}

export const ProductionTree = ({
    orgId,
    isAdmin,
    isManagement,
}: ProductionTreeProps) => {
    const trpc = useTRPC();

    // Choose the router based on context
    const adminTree = trpc.admin.officers.getProductionTree.queryOptions({ orgId });
    const managementTree = trpc.management.officers.getProductionTree.queryOptions({ orgId });
    const queryOpts = isAdmin ? adminTree : managementTree;

    const { data: tree, isLoading } = useQuery(queryOpts);

    if (isLoading) {
        return (
            <div className="flex justify-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!tree || tree.length === 0) {
        return (
            <div className="text-center p-12 border-2 border-dashed rounded-3xl bg-slate-50 text-slate-400">
                No production data found for this organization.
            </div>
        );
    }

    const getFarmerLink = (id: string) =>
        isAdmin ? `/admin/organizations/${orgId}/farmers/${id}` : `/management/farmers/${id}`;

    const getOfficerLink = (userId: string) =>
        isAdmin
            ? `/admin/organizations/${orgId}/officers/${userId}`
            : `/management/officers/${userId}`;

    return (
        <div className="space-y-6">
            <Accordion type="multiple" className="space-y-4">
                {tree.map((officer) => (
                    <AccordionItem
                        key={officer.id}
                        value={officer.id}
                        className="border-none bg-white rounded-2xl shadow-sm overflow-hidden"
                    >
                        <AccordionTrigger className="hover:no-underline px-6 py-4 hover:bg-slate-50/50 transition-colors">
                            <div className="flex items-center gap-4 text-left">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors">
                                        {officer.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <Badge variant="outline" className="text-[9px] h-4 uppercase font-bold tracking-widest bg-slate-50 border-slate-200">
                                            {officer.role}
                                        </Badge>
                                        <span className="flex items-center gap-1">
                                            <Mail className="h-3 w-3" /> {officer.email}
                                        </span>
                                    </div>
                                </div>
                                <div className="ml-4 flex gap-3">
                                    <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-none font-bold text-[10px]">
                                        {officer.farmers.length} Farmers
                                    </Badge>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-2">
                            <div className="pl-6 border-l-2 border-slate-100 ml-5 space-y-4">
                                {officer.farmers.length === 0 ? (
                                    <p className="text-sm text-slate-400 italic py-2">No farmers assigned to this officer.</p>
                                ) : (
                                    <Accordion type="multiple" className="space-y-3">
                                        {officer.farmers.map((farmer) => (
                                            <AccordionItem key={farmer.id} value={farmer.id} className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50/30">
                                                <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-white transition-colors">
                                                    <div className="flex items-center justify-between w-full pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                                                                <Bird className="h-4 w-4" />
                                                            </div>
                                                            <div className="text-left">
                                                                <p className="font-bold text-slate-800 text-sm">{farmer.name}</p>
                                                                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tight flex items-center gap-1">
                                                                    <Wheat className="h-3 w-3" /> {farmer.mainStock.toFixed(1)} Bags
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {farmer.activeCycles.length > 0 && (
                                                                <Badge className="bg-emerald-500 text-white border-none font-bold text-[10px] px-1.5 h-5 animate-pulse">
                                                                    {farmer.activeCycles.length} LIVE
                                                                </Badge>
                                                            )}
                                                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild onClick={(e) => e.stopPropagation()}>
                                                                <Link href={getFarmerLink(farmer.id)}>
                                                                    <ArrowRight className="h-4 w-4" />
                                                                </Link>
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-4 bg-white border-t border-slate-50">
                                                    <div className="space-y-6">
                                                        {/* Active Cycles Table */}
                                                        <section>
                                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                <Activity className="h-3 w-3 text-emerald-500" /> Active Cycles
                                                            </h4>
                                                            {farmer.activeCycles.length > 0 ? (
                                                                <div className="rounded-lg border border-slate-100 overflow-hidden shadow-sm">
                                                                    <Table>
                                                                        <TableHeader className="bg-slate-50">
                                                                            <TableRow>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0 px-4">Cycle Name</TableHead>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0">Age</TableHead>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0">DOC</TableHead>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0 text-right">Intake</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {farmer.activeCycles.map((cycle) => (
                                                                                <TableRow key={cycle.id} className="hover:bg-slate-50/50 group transition-colors">
                                                                                    <TableCell className="py-2 px-4 font-bold text-slate-700 text-xs">
                                                                                        <Link href={isAdmin ? `/admin/organizations/${orgId}/cycles/${cycle.id}` : (isManagement ? `/management/cycles/${cycle.id}` : `/cycles/${cycle.id}`)} className="hover:text-primary transition-colors underline decoration-slate-200">
                                                                                            {cycle.name}
                                                                                        </Link>
                                                                                    </TableCell>
                                                                                    <TableCell className="py-2 text-xs text-slate-500">{cycle.age}d</TableCell>
                                                                                    <TableCell className="py-2 text-xs font-mono font-medium">{cycle.doc}</TableCell>
                                                                                    <TableCell className="py-2 text-xs text-right font-bold text-emerald-600">{cycle.intake.toFixed(1)} b</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-slate-400 italic px-2">No active production cycles.</p>
                                                            )}
                                                        </section>

                                                        {/* History / Inactive Cycles Section */}
                                                        <section>
                                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                <Archive className="h-3 w-3 text-slate-400" /> Production History
                                                            </h4>
                                                            {farmer.pastCycles.length > 0 ? (
                                                                <div className="rounded-lg border border-slate-100 overflow-hidden shadow-sm">
                                                                    <Table>
                                                                        <TableHeader className="bg-slate-50">
                                                                            <TableRow>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0 px-4">Batch</TableHead>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0">Ended</TableHead>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0 text-right">Mortality</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {farmer.pastCycles.map((h) => (
                                                                                <TableRow key={h.id} className="hover:bg-slate-50/50 transition-colors">
                                                                                    <TableCell className="py-2 px-4 font-medium text-slate-600 text-xs">
                                                                                        <Link href={isAdmin ? `/admin/organizations/${orgId}/cycles/${h.id}` : (isManagement ? `/management/cycles/${h.id}` : `/cycles/${h.id}`)} className="hover:text-primary transition-colors underline decoration-slate-200">
                                                                                            {h.cycleName}
                                                                                        </Link>
                                                                                    </TableCell>
                                                                                    <TableCell className="py-2 text-xs text-slate-400">
                                                                                        {format(new Date(h.endDate), "dd MMM, yy")}
                                                                                    </TableCell>
                                                                                    <TableCell className="py-2 text-xs text-right font-bold text-rose-600">{h.mortality}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-slate-400 italic px-2">No past production records found.</p>
                                                            )}
                                                        </section>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </div>

                            <div className="mt-6 pt-4 border-t border-slate-50 flex justify-end px-2">
                                <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80 hover:bg-primary/5 font-bold text-xs gap-2" asChild>
                                    <Link href={getOfficerLink(officer.userId)}>
                                        View Officer Analytics <ChevronRight className="h-4 w-4" />
                                    </Link>
                                </Button>
                            </div>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
        </div>
    );
};
