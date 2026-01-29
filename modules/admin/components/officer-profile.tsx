"use client";



import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { SupplyChainWidget } from "@/modules/shared/components/supply-chain-widget";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, Archive, ArrowRight, Bird, CheckCircle2, ChevronLeft, Clock, Loader2, Lock, Mail, ShieldAlert, Sparkles, User, Wheat } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface OfficerProfileProps {
    orgId: string;
    userId: string;
    backUrl: string;
    isAdminView?: boolean;
}

interface RiskAssessment {
    summary: string;
    risks: Array<{
        farmer: string;
        level: "CRITICAL" | "WARNING";
        message: string;
    }>;
}

export const OfficerProfile = ({ orgId, userId, backUrl, isAdminView }: OfficerProfileProps) => {
    const trpc = useTRPC();
    const [assessment, setAssessment] = useState<RiskAssessment | null>(null);

    const adminQuery = trpc.admin.officers.getDetails.queryOptions({ orgId, userId });
    const managementQuery = trpc.management.officers.getDetails.queryOptions({ orgId, userId });

    const queryOptions = isAdminView ? adminQuery : managementQuery;

    const { data: profile, isLoading } = useQuery(queryOptions);
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

    const { mutate: runRiskScan, isPending: isScanning } = useMutation(
        trpc.ai.generateRiskAssessment.mutationOptions({
            onSuccess: (data: any) => {
                setAssessment(data);
            },
            onError: (err) => {
                if (!err.message.includes("Pro")) {
                    toast.error("Smart Watchdog scan failed");
                }
            }
        })
    );

    const requestAccessMutation = useMutation(trpc.officer.requestAccess.mutationOptions({
        onSuccess: () => {
            toast.success("Request sent! Admin will review shortly.");
            refetchStatus();
        },
        onError: (err) => {
            toast.error(err.message);
        }
    }));

    // Fetch Request Status
    const { data: requestStatus, refetch: refetchStatus, isPending: isLoadingStatus } = useQuery({
        ...trpc.officer.getMyRequestStatus.queryOptions({ feature: "RISK_MANAGEMENT" }),
        enabled: !isPro && !!user
    });

    const hasRequested = requestStatus?.status === "PENDING";
    const isApprovedInDb = requestStatus?.status === "APPROVED";

    const handleRequestAccess = () => {
        requestAccessMutation.mutate({ feature: "RISK_MANAGEMENT" });
    };

    useEffect(() => {
        if (profile && !assessment && !isScanning && isPro) {
            runRiskScan({
                orgId,
                officerId: userId
            });
        }
    }, [profile, assessment, isScanning, runRiskScan, orgId, userId, isPro]);


    if (isLoading) return <div className="flex h-96 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    if (!profile) return <div>Officer not found.</div>;

    const statsItems = [
        { label: "Active Cycles", value: profile.stats.activeCycles, icon: Activity, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Past Cycles", value: profile.stats.pastCycles, icon: Archive, color: "text-slate-600", bg: "bg-slate-50" },
        { label: "Total Birds", value: profile.stats.totalDoc.toLocaleString(), icon: Bird, color: "text-blue-600", bg: "bg-blue-50" },
        { label: "Total Feed", value: `${profile.stats.totalIntake.toFixed(1)} b`, icon: Wheat, color: "text-amber-600", bg: "bg-amber-50" },
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
                    <CardHeader className="py-4 px-6 border-b bg-slate-50/50 flex flex-row items-center justify-between shrink-0">
                        <div className="space-y-0.5">
                            <CardTitle className="text-base font-bold text-slate-900">Managed Farmers</CardTitle>
                            <p className="text-xs text-slate-500 font-medium">Farmers assigned to this officer</p>
                        </div>
                        <Badge variant="outline" className="bg-white">{profile.farmers.length} Farmers</Badge>
                    </CardHeader>

                    <div className="flex-1 min-h-0">
                        <ScrollArea className="h-[500px] lg:h-[600px] w-full">
                            <div className="min-w-[600px] md:min-w-0">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead className="w-[40%] font-semibold pl-6">Farmer Name</TableHead>
                                            <TableHead className="font-semibold">Status</TableHead>
                                            <TableHead className="font-semibold text-right">Cycles</TableHead>
                                            <TableHead className="font-semibold text-right">Stock</TableHead>
                                            <TableHead className="w-[50px] pr-6"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {profile.farmers.map((farmer) => (
                                            <TableRow key={farmer.id} className="hover:bg-slate-50/50 transition-colors group">
                                                <TableCell className="pl-6 py-3">
                                                    <div className="font-bold text-slate-900">{farmer.name}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {farmer.id.slice(0, 8)}</div>
                                                </TableCell>
                                                <TableCell>
                                                    {farmer.activeCyclesCount > 0 ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold text-[10px] px-2">ACTIVE</Badge>
                                                    ) : (
                                                        <Badge className="bg-slate-100 text-slate-400 border-none font-bold text-[10px] px-2">IDLE</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex flex-col items-end gap-1">
                                                        <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-xs bg-emerald-50 px-1.5 py-0.5 rounded-md">
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
                                                <TableCell className="text-right font-bold text-slate-700">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <Wheat className="h-3.5 w-3.5 text-amber-500/50" />
                                                        <span>{farmer.mainStock.toLocaleString()}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="pr-6">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" asChild>
                                                        <Link href={isAdminView ? `/admin/organizations/${orgId}/farmers/${farmer.id}` : `/management/farmers/${farmer.id}`}>
                                                            <ArrowRight className="h-4 w-4 text-slate-400" />
                                                        </Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </ScrollArea>
                    </div>
                </Card>

                {/* Right Column: AI Risk Watchdog */}
                <div className="space-y-6">
                    {/* Risk Watchdog Card */}
                    <Card className={`shadow-sm relative overflow-hidden transition-all duration-500 ${assessment?.risks.length
                        ? "border-red-100 bg-red-50/30"
                        : "border-emerald-100 bg-emerald-50/20"
                        }`}>
                        <CardHeader className="pb-3 border-b border-black/5">
                            <CardTitle className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider">
                                {isScanning ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                                ) : assessment?.risks.length ? (
                                    <AlertTriangle className="h-4 w-4 text-red-500" />
                                ) : (
                                    <ShieldAlert className="h-4 w-4 text-emerald-500" />
                                )}
                                <span className={assessment?.risks.length ? "text-red-900" : "text-emerald-900"}>
                                    Smart Watchdog
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 min-h-[140px] relative">
                            {!isPro ? (
                                <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4">
                                    <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-2">
                                        <Lock className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-sm font-bold text-slate-900 mb-1">Smart Watchdog Locked</h3>
                                    <p className="text-xs text-slate-500 mb-3 max-w-[200px]">
                                        Automated risk detection is a Pro feature.
                                    </p>
                                    <Button
                                        size="sm"
                                        onClick={handleRequestAccess}
                                        disabled={requestAccessMutation.isPending || hasRequested || isLoadingStatus || isApprovedInDb}
                                        className={`w-full max-w-[180px] h-8 text-xs ${hasRequested ? "bg-slate-100 text-slate-500 hover:bg-slate-200" :
                                            "bg-emerald-600 hover:bg-emerald-700 text-white"
                                            }`}
                                    >
                                        {requestAccessMutation.isPending || isLoadingStatus ? (
                                            <Loader2 className="animate-spin h-3 w-3 mr-2" />
                                        ) : isApprovedInDb ? (
                                            <CheckCircle2 className="h-3 w-3 mr-2" />
                                        ) : hasRequested ? (
                                            <Clock className="h-3 w-3 mr-2" />
                                        ) : (
                                            <Sparkles className="h-3 w-3 mr-2" />
                                        )}
                                        {isLoadingStatus ? "Checking..." : isApprovedInDb ? "Approved (Refresh)" : hasRequested ? "Requested" : "Unlock Watchdog"}
                                    </Button>
                                </div>
                            ) : null}

                            {isScanning ? (
                                <div className="space-y-3 p-1">
                                    <div className="flex items-center gap-2 text-xs text-slate-500 font-mono">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                        Scanning cycle logs...
                                    </div>
                                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-500/50 w-1/3 animate-loading-bar" />
                                    </div>
                                    <p className="text-xs text-slate-400">Analyzing mortality trends & feed intake...</p>
                                </div>
                            ) : assessment ? (
                                <div className="space-y-4">
                                    <p className={`text-sm font-medium leading-relaxed ${assessment.risks.length ? "text-red-900" : "text-emerald-900"
                                        }`}>
                                        {assessment.summary}
                                    </p>

                                    {assessment.risks.length > 0 && (
                                        <div className="space-y-2">
                                            {assessment.risks.map((risk, i) => (
                                                <div key={i} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="font-bold text-xs text-slate-900">{risk.farmer}</span>
                                                        <Badge className={
                                                            risk.level === "CRITICAL" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                                                        }>{risk.level}</Badge>
                                                    </div>
                                                    <p className="text-xs text-slate-600 leading-snug">{risk.message}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-400 italic">Watchdog sleeping.</p>
                            )}
                        </CardContent>
                    </Card>

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
