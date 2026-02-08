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
            <div className="text-center p-12 border-2 border-dashed rounded-3xl bg-muted/30 text-muted-foreground border-border">
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
                        className="border-none bg-card rounded-2xl shadow-sm overflow-hidden"
                    >
                        <AccordionTrigger className="hover:no-underline px-6 py-4 hover:bg-muted/50 transition-colors">
                            <div className="flex items-center gap-4 text-left">
                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                                    <User className="h-5 w-5" />
                                </div>
                                <div>

                                    <div className="ml-4 flex gap-3">
                                        <h3 className="font-bold text-foreground group-hover:text-primary transition-colors">
                                            {officer.name}
                                        </h3>
                                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none font-bold text-[10px]">
                                            {officer.farmers.length} Farmers
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Badge variant="outline" className="text-[9px] h-4 uppercase font-bold tracking-widest bg-muted/50 border-border">
                                            {officer.role}
                                        </Badge>
                                        <span className="flex items-center gap-1">
                                            <Mail className="h-3 w-3" /> {officer.email}
                                        </span>
                                    </div>
                                </div>

                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-6 pb-6 pt-2">
                            <div className="pl-6 border-l-2 border-border/50 ml-5 space-y-4">
                                {officer.farmers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground italic py-2">No farmers assigned to this officer.</p>
                                ) : (
                                    <Accordion type="multiple" className="space-y-3">
                                        {officer.farmers.map((farmer) => (
                                            <AccordionItem key={farmer.id} value={farmer.id} className="border border-border/50 rounded-xl overflow-hidden bg-muted/20">
                                                <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-card transition-colors">
                                                    <div className="flex items-center justify-between w-full pr-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
                                                                <Bird className="h-4 w-4" />
                                                            </div>
                                                            <div className="text-left">
                                                                <Link href={getFarmerLink(farmer.id)} onClick={(e) => e.stopPropagation()}>
                                                                    <p className="font-bold text-foreground text-sm hover:text-primary hover:underline transition-colors">{farmer.name}</p>
                                                                </Link>
                                                                <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight flex items-center gap-1">
                                                                    <Wheat className="h-3 w-3" /> {farmer.mainStock.toFixed(2)} Bags
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            {farmer.activeCycles.length > 0 && (
                                                                <Badge className="bg-primary text-primary-foreground border-none font-bold text-[10px] px-1.5 h-5 animate-pulse">
                                                                    {farmer.activeCycles.length} LIVE
                                                                </Badge>
                                                            )}
                                                        </div>
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className="p-4 bg-card border-t border-border/50">
                                                    <div className="space-y-6">
                                                        {/* Active Cycles Table */}
                                                        <section>
                                                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                <Activity className="h-3 w-3 text-primary" /> Active Cycles
                                                            </h4>
                                                            {farmer.activeCycles.length > 0 ? (
                                                                <div className="rounded-lg border border-border/50 overflow-hidden shadow-sm">
                                                                    <Table>
                                                                        <TableHeader className="bg-muted/50">
                                                                            <TableRow>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0 px-4">Cycle Name</TableHead>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0">Age</TableHead>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0">DOC</TableHead>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0 text-right">Intake</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {farmer.activeCycles.map((cycle) => (
                                                                                <TableRow key={cycle.id} className="hover:bg-muted/30 group transition-colors">
                                                                                    <TableCell className="py-2 px-4 font-bold text-foreground text-xs">
                                                                                        <Link href={isAdmin ? `/admin/organizations/${orgId}/cycles/${cycle.id}` : (isManagement ? `/management/cycles/${cycle.id}` : `/cycles/${cycle.id}`)} className="hover:text-primary transition-colors underline decoration-border">
                                                                                            {cycle.name}
                                                                                        </Link>
                                                                                    </TableCell>
                                                                                    <TableCell className="py-2 text-xs text-muted-foreground">{cycle.age}d</TableCell>
                                                                                    <TableCell className="py-2 text-xs font-mono font-medium">{cycle.doc}</TableCell>
                                                                                    <TableCell className="py-2 text-xs text-right font-bold text-primary">{cycle.intake.toFixed(2)} b</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground italic px-2">No active production cycles.</p>
                                                            )}
                                                        </section>

                                                        {/* History / Inactive Cycles Section */}
                                                        <section>
                                                            <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                                                                <Archive className="h-3 w-3 text-muted-foreground" /> Production History
                                                            </h4>
                                                            {farmer.pastCycles.length > 0 ? (
                                                                <div className="rounded-lg border border-border/50 overflow-hidden shadow-sm">
                                                                    <Table>
                                                                        <TableHeader className="bg-muted/50">
                                                                            <TableRow>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0 px-4">Batch</TableHead>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0">Ended</TableHead>
                                                                                <TableHead className="h-8 text-[10px] font-bold uppercase py-0 text-right">Mortality</TableHead>
                                                                            </TableRow>
                                                                        </TableHeader>
                                                                        <TableBody>
                                                                            {farmer.pastCycles.map((h) => (
                                                                                <TableRow key={h.id} className="hover:bg-muted/30 transition-colors">
                                                                                    <TableCell className="py-2 px-4 font-medium text-foreground/80 text-xs">
                                                                                        <Link href={isAdmin ? `/admin/organizations/${orgId}/cycles/${h.id}` : (isManagement ? `/management/cycles/${h.id}` : `/cycles/${h.id}`)} className="hover:text-primary transition-colors underline decoration-border">
                                                                                            {h.cycleName}
                                                                                        </Link>
                                                                                    </TableCell>
                                                                                    <TableCell className="py-2 text-xs text-muted-foreground">
                                                                                        {format(new Date(h.endDate), "dd/MM/yyyy")}
                                                                                    </TableCell>
                                                                                    <TableCell className="py-2 text-xs text-right font-bold text-destructive">{h.mortality}</TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </div>
                                                            ) : (
                                                                <p className="text-xs text-muted-foreground italic px-2">No past production records found.</p>
                                                            )}
                                                        </section>
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                )}
                            </div>

                            <div className="mt-6 pt-4 border-t border-border/50 flex justify-end px-2">
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
