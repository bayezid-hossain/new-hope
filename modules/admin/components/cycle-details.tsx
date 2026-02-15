"use client";

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { Farmer, FarmerHistory } from "@/modules/cycles/types";
import { SalesHistoryCard } from "@/modules/cycles/ui/components/cycles/sales-history-card";
import { ActionsCell, HistoryActionsCell } from "@/modules/cycles/ui/components/shared/columns-factory";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import {
    Activity,
    Archive,
    Bird,
    ChevronLeft,
    History,
    Loader2,
    ShoppingCart,
    Trash2,
    TrendingUp
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AnalysisContent } from "./analysis-content";
import { LogsTabContent, OtherCyclesTabContent } from "./cycle-detail-tabs";

interface CycleDetailsProps {
    cycleId: string;
    isAdmin?: boolean;
    isManagement?: boolean;
}

export const CycleDetails = ({ cycleId, isAdmin, isManagement }: CycleDetailsProps) => {
    const trpc = useTRPC();
    const router = useRouter();
    const { orgId, canEdit } = useCurrentOrg()
    const searchParams = useSearchParams();
    const [showReopenModal, setShowReopenModal] = useState(false);
    const initialTab = searchParams.get("tab") || "timeline";
    const [activeTab, setActiveTab] = useState(initialTab);

    // Sync state if URL changes (optional but good for back/forward)
    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab && (tab === "timeline" || tab === "sales" || tab === "others" || tab === "analytics")) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const { data: response, isLoading } = useQuery(
        isAdmin
            ? trpc.admin.cycles.getDetails.queryOptions({ id: cycleId })
            : isManagement
                ? trpc.management.cycles.getDetails.queryOptions({ id: cycleId, orgId: orgId ?? "" })
                : trpc.officer.cycles.getDetails.queryOptions({ id: cycleId })
    );

    const normalizedCycle = useMemo(() => {
        if (!response || !response.data) return null;
        const { data: cycle, type, farmerContext } = response;
        return {
            name: type === 'active' ? (cycle as any).name : (cycle as any).cycleName,
            doc: (cycle as any).doc,
            mortality: (cycle as any).mortality,
            age: (cycle as any).age,
            intake: type === 'active' ? (cycle as any).intake : (cycle as any).finalIntake,
            createdAt: (cycle as any).createdAt,
            farmerName: farmerContext.name,
            birdsSold: (cycle as any).birdsSold || 0,
            status: type === 'active' ? 'active' : (cycle as any).status,
            birdType: (cycle as any).birdType,
        };
    }, [response]);

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!response || !response.data || !normalizedCycle) {
        return <div className="p-8 text-center text-muted-foreground italic">Cycle not found.</div>;
    }

    const { logs, history = [] } = response;
    const mortalityRate = normalizedCycle.doc > 0 ? (normalizedCycle.mortality / normalizedCycle.doc) * 100 : 0;

    return (
        <div className="space-y-6 w-full">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full shadow-sm bg-card border border-border/50 transition-all hover:bg-muted">
                        <ChevronLeft className="h-5 w-5 text-foreground" />
                    </Button>
                    <div className="flex flex-col gap-1">
                        <h1 className="text-2xl font-bold tracking-tight text-foreground"> <Link
                            href={isAdmin ? `/admin/organizations/${orgId}/farmers/${response?.data?.farmerId}` : (isManagement ? `/management/farmers/${response?.data?.farmerId}` : `/farmers/${response?.data?.farmerId}`)}
                            className="text-foreground font-bold hover:underline hover:text-primary transition-colors underline decoration-border/50"
                        >{normalizedCycle.farmerName}</Link></h1>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] font-bold uppercase">
                                {isAdmin ? "Admin View" : "Management View"}
                            </Badge>
                            {normalizedCycle.status === 'active' ? (
                                <Badge className="bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-none font-bold text-[10px] uppercase tracking-wider">
                                    <Activity className="h-3 w-3 mr-1" /> Active
                                </Badge>
                            ) : normalizedCycle.status === 'deleted' ? (
                                <Badge variant="destructive" className="bg-destructive/10 text-destructive border-none font-bold text-[10px] uppercase tracking-wider">
                                    <Trash2 className="h-3 w-3 mr-1" /> Deleted by Officer
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="bg-muted text-muted-foreground border-none font-bold text-[10px] uppercase tracking-wider">
                                    <Archive className="h-3 w-3 mr-1" /> Archived
                                </Badge>
                            )}
                            {normalizedCycle.birdType && (
                                <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 font-bold text-[10px] uppercase tracking-wider">
                                    {normalizedCycle.birdType}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto ml-auto">
                    {/* Unified Actions Dropdown */}
                    {canEdit && (
                        <div className="bg-card border border-border rounded-md shadow-sm h-8 w-8 flex items-center justify-center ml-2">
                            {normalizedCycle.status === "active" ? (
                                <ActionsCell
                                    prefix={isAdmin ? `/admin/organizations/${orgId}` : (isManagement ? `/management` : undefined)}
                                    cycle={{
                                        ...normalizedCycle,
                                        id: cycleId,
                                        farmerId: (response.data as any).farmerId, // or derive
                                        organizationId: (response.data as any).organizationId,
                                        status: "active",
                                        officerName: null,
                                        createdAt: new Date(normalizedCycle.createdAt),
                                        updatedAt: new Date(),
                                        intake: normalizedCycle.intake.toString()
                                    } as unknown as Farmer}
                                />
                            ) : (
                                <HistoryActionsCell
                                    prefix={isAdmin ? `/admin/organizations/${orgId}` : (isManagement ? `/management` : undefined)}
                                    history={{
                                        id: cycleId,
                                        cycleName: normalizedCycle.name,
                                        farmerName: normalizedCycle.farmerName,
                                        finalIntake: normalizedCycle.intake,
                                        doc: normalizedCycle.doc,
                                        mortality: normalizedCycle.mortality,
                                        age: normalizedCycle.age,
                                        status: "history",
                                        startDate: new Date(normalizedCycle.createdAt),
                                        endDate: new Date(), // Mock end date or fetch it
                                        farmerId: (response.data as any).farmerId,
                                        organizationId: (response.data as any).organizationId,
                                    } as unknown as FarmerHistory}
                                />
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-5">
                <Card className="border-border/10 shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Age</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-foreground">{normalizedCycle.age}</span>
                            <span className="text-muted-foreground text-xs font-medium">{normalizedCycle.age > 1 ? "days" : "day"}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/10 shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Live Birds</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col">
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-primary">{(normalizedCycle.doc - normalizedCycle.mortality - normalizedCycle.birdsSold).toLocaleString()}</span>
                                <Bird className="h-4 w-4 text-muted-foreground/30" />
                            </div>
                            <span className="text-[10px] text-muted-foreground">of {normalizedCycle.doc.toLocaleString()} DOC</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/10 shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Sold</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-foreground">{normalizedCycle.birdsSold.toLocaleString()}</span>
                            <ShoppingCart className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/10 shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Mortality</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <span className={`text-3xl font-bold ${normalizedCycle.mortality > 0 ? "text-destructive" : "text-foreground"}`}>
                                {normalizedCycle.mortality}
                            </span>
                            <span className="text-xs text-destructive font-bold">({mortalityRate.toFixed(2)}%)</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-border/10 shadow-sm bg-card">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Intake</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold text-amber-500">{normalizedCycle.intake.toFixed(2)}</span>
                            <span className="text-muted-foreground text-xs font-medium">bags</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="hidden md:block">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                    <TabsList className="bg-muted/50 border border-border/50 shadow-sm p-1 rounded-xl h-auto inline-flex overflow-x-auto max-w-full">
                        <TabsTrigger value="timeline" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold whitespace-nowrap transition-all">
                            <History className="h-4 w-4" /> Timeline
                        </TabsTrigger>
                        <TabsTrigger value="sales" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold whitespace-nowrap transition-all">
                            <ShoppingCart className="h-4 w-4" /> Sales
                        </TabsTrigger>
                        <TabsTrigger value="others" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold whitespace-nowrap transition-all">
                            <Archive className="h-4 w-4" /> Other Cycles
                        </TabsTrigger>
                        <TabsTrigger value="analytics" className="flex items-center gap-2 py-2 px-4 rounded-lg data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm font-bold whitespace-nowrap transition-all">
                            <TrendingUp className="h-4 w-4" /> Analytics
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="timeline" className="mt-0 focus-visible:outline-none">
                        <Card className="border-none shadow-sm bg-card overflow-hidden">
                            <CardContent className="p-0">
                                <LogsTabContent logs={logs as any[]} />
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="sales" className="mt-0 focus-visible:outline-none">
                        <SalesHistoryCard
                            cycleId={normalizedCycle.status === 'active' ? cycleId : undefined}
                            historyId={normalizedCycle.status !== 'active' ? cycleId : undefined}
                        />
                    </TabsContent>

                    <TabsContent value="analytics" className="mt-0 focus-visible:outline-none">
                        <AnalysisContent
                            cycle={normalizedCycle}
                            history={history.filter((h: any) => h.id !== cycleId)}
                        />
                    </TabsContent>

                    <TabsContent value="others" className="mt-0 focus-visible:outline-none">
                        <OtherCyclesTabContent
                            history={history}
                            isAdmin={isAdmin}
                            isManagement={isManagement}
                            currentId={cycleId}
                            orgId={orgId ?? ""}
                        />
                    </TabsContent>
                </Tabs>
            </div>

            {/* Mobile View: Accordion */}
            <div className="block md:hidden">
                <Accordion
                    type="single"
                    collapsible
                    value={activeTab}
                    onValueChange={(val) => val && setActiveTab(val)}
                    className="space-y-4"
                >
                    <AccordionItem value="timeline" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
                        <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                            <div className="flex items-center gap-2">
                                <History className="h-5 w-5 text-muted-foreground" />
                                <span className="font-semibold tracking-tight">Activity Logs</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                            <LogsTabContent logs={logs as any[]} isMobile />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="sales" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
                        <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                            <div className="flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                                <span className="font-semibold tracking-tight">Sales History</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                            <SalesHistoryCard
                                cycleId={normalizedCycle.status === 'active' ? cycleId : undefined}
                                historyId={normalizedCycle.status !== 'active' ? cycleId : undefined}
                                isMobile
                            />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="others" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-1 border-border/50">
                        <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                            <div className="flex items-center gap-2">
                                <Archive className="h-5 w-5 text-muted-foreground" />
                                <span className="font-semibold tracking-tight">Other Cycles</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                            <OtherCyclesTabContent
                                history={history}
                                isAdmin={isAdmin}
                                isManagement={isManagement}
                                currentId={cycleId}
                                orgId={orgId ?? ""}
                                isMobile
                            />
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="analytics" className="border rounded-2xl bg-card shadow-sm overflow-hidden px-4 py-2 border-border/50">
                        <AccordionTrigger className="hover:no-underline py-4 text-foreground">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="h-5 w-5 text-muted-foreground" />
                                <span className="font-semibold tracking-tight">Analysis Insights</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="pt-2 pb-4">
                            <AnalysisContent
                                cycle={normalizedCycle}
                                history={history.filter((h: any) => h.id !== cycleId)}
                            />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </div>

        </div>
    );
};
