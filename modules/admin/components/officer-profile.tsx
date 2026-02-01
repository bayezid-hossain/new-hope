"use client";



import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
        { label: "Active Cycles", value: profile.stats.activeCycles, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Past Cycles", value: profile.stats.pastCycles, icon: Archive, color: "text-slate-600", bg: "bg-slate-50" },
        { label: "Total Birds", value: profile.stats.totalDoc.toLocaleString(), icon: Bird, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Total Feed", value: `${profile.stats.totalIntake.toFixed(2)} b`, icon: Wheat, color: "text-amber-600", bg: "bg-amber-50" },
        { label: "Main Stock", value: `${profile.farmers.reduce((acc, f) => acc + f.mainStock, 0).toLocaleString()} b`, icon: Wheat, color: "text-amber-800", bg: "bg-amber-100/50" },
    ];

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="sm" asChild className="text-slate-500 hover:text-slate-900">
                        <Link href={backUrl}>
                            <ChevronLeft className="h-4 w-4 mr-1" /> Back
                        </Link>
                    </Button>
                    <div className="h-8 w-[1px] bg-slate-200 mx-2" />
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center border-2 border-white shadow-sm">
                            <User className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-900 leading-tight">{profile.officer.name}</h1>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] font-bold tracking-wider uppercase border-none bg-slate-100 text-slate-500">{profile.role}</Badge>
                                <span>•</span>
                                <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {profile.officer.email}</span>
                                {isAdminView && (
                                    <>
                                        <span>•</span>
                                        <div className="flex items-center gap-2 ml-2">
                                            <Switch
                                                id="pro-mode"
                                                checked={profile.officer.isPro}
                                                onCheckedChange={(checked) => togglePro({ userId: profile.officer.id, isPro: checked })}
                                                disabled={isTogglingPro}
                                                className="h-4 w-7 data-[state=checked]:bg-emerald-500"
                                            />
                                            <Label htmlFor="pro-mode" className="text-xs font-medium text-slate-600 cursor-pointer">
                                                Pro Status
                                            </Label>
                                            {isTogglingPro && <Loader2 className="h-3 w-3 animate-spin text-slate-400" />}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Analytics Bar */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {statsItems.map((item) => (
                    <Card key={item.label} className="border-slate-200 shadow-sm overflow-hidden">
                        <CardContent className="p-4 flex flex-col gap-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                                <item.icon className={`h-3 w-3 ${item.color}`} />
                                {item.label}
                            </span>
                            <span className="text-2xl font-bold text-slate-900">{item.value}</span>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 min-h-0">
                {/* Left Column: Managed Farmers Table */}
                <Card className="lg:col-span-2 border-slate-200 shadow-sm flex flex-col h-[600px] lg:h-auto overflow-hidden">
                    <Tabs defaultValue="active" className="flex flex-col h-full">
                        <CardHeader className="py-4 px-6 border-b bg-slate-50/50 flex flex-row items-center justify-between shrink-0">
                            <div className="flex flex-col gap-1">
                                <CardTitle className="text-base font-bold text-slate-900">Managed Farmers</CardTitle>
                                <TabsList className="h-8 bg-slate-100/50 p-0.5 border">
                                    <TabsTrigger value="active" className="text-[10px] h-7 px-3 font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                        Active ({profile.farmers.filter(f => f.status === "active").length})
                                    </TabsTrigger>
                                    <TabsTrigger value="archived" className="text-[10px] h-7 px-3 font-bold uppercase tracking-wider data-[state=active]:bg-white data-[state=active]:shadow-sm">
                                        Archived ({profile.farmers.filter(f => f.status === "deleted").length})
                                    </TabsTrigger>
                                </TabsList>
                            </div>
                            <Badge variant="outline" className="bg-white">{profile.farmers.length} Total</Badge>
                        </CardHeader>

                        <div className="flex-1 min-h-0 relative">
                            {isFetching && !isLoading && (
                                <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] z-50 flex flex-col items-center justify-center animate-in fade-in duration-200">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            )}
                            <ScrollArea className="h-[500px] lg:h-[600px] w-full">
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
                </Card>

                {/* Right Column: AI Risk Watchdog */}
                <div className="space-y-6">
                    {/* Risk Watchdog Card */}
                    <SmartWatchdogWidget orgId={orgId} officerId={userId} />

                    <Card className="border-slate-200 shadow-sm group">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-bold text-slate-900">Officer Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start text-slate-600" disabled>
                                <Mail className="h-4 w-4 mr-2" /> Send Message
                            </Button>
                            <Button variant="outline" className="w-full justify-start text-slate-600" disabled>
                                <Archive className="h-4 w-4 mr-2" /> View Audit Logs
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Supply Chain Predictor */}
                    <SupplyChainWidget orgId={orgId} officerId={userId} viewMode="ADMIN" />
                </div>
            </div>
        </div>
    );
};

const ManagedFarmersTable = ({ farmers, isAdminView, orgId }: { farmers: any[], isAdminView: boolean | undefined, orgId: string }) => {
    if (farmers.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400 italic">
                No farmers found in this category.
            </div>
        );
    }

    return (
        <div className="min-w-[600px] md:min-w-0">
            <Table>
                <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                    <TableRow>
                        <TableHead className="w-[40%] font-semibold pl-6">Farmer Name</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-right">Cycles</TableHead>
                        <TableHead className="font-semibold text-right pr-6">Stock</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {farmers.map((farmer) => (
                        <TableRow key={farmer.id} className="hover:bg-slate-50/50 transition-colors group">
                            <TableCell className="pl-6 py-3">
                                <Link
                                    href={isAdminView ? `/admin/organizations/${orgId}/farmers/${farmer.id}` : `/management/farmers/${farmer.id}`}
                                    className={`font-bold hover:text-primary hover:underline decoration-primary/30 underline-offset-4 transition-all ${farmer.status === 'deleted' ? 'text-slate-400' : 'text-slate-900'}`}
                                >
                                    {farmer.name}
                                </Link>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {farmer.id.slice(0, 8)}</div>
                            </TableCell>
                            <TableCell>
                                {farmer.status === 'deleted' ? (
                                    <Badge variant="outline" className="text-slate-400 border-slate-200 font-bold text-[10px] px-2">ARCHIVED</Badge>
                                ) : farmer.activeCyclesCount > 0 ? (
                                    <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px] px-2">ACTIVE</Badge>
                                ) : (
                                    <Badge className="bg-slate-100 text-slate-400 border-none font-bold text-[10px] px-2">IDLE</Badge>
                                )}
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex flex-col items-end gap-1">
                                    <div className={`flex items-center gap-1.5 font-bold text-xs px-1.5 py-0.5 rounded-md ${farmer.status === 'deleted' ? 'bg-slate-100 text-slate-400' : 'bg-emerald-50 text-emerald-600'}`}>
                                        <Activity className="h-3 w-3" />
                                        {farmer.activeCyclesCount}
                                    </div>
                                    {farmer.pastCyclesCount > 0 && (
                                        <div className="text-[10px] text-slate-400 font-medium px-1.5">
                                            {farmer.pastCyclesCount} past
                                        </div>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell className="text-right font-bold text-slate-700 pr-6">
                                {(() => {
                                    const activeConsumption = (farmer.cycles || []).reduce((acc: number, c: any) => acc + (c.intake || 0), 0);
                                    const remaining = farmer.mainStock - activeConsumption;

                                    if (farmer.status === 'deleted') {
                                        return (
                                            <div className="flex items-center justify-end gap-1.5 opacity-60">
                                                <Wheat className="h-3.5 w-3.5 text-slate-400" />
                                                <span className="text-slate-500 font-bold">{farmer.mainStock.toFixed(2)}</span>
                                                <span className="text-[9px] font-normal uppercase tracking-wider text-slate-400">Remaining</span>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="flex flex-col items-end gap-0.5">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Wheat className="h-3.5 w-3.5 text-amber-500" />
                                                <span className={`${remaining < 3 ? 'text-red-600' : 'text-slate-900'}`}>{remaining.toFixed(2)}</span>
                                            </div>
                                            {activeConsumption > 0 && (
                                                <div className="text-[9px] text-slate-400 font-medium">
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
    );
};
