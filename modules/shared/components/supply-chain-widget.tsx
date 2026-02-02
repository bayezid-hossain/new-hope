"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, ArrowRight, CheckCircle2, Clock, Loader2, Lock, Package, Sparkles, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SupplyChainWidgetProps {
    orgId: string;
    officerId?: string;
    viewMode: "ADMIN" | "OFFICER"; // Admin view (in profile) or Officer Dashboard
}

interface PredictionResult {
    status: "OK" | "WARNING";
    message: string;
    predictions: Array<{
        farmer: string;
        stock: number;
        burnRate: string;
        daysRemaining: string;
        urgency: "CRITICAL" | "HIGH";
    }>;
    aiPlan: {
        suggestedRoute: string[];
        instructions: string;
    } | null;
}

export const SupplyChainWidget = ({ orgId, officerId, viewMode }: SupplyChainWidgetProps) => {
    const trpc = useTRPC();
    const [result, setResult] = useState<PredictionResult | null>(null);
    const [showDetails, setShowDetails] = useState(false);

    const { data: session } = authClient.useSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session?.user as any;
    const isPro = user?.isPro || user?.globalRole === "ADMIN";

    const { mutate: predict, isPending } = useMutation(
        trpc.ai.generateSupplyChainPrediction.mutationOptions({
            onSuccess: (data: any) => {
                setResult(data);
            },
            onError: (err) => {
                console.error(err);
                toast.error("Failed to load supply chain data");
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
        ...trpc.officer.getMyRequestStatus.queryOptions({ feature: "PRO_PACK" }),
        enabled: !isPro && !!user
    });

    const hasRequested = requestStatus?.status === "PENDING";
    const isApprovedInDb = (requestStatus?.status === "APPROVED") && isPro;

    const handleRequestAccess = () => {
        requestAccessMutation.mutate({ feature: "PRO_PACK" });
    };

    useEffect(() => {
        if (isPro && orgId) {
            predict({ orgId, officerId });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [orgId, officerId, isPro]);

    // Officer Dashboard View (Compact/Widget style) vs Admin View (Detailed)
    const isCompact = viewMode === "OFFICER";

    return (
        <Card className={`shadow-sm border-indigo-100 bg-gradient-to-br from-white to-indigo-50/20 relative overflow-hidden ${isCompact ? "col-span-1" : "w-full"}`}>
            <div className="absolute top-0 right-0 p-3 opacity-5">
                <Truck className="h-24 w-24 text-indigo-900" />
            </div>

            <CardHeader className="pb-2 border-b border-indigo-100/50">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-900 text-sm font-bold uppercase tracking-wider">
                        <Package className="h-4 w-4 text-indigo-600" />
                        Supply Chain Predictor
                    </div>
                    {isPending && <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />}
                </CardTitle>
            </CardHeader>

            <CardContent className="pt-4 h-[250px] relative">
                {!isPro ? (
                    <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex flex-col items-center justify-center text-center p-4 space-y-3">
                        <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 mb-2">
                            <Lock className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-slate-900">Pro Feature Locked</h3>
                            <p className="text-xs text-slate-500 max-w-[200px] mx-auto mt-1">
                                Pro-exclusive supply chain predictions are available for Pro officers only.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={handleRequestAccess}
                            disabled={requestAccessMutation.isPending || hasRequested || isLoadingStatus || isApprovedInDb}
                            className={`w-full max-w-[200px] shadow-sm text-xs h-8 ${hasRequested ? "bg-slate-100 text-slate-500 hover:bg-slate-200" :
                                "bg-indigo-600 hover:bg-indigo-700 text-white"
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
                            {isLoadingStatus ? "Checking..." : isApprovedInDb ? "Approved (Refresh)" : hasRequested ? "Access Requested" : "Unlock with Pro"}
                        </Button>
                    </div>
                ) : null}

                {isPending ? (
                    <div className="space-y-3">
                        <div className="h-2 bg-indigo-50 rounded-full w-3/4 animate-pulse" />
                        <div className="h-2 bg-indigo-50 rounded-full w-1/2 animate-pulse" />
                    </div>
                ) : result?.status === "OK" ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                        <div className="h-12 w-12 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 shadow-sm">
                            <Truck className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-indigo-900 font-bold text-sm">Supply Chain Healthy</p>
                            <p className="text-indigo-700/70 text-xs mt-1 px-4">
                                No immediate stockout risks detected. All farmers have sufficient feed for at least 4 days.
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => predict({ orgId, officerId })}
                            disabled={isPending}
                            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 h-7 text-xs"
                        >
                            <Sparkles className="h-3 w-3 mr-1.5" />
                            Refresh Prediction
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-start gap-2 bg-red-50 p-3 rounded-md border border-red-100">
                            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-red-900">
                                    {result?.predictions.length} Critical Stockouts Predicted
                                </p>
                                <p className="text-[10px] text-red-700 mt-1">
                                    Action required immediately to prevent production gaps.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {result?.predictions.slice(0, 3).map((p, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-xs font-medium text-slate-700">
                                        <span>{p.farmer}</span>
                                        <span className={p.urgency === "CRITICAL" ? "text-red-600 font-bold" : "text-amber-600"}>
                                            {p.daysRemaining} days left
                                        </span>
                                    </div>
                                    <Progress value={Math.max(5, (parseFloat(p.daysRemaining) / 4) * 100)} className={`h-1.5 ${p.urgency === "CRITICAL" ? "bg-red-100" : "bg-amber-100"}`} />
                                </div>
                            ))}
                        </div>

                        {result?.aiPlan && (
                            <div className="bg-white/60 p-3 rounded border border-indigo-100 mt-2">
                                <p className="text-[10px] uppercase font-bold text-indigo-400 mb-1 flex items-center gap-1">
                                    <Truck className="h-3 w-3" /> AI Logistics Plan
                                </p>
                                <p className="text-xs text-slate-600 italic leading-relaxed">
                                    "{result.aiPlan.instructions}"
                                </p>
                            </div>
                        )}

                        {viewMode === "ADMIN" && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDetails(true)}
                                className="w-full text-indigo-600 text-xs h-7 hover:bg-indigo-50 hover:text-indigo-700"
                            >
                                View Logistics Details <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                        )}
                    </div>
                )}

            </CardContent>

            <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogContent className="w-[95vw] sm:max-w-[90vw] lg:max-w-4xl p-0 overflow-hidden border-none shadow-2xl bg-slate-50/80 backdrop-blur-xl premium-scrollbar">
                    {/* Premium Header */}
                    <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-6 md:p-8 text-white relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none hidden sm:block">
                            <Truck className="h-40 w-40 rotate-12" />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-3 text-white">
                                <div className="h-10 w-10 md:h-12 md:w-12 bg-white/20 backdrop-blur-md rounded-xl md:rounded-2xl flex items-center justify-center shadow-inner">
                                    <Truck className="h-6 w-6 md:h-7 md:w-7 text-white" />
                                </div>
                                Supply Chain Analytics
                            </DialogTitle>
                            <p className="text-indigo-100 text-xs md:text-sm mt-2 max-w-xl font-medium leading-relaxed">
                                Real-time stockout risk assessment and logistics optimization based on current bird age, mortality rates, and recent feed consumption trends.
                            </p>
                        </DialogHeader>
                    </div>

                    <ScrollArea className="max-h-[70vh] w-full [&>[data-radix-scroll-area-viewport]]:scroll-smooth">
                        <div className="p-4 md:p-8 space-y-6 md:space-y-8">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-red-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-red-50 rounded-bl-full -mr-8 -mt-8 opacity-40 transition-transform group-hover:scale-110" />
                                    <p className="text-[10px] md:text-[11px] font-black text-red-500 uppercase tracking-widest mb-2 md:mb-3">Critical Risks</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-3xl md:text-4xl font-black text-slate-900 leading-none">
                                            {result?.predictions.filter(p => p.urgency === "CRITICAL").length || 0}
                                        </p>
                                        <span className="text-xs md:text-sm text-slate-400 font-bold uppercase tracking-tight">Immediate</span>
                                    </div>
                                    <div className="mt-3 md:mt-4 flex items-center gap-2 text-[10px] md:text-[11px] text-red-700 font-bold bg-red-50/50 py-1.5 px-3 rounded-full w-fit">
                                        <AlertCircle className="h-3.5 w-3.5" /> Data Refresh: Just now
                                    </div>
                                </div>

                                <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-amber-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-amber-50 rounded-bl-full -mr-8 -mt-8 opacity-40 transition-transform group-hover:scale-110" />
                                    <p className="text-[10px] md:text-[11px] font-black text-amber-500 uppercase tracking-widest mb-2 md:mb-3">High Alert</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-3xl md:text-4xl font-black text-slate-900 leading-none">
                                            {result?.predictions.filter(p => p.urgency === "HIGH").length || 0}
                                        </p>
                                        <span className="text-xs md:text-sm text-slate-400 font-bold uppercase tracking-tight">Warning</span>
                                    </div>
                                    <div className="mt-3 md:mt-4 flex items-center gap-2 text-[10px] md:text-[11px] text-amber-700 font-bold bg-amber-50/50 py-1.5 px-3 rounded-full w-fit">
                                        <Clock className="h-3.5 w-3.5" /> &lt; 4 Days Left
                                    </div>
                                </div>

                                <div className="bg-white p-5 md:p-6 rounded-2xl md:rounded-3xl border border-indigo-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-indigo-50 rounded-bl-full -mr-8 -mt-8 opacity-40 transition-transform group-hover:scale-110" />
                                    <p className="text-[10px] md:text-[11px] font-black text-indigo-500 uppercase tracking-widest mb-2 md:mb-3">Total Exposure</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-3xl md:text-4xl font-black text-slate-900 leading-none">
                                            {result?.predictions.length || 0}
                                        </p>
                                        <span className="text-xs md:text-sm text-slate-400 font-bold uppercase tracking-tight">Active</span>
                                    </div>
                                    <div className="mt-3 md:mt-4 flex items-center gap-2 text-[10px] md:text-[11px] text-indigo-700 font-bold bg-indigo-50/50 py-1.5 px-3 rounded-full w-fit">
                                        <Package className="h-3.5 w-3.5" /> Unit Capacity: OK
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Stock Table */}
                            <div className="bg-white rounded-2xl md:rounded-[2rem] border border-slate-200/60 shadow-xl shadow-slate-200/20 overflow-hidden">
                                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/30">
                                    <h4 className="font-black text-slate-900 text-lg flex items-center gap-2">
                                        Vulnerable Farmers
                                        <Badge className="bg-indigo-100 text-indigo-700 border-none font-black text-[10px] px-2 h-5">
                                            {result?.predictions.length || 0}
                                        </Badge>
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-bold uppercase tracking-wider">
                                        <Sparkles className="h-3.5 w-3.5 text-indigo-400" /> AI Insights Active
                                    </div>
                                </div>
                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto premium-scrollbar pb-2">
                                    <Table className="min-w-[700px] md:min-w-full">
                                        <TableHeader className="bg-slate-50/50 border-b border-slate-100">
                                            <TableRow className="hover:bg-transparent border-none">
                                                <TableHead className="font-black text-[10px] uppercase text-slate-400 tracking-[0.1em] py-5 px-4 md:px-8">Farmer Entry</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase text-slate-400 tracking-[0.1em] py-5">Current Stock</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase text-slate-400 tracking-[0.1em] py-5 text-right">Daily Burn</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase text-slate-400 tracking-[0.1em] py-5 text-right">Est. Survival</TableHead>
                                                <TableHead className="font-black text-[10px] uppercase text-slate-400 tracking-[0.1em] py-5 text-center px-4 md:px-8">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="divide-y divide-slate-50">
                                            {result?.predictions.map((p, i) => (
                                                <TableRow key={i} className="hover:bg-slate-50/80 transition-all duration-300 group border-none">
                                                    <TableCell className="py-4 md:py-6 px-4 md:px-8">
                                                        <div className="flex flex-col">
                                                            <span className="font-black text-slate-900 group-hover:text-indigo-600 transition-colors">{p.farmer}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Active Unit</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-6">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-2 rounded-xl ${p.stock <= 2 ? 'bg-red-50' : 'bg-slate-50'} group-hover:scale-105 transition-transform`}>
                                                                <Package className={`h-4 w-4 ${p.stock <= 2 ? 'text-red-500' : 'text-slate-400'}`} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={`text-lg font-black leading-none ${p.stock <= 2 ? 'text-red-600' : 'text-slate-900'}`}>
                                                                    {p.stock.toFixed(1)}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Bags Remaining</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-6">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-base font-black text-slate-800 leading-none">{p.burnRate}</span>
                                                            <span className="text-[10px] text-slate-400 font-bold uppercase mt-1">Units / Day</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-6">
                                                        <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl font-black text-sm shadow-sm border ${parseFloat(p.daysRemaining) < 1.5
                                                            ? 'bg-red-50 text-red-600 border-red-100 shadow-red-100/50'
                                                            : 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/50'
                                                            }`}>
                                                            {parseFloat(p.daysRemaining) === 0 ? "OUT" : `${p.daysRemaining}d`}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center py-4 md:py-6 px-4 md:px-8">
                                                        <Badge className={`font-black text-[9px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-full shadow-sm hover:scale-105 transition-transform border-none ${p.urgency === "CRITICAL"
                                                            ? "bg-gradient-to-r from-red-500 to-rose-600 text-white"
                                                            : "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                                                            }`}>
                                                            {p.urgency}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <ScrollBar orientation="horizontal" className="pt-2" />
                                </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden divide-y divide-slate-100">
                                    {result?.predictions.map((p, i) => (
                                        <div key={i} className="p-5 space-y-4 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 text-base">{p.farmer}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Active Unit</span>
                                                </div>
                                                <Badge className={`font-black text-[9px] uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border-none ${p.urgency === "CRITICAL"
                                                    ? "bg-gradient-to-r from-red-500 to-rose-600 text-white"
                                                    : "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                                                    }`}>
                                                    {p.urgency}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Package className={`h-3.5 w-3.5 ${p.stock <= 2 ? 'text-red-500' : 'text-slate-400'}`} />
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Stock</span>
                                                    </div>
                                                    <p className={`text-lg font-black ${p.stock <= 2 ? 'text-red-600' : 'text-slate-900'}`}>
                                                        {p.stock.toFixed(1)} <span className="text-[10px] font-bold text-slate-400">Bags</span>
                                                    </p>
                                                </div>
                                                <div className="bg-slate-50/50 p-3 rounded-2xl border border-slate-100">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Survival</span>
                                                    </div>
                                                    <p className={`text-lg font-black ${parseFloat(p.daysRemaining) < 1.5 ? 'text-red-600' : 'text-amber-600'}`}>
                                                        {parseFloat(p.daysRemaining) === 0 ? "OUT" : `${p.daysRemaining}d`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] bg-indigo-50/30 p-3 rounded-xl border border-indigo-100/50">
                                                <span className="font-bold text-indigo-900/60 uppercase tracking-wider">Daily Burn Rate</span>
                                                <span className="font-black text-indigo-900">{p.burnRate} Units / Day</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </Card>
    );
};
