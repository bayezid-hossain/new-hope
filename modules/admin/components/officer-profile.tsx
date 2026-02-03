"use client";



import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth-client";
import { SmartWatchdogWidget } from "@/modules/shared/components/smart-watchdog-widget";
import { SupplyChainWidget } from "@/modules/shared/components/supply-chain-widget";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Archive, Bird, ChevronLeft, Loader2, Mail, User, Wheat } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { OrgCyclesList } from "./org-cycles-list";

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

    const { data: profile, isLoading, isFetching } = useQuery({
        ...queryOptions,
        placeholderData: (prev) => prev
    });
    const queryClient = useQueryClient();

    const { mutate: togglePro, isPending: isTogglingPro } = useMutation(
        trpc.admin.officers.toggleProStatus.mutationOptions({
            onSuccess: (data, variables) => {
                toast.success(`User pro status ${variables.isPro ? "enabled" : "disabled"}`);
                queryClient.invalidateQueries(adminQuery);
            },
            onError: (err) => {
                toast.error(err.message);
            }
        })
    );

    const { data: session } = authClient.useSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session?.user as any;
    const isPro = user?.isPro || user?.globalRole === "ADMIN";




    if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (!profile) return <div>Officer not found.</div>;

    const statsItems = [
        { label: "Active Cycles", value: profile.stats.activeCycles, icon: Activity, color: "text-primary", bg: "bg-primary/10" },
        { label: "Past Cycles", value: profile.stats.pastCycles, icon: Archive, color: "text-muted-foreground", bg: "bg-muted" },
        { label: "Active Birds", value: profile.stats.activeDoc.toLocaleString(), icon: Bird, color: "text-blue-500", bg: "bg-blue-500/10 dark:bg-blue-900/30" },
        { label: "Active Consumption", value: `${profile.stats.activeIntake.toFixed(1)} b`, icon: Wheat, color: "text-amber-500", bg: "bg-amber-500/10 dark:bg-amber-900/30" },
        { label: "Main Stock", value: `${profile.stats.totalMainStock.toLocaleString()} b`, icon: Wheat, color: "text-amber-600 dark:text-amber-500", bg: "bg-amber-700/10 dark:bg-amber-900/30" },
    ];

    return (
        <div className="space-y-6 h-full flex flex-col bg-background px-4 sm:px-6 py-6 font-sans">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border shadow-sm transition-all hover:shadow-md">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-full hover:bg-muted lg:hidden">
                        <Link href={backUrl}>
                            <ChevronLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center border-2 border-background shadow-sm ring-1 ring-primary/20">
                            <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-foreground leading-tight tracking-tight">{profile.officer.name}</h1>
                                <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[9px] font-bold tracking-wider uppercase border-none bg-primary/10 text-primary rounded-md">{profile.role}</Badge>
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 font-medium">
                                <Mail className="h-3 w-3" /> {profile.officer.email}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                    <Button variant="outline" size="sm" asChild className="hidden lg:flex h-8 text-xs font-bold text-muted-foreground hover:text-primary bg-card hover:border-primary/20 transition-all">
                        <Link href={backUrl}>
                            <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
                        </Link>
                    </Button>
                    {isAdminView && (
                        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-xl border border-border/50">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tight">Pro Mode</span>
                            <Switch
                                id="pro-mode"
                                checked={profile.officer.isPro}
                                onCheckedChange={(checked) => togglePro({ userId: profile.officer.id, isPro: checked })}
                                disabled={isTogglingPro}
                                className="h-4 w-7 data-[state=checked]:bg-primary"
                            />
                            {isTogglingPro && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                        </div>
                    )}
                </div>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {statsItems.map((item) => (
                    <div key={item.label} className={`p-3.5 rounded-2xl border border-border shadow-sm flex flex-col gap-1.5 hover:border-primary/20 transition-all hover:shadow-md group bg-card`}>
                        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest flex items-center gap-1.5">
                            <item.icon className={`h-3 w-3 ${item.color} group-hover:scale-110 transition-transform`} />
                            {item.label}
                        </span>
                        <span className="text-xl font-bold text-foreground tracking-tight">{item.value}</span>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Left Column: Data Tabs (Farmers & Cycles) */}
                <Card className="lg:col-span-2 border-border shadow-sm flex flex-col h-[850px] lg:h-auto overflow-hidden rounded-2xl">
                    <Tabs defaultValue="farmers" className="flex flex-col h-full">
                        <div className="py-3 px-6 border-b bg-card flex flex-row items-center justify-between shrink-0">
                            <TabsList className="h-8 bg-muted p-1 rounded-lg">
                                <TabsTrigger value="farmers" className="text-[10px] px-3 font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all">
                                    Farmers
                                </TabsTrigger>
                                <TabsTrigger value="cycles" className="text-[10px] px-3 font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:text-primary data-[state=active]:shadow-sm rounded-md transition-all">
                                    Cycles
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 min-h-0 bg-card">
                            <TabsContent value="farmers" className="m-0 h-full focus-visible:outline-none">
                                <Tabs defaultValue="active" className="flex flex-col h-full">
                                    <div className="px-6 py-2 border-b bg-muted/30 flex justify-between items-center shrink-0">
                                        <TabsList className="h-7 bg-muted/50 p-0.5 rounded-md">
                                            <TabsTrigger value="active" className="text-[9px] h-6 px-2.5 font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-[4px] transition-all">
                                                Active ({profile.farmers.filter(f => f.status === "active").length})
                                            </TabsTrigger>
                                            <TabsTrigger value="archived" className="text-[9px] h-6 px-2.5 font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-[4px] transition-all">
                                                Archived ({profile.farmers.filter(f => f.status === "deleted").length})
                                            </TabsTrigger>
                                        </TabsList>

                                    </div>

                                    <div className="flex-1 min-h-0 relative">
                                        {isFetching && !isLoading && (
                                            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px] z-50 flex flex-col items-center justify-center animate-in fade-in duration-200">
                                                <Loader2 className="h-6 w-6 animate-spin text-primary/40" />
                                            </div>
                                        )}
                                        <ScrollArea className="h-[650px] lg:h-[750px] w-full">
                                            <TabsContent value="active" className="m-0 focus-visible:outline-none">
                                                <ManagedFarmersTable
                                                    farmers={profile.farmers.filter(f => f.status === "active")}
                                                    isAdminView={isAdminView}
                                                    orgId={orgId}
                                                />
                                            </TabsContent>
                                            <TabsContent value="archived" className="m-0 focus-visible:outline-none">
                                                <ManagedFarmersTable
                                                    farmers={profile.farmers.filter(f => f.status === "deleted")}
                                                    isAdminView={isAdminView}
                                                    orgId={orgId}
                                                />
                                            </TabsContent>
                                        </ScrollArea>
                                    </div>
                                </Tabs>
                            </TabsContent>

                            <TabsContent value="cycles" className="m-0 h-full focus-visible:outline-none">
                                <Tabs defaultValue="active" className="flex flex-col h-full">
                                    <div className="px-6 py-2 border-b bg-muted/30 flex justify-between items-center shrink-0">
                                        <TabsList className="h-7 bg-muted/50 p-0.5 rounded-md">
                                            <TabsTrigger value="active" className="text-[9px] h-6 px-2.5 font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-[4px] transition-all">
                                                Active ({profile.stats.activeCycles})
                                            </TabsTrigger>
                                            <TabsTrigger value="past" className="text-[9px] h-6 px-2.5 font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-[4px] transition-all">
                                                History ({profile.stats.pastCycles})
                                            </TabsTrigger>
                                            <TabsTrigger value="deleted" className="text-[9px] h-6 px-2.5 font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-[4px] transition-all">
                                                Deleted ({profile.stats.deletedCycles})
                                            </TabsTrigger>
                                        </TabsList>
                                    </div>

                                    <div className="flex-1 h-full">
                                        <ScrollArea className="h-[650px] lg:h-auto min-h-[650px] w-full">
                                            <TabsContent value="active" className="m-0 focus-visible:outline-none">
                                                <OrgCyclesList orgId={orgId} officerId={userId} isAdmin={isAdminView} isManagement={!isAdminView} status="active" />
                                            </TabsContent>
                                            <TabsContent value="past" className="m-0 focus-visible:outline-none">
                                                <OrgCyclesList orgId={orgId} officerId={userId} isAdmin={isAdminView} isManagement={!isAdminView} status="past" />
                                            </TabsContent>
                                            <TabsContent value="deleted" className="m-0 focus-visible:outline-none">
                                                <OrgCyclesList orgId={orgId} officerId={userId} isAdmin={isAdminView} isManagement={!isAdminView} status="deleted" />
                                            </TabsContent>
                                        </ScrollArea>
                                    </div>
                                </Tabs>
                            </TabsContent>
                        </div>
                    </Tabs>
                </Card>

                {/* Right Column: AI Risk Watchdog */}
                <div className="space-y-6">
                    <SmartWatchdogWidget orgId={orgId} officerId={userId} />

                    <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-4 hover:shadow-md transition-all group">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest group-hover:text-primary transition-colors">Management Actions</h3>
                        <div className="grid grid-cols-1 gap-2">
                            <Button variant="outline" className="w-full justify-start text-[11px] font-bold uppercase tracking-tight h-10 border-border hover:bg-muted transition-all hover:border-primary/20 group" disabled>
                                <Mail className="h-4 w-4 mr-2 text-primary/50 group-hover:scale-110 transition-transform" /> Contact Officer
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-[11px] font-bold uppercase tracking-tight h-10 border-border hover:bg-muted transition-all hover:border-border/80 group" disabled>
                                <Archive className="h-4 w-4 mr-2 text-muted-foreground/50 group-hover:scale-110 transition-transform" /> Audit History
                            </Button>
                        </div>
                    </div>

                    <SupplyChainWidget orgId={orgId} officerId={userId} viewMode="ADMIN" />
                </div>
            </div>
        </div>
    );
};

const ManagedFarmersTable = ({ farmers, isAdminView, orgId }: { farmers: any[], isAdminView: boolean | undefined, orgId: string }) => {
    if (farmers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground italic">
                No farmers found in this category.
            </div>
        );
    }

    return (
        <div className="pb-12">
            {/* Desktop Table View */}
            <div className="hidden md:block">
                <Table>
                    <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm border-b">
                        <TableRow>
                            <TableHead className="w-[40%] font-semibold pl-6">Farmer Name</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold text-right">Cycles</TableHead>
                            <TableHead className="font-semibold text-right pr-6">Stock</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {farmers.map((farmer) => (
                            <TableRow key={farmer.id} className="hover:bg-muted/30 transition-colors group border-b border-border/10">
                                <TableCell className="pl-6 py-3">
                                    <Link
                                        href={isAdminView ? `/admin/organizations/${orgId}/farmers/${farmer.id}` : `/management/farmers/${farmer.id}`}
                                        className={`font-bold hover:text-primary hover:underline decoration-primary/30 underline-offset-4 transition-all ${farmer.status === 'deleted' ? 'text-muted-foreground/50' : 'text-foreground'}`}
                                    >
                                        {farmer.name}
                                    </Link>
                                    <div className="text-[10px] text-muted-foreground/50 font-mono mt-0.5">ID: {farmer.id.slice(0, 8)}</div>
                                </TableCell>
                                <TableCell>
                                    {farmer.status === 'deleted' ? (
                                        <Badge variant="outline" className="text-muted-foreground border-border font-bold text-[10px] px-2 bg-muted/20">ARCHIVED</Badge>
                                    ) : farmer.activeCyclesCount > 0 ? (
                                        <Badge className="bg-primary/20 text-primary border-none font-bold text-[10px] px-2 shadow-none">ACTIVE</Badge>
                                    ) : (
                                        <Badge variant="secondary" className="bg-muted text-muted-foreground border-none font-bold text-[10px] px-2 shadow-none">IDLE</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex flex-col items-end gap-1">
                                        <div className={`flex items-center gap-1.5 font-bold text-xs px-1.5 py-0.5 rounded-md ${farmer.status === 'deleted' ? 'bg-muted text-muted-foreground/50' : 'bg-primary/10 text-primary'}`}>
                                            <Activity className="h-3 w-3" />
                                            {farmer.activeCyclesCount}
                                        </div>
                                        {farmer.pastCyclesCount > 0 && (
                                            <div className="text-[10px] text-muted-foreground font-medium px-1.5">
                                                {farmer.pastCyclesCount} past
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-bold text-foreground/80 pr-6">
                                    {(() => {
                                        const activeConsumption = (farmer.cycles || []).reduce((acc: number, c: any) => acc + (c.intake || 0), 0);
                                        const remaining = farmer.mainStock - activeConsumption;

                                        if (farmer.status === 'deleted') {
                                            return (
                                                <div className="flex items-center justify-end gap-1.5 opacity-60">
                                                    <Wheat className="h-3.5 w-3.5 text-muted-foreground/50" />
                                                    <span className="text-muted-foreground font-bold">{farmer.mainStock.toFixed(2)}</span>
                                                    <span className="text-[9px] font-normal uppercase tracking-wider text-muted-foreground/70">Remaining</span>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="flex flex-col items-end gap-0.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Wheat className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
                                                    <span className={`${remaining < 3 ? 'text-destructive' : 'text-foreground'}`}>{remaining.toFixed(2)}</span>
                                                </div>
                                                {activeConsumption > 0 && (
                                                    <div className="text-[9px] text-muted-foreground font-medium">
                                                        {activeConsumption.toFixed(2)} used
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-3 p-4">
                {farmers.map((farmer) => {
                    const activeConsumption = (farmer.cycles || []).reduce((acc: number, c: any) => acc + (c.intake || 0), 0);
                    const remaining = farmer.mainStock - activeConsumption;

                    return (
                        <div key={farmer.id} className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-3">
                            <div className="flex justify-between items-start">
                                <div className="space-y-0.5">
                                    <Link
                                        href={isAdminView ? `/admin/organizations/${orgId}/farmers/${farmer.id}` : `/management/farmers/${farmer.id}`}
                                        className={`block font-bold text-sm hover:text-primary ${farmer.status === 'deleted' ? 'text-muted-foreground/50' : 'text-foreground'}`}
                                    >
                                        {farmer.name}
                                    </Link>
                                    <p className="text-[10px] text-muted-foreground/50 font-mono">ID: {farmer.id.slice(0, 8)}</p>
                                </div>
                                {farmer.status === 'deleted' ? (
                                    <Badge variant="outline" className="text-[9px] font-bold text-muted-foreground bg-muted/20 border-border">ARCHIVED</Badge>
                                ) : farmer.activeCyclesCount > 0 ? (
                                    <Badge className="text-[9px] font-bold bg-primary/20 text-primary border-none shadow-none">ACTIVE</Badge>
                                ) : (
                                    <Badge variant="secondary" className="text-[9px] font-bold bg-muted text-muted-foreground border-none shadow-none">IDLE</Badge>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div className="space-y-1">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Cycles</span>
                                    <div className="flex items-center gap-2">
                                        <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${farmer.status === 'deleted' ? 'bg-muted text-muted-foreground/50' : 'bg-primary/10 text-primary'}`}>
                                            <Activity className="h-2.5 w-2.5" />
                                            {farmer.activeCyclesCount} Active
                                        </div>
                                        {farmer.pastCyclesCount > 0 && (
                                            <span className="text-[10px] text-muted-foreground/60 font-medium">{farmer.pastCyclesCount} past</span>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-1 text-right">
                                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Stock Balance</span>
                                    <div className="flex flex-col items-end">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className="text-[9px] font-medium text-muted-foreground/60">Main stock:</span>
                                            <span className="text-[10px] font-bold text-foreground/70">{farmer.mainStock.toFixed(1)}</span>
                                        </div>

                                        {activeConsumption > 0 && (
                                            <p className="text-[9px] text-muted-foreground/60 font-medium">{activeConsumption.toFixed(1)} used</p>
                                        )}
                                        <div className="flex items-center gap-1">
                                            <Wheat className={`h-3 w-3 ${remaining < 3 && farmer.status !== 'deleted' ? 'text-destructive' : 'text-amber-500 dark:text-amber-400'}`} />
                                            <span className={`text-xs font-bold ${remaining < 3 && farmer.status !== 'deleted' ? 'text-destructive' : 'text-foreground'}`}>
                                                {remaining.toFixed(2)}
                                            </span>
                                            <span className="text-[9px] font-normal text-muted-foreground/60">bags</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
