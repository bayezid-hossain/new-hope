"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
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
        farmerId: string;
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

    const getFarmerLink = (farmerId: string) => {
        if (user?.globalRole === "ADMIN") {
            return `/admin/organizations/${orgId}/farmers/${farmerId}`;
        }
        if (viewMode === "ADMIN") {
            return `/management/farmers/${farmerId}`;
        }
        return `/farmers/${farmerId}`;
    };

    return (
        <Card className={cn(
            "shadow-sm relative overflow-hidden border-border/50 transition-all duration-500",
            "bg-gradient-to-br from-card via-card to-primary/5 dark:to-primary/10",
            isCompact ? "col-span-1" : "w-full"
        )}>
            <div className="absolute top-0 right-0 p-3 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                <Truck className="h-24 w-24 text-primary" />
            </div>

            <CardHeader className="pb-2 border-b border-border/50">
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-primary text-[11px] font-black uppercase tracking-[0.1em]">
                        <Package className="h-3.5 w-3.5" />
                        Supply Chain Predictor
                    </div>
                    {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                </CardTitle>
            </CardHeader>

            <CardContent className="pt-4 h-[250px] relative">
                {!isPro ? (
                    <div className="absolute inset-0 z-10 bg-background/40 dark:bg-background/60 backdrop-blur-[6px] flex flex-col items-center justify-center text-center p-4 space-y-3">
                        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2 shadow-inner">
                            <Lock className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-foreground">PRO FEATURES LOCKED</h3>
                            <p className="text-[11px] text-muted-foreground max-w-[200px] mx-auto mt-1 leading-relaxed">
                                Advanced supply chain forecasting and AI route optimization requires a Pro plan.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={handleRequestAccess}
                            disabled={requestAccessMutation.isPending || hasRequested || isLoadingStatus || isApprovedInDb}
                            className={cn(
                                "w-full max-w-[200px] shadow-sm text-xs font-bold h-9 rounded-xl transition-all",
                                hasRequested
                                    ? "bg-muted text-muted-foreground hover:bg-muted/80"
                                    : "bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105 active:scale-95"
                            )}
                        >
                            {requestAccessMutation.isPending || isLoadingStatus ? (
                                <Loader2 className="animate-spin h-3.5 w-3.5 mr-2" />
                            ) : isApprovedInDb ? (
                                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                            ) : hasRequested ? (
                                <Clock className="h-3.5 w-3.5 mr-2" />
                            ) : (
                                <Sparkles className="h-3.5 w-3.5 mr-2" />
                            )}
                            {isLoadingStatus ? "Checking..." : isApprovedInDb ? "Approved (Refresh)" : hasRequested ? "Access Requested" : "Unlock with Pro"}
                        </Button>
                    </div>
                ) : null}

                {isPending ? (
                    <div className="space-y-3">
                        <div className="h-2 bg-primary/10 rounded-full w-3/4 animate-pulse" />
                        <div className="h-2 bg-primary/10 rounded-full w-1/2 animate-pulse" />
                    </div>
                ) : result?.status === "OK" ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-sm border border-primary/20">
                            <Truck className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-primary font-black text-[11px] uppercase tracking-[0.2em]">Logistics Healthy</p>
                            <p className="text-muted-foreground text-[11px] mt-2 px-6 leading-relaxed font-medium">
                                No immediate stockout risks detected. All monitored units have sufficient feed for current consumption.
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => predict({ orgId, officerId })}
                            disabled={isPending}
                            className="text-primary hover:text-primary/90 hover:bg-primary/10 h-7 text-xs font-bold rounded-lg"
                        >
                            <Sparkles className="h-3 w-3 mr-1.5" />
                            Refresh Prediction
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex items-start gap-2 bg-destructive/10 p-3 rounded-md border border-destructive/20">
                            <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-destructive">
                                    {result?.predictions.length} Critical Stockouts Predicted
                                </p>
                                <p className="text-[10px] text-destructive/80 mt-1">
                                    Action required immediately to prevent production gaps.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {result?.predictions.slice(0, 3).map((p, i) => (
                                <div key={i} className="space-y-1">
                                    <div className="flex justify-between text-xs font-medium">
                                        <span>{p.farmer}</span>
                                        <span className={p.urgency === "CRITICAL" ? "text-destructive font-bold" : "text-amber-600"}>
                                            {p.daysRemaining} days left
                                        </span>
                                    </div>
                                    <Progress value={Math.max(5, (parseFloat(p.daysRemaining) / 4) * 100)} className={`h-1.5 ${p.urgency === "CRITICAL" ? "bg-destructive/10" : "bg-amber-500/10"}`} />
                                </div>
                            ))}
                        </div>

                        {result?.aiPlan && (
                            <div className="bg-muted/30 dark:bg-muted/20 p-3 rounded-xl border border-border/50 mt-2 backdrop-blur-sm">
                                <p className="text-[10px] uppercase font-black text-primary/70 mb-1.5 flex items-center gap-1.5 tracking-wider">
                                    <Sparkles className="h-3 w-3 text-primary" /> AI Logistics Insight
                                </p>
                                <p className="text-[11px] text-muted-foreground italic leading-relaxed font-medium">
                                    "{result.aiPlan.instructions}"
                                </p>
                            </div>
                        )}

                        {viewMode === "ADMIN" && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowDetails(true)}
                                className="w-full text-primary text-[11px] font-black h-8 hover:bg-primary/10 hover:text-primary/90 uppercase tracking-wider rounded-xl transition-all"
                            >
                                Logistics Intelligence <ArrowRight className="h-3 w-3 ml-2" />
                            </Button>
                        )}
                    </div>
                )}

            </CardContent>

            <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogContent className="w-[95vw] sm:max-w-[90vw] lg:max-w-4xl p-0 overflow-hidden border-border/50 shadow-2xl bg-card/95 backdrop-blur-2xl premium-scrollbar rounded-3xl">
                    {/* Premium Header */}
                    <div className="bg-gradient-to-br from-primary via-primary/95 to-primary/80 dark:from-sidebar-management-from dark:to-sidebar-management-to p-6 md:p-10 text-primary-foreground relative border-b border-border/10">
                        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none hidden sm:block">
                            <Truck className="h-48 w-48 rotate-12" />
                        </div>
                        <DialogHeader>
                            <DialogTitle className="text-2xl md:text-4xl font-black tracking-tighter flex items-center gap-4">
                                <div className="h-12 w-12 md:h-14 md:w-14 bg-primary-foreground/20 backdrop-blur-xl rounded-2xl md:rounded-[1.5rem] flex items-center justify-center shadow-inner border border-primary-foreground/10">
                                    <Truck className="h-7 w-7 md:h-8 md:w-8 text-primary-foreground" />
                                </div>
                                <span className="uppercase tracking-tighter">Supply Chain Intelligence</span>
                            </DialogTitle>
                            <p className="text-primary-foreground/70 text-xs md:text-sm mt-4 max-w-2xl font-bold leading-relaxed uppercase tracking-wide">
                                Real-time predictive analytics: Mapping stockout risks through feed burn rates and bird age metrics.
                            </p>
                        </DialogHeader>
                    </div>

                    <ScrollArea className="max-h-[70vh] w-full [&>[data-radix-scroll-area-viewport]]:scroll-smooth">
                        <div className="p-4 md:p-8 space-y-6 md:space-y-8">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-card p-5 md:p-6 rounded-2xl md:rounded-3xl border border-destructive/20 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-destructive/10 rounded-bl-full -mr-8 -mt-8 opacity-40 transition-transform group-hover:scale-110" />
                                    <p className="text-[10px] md:text-[11px] font-black text-destructive uppercase tracking-widest mb-2 md:mb-3">Critical Risks</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-3xl md:text-4xl font-black leading-none">
                                            {result?.predictions.filter(p => p.urgency === "CRITICAL").length || 0}
                                        </p>
                                        <span className="text-xs md:text-sm text-muted-foreground font-bold uppercase tracking-tight">Immediate</span>
                                    </div>
                                    <div className="mt-3 md:mt-4 flex items-center gap-2 text-[10px] md:text-[11px] text-destructive font-bold bg-destructive/10 py-1.5 px-3 rounded-full w-fit">
                                        <AlertCircle className="h-3.5 w-3.5" /> Data Refresh: Just now
                                    </div>
                                </div>

                                <div className="bg-card p-5 md:p-6 rounded-2xl md:rounded-3xl border border-amber-500/20 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-amber-500/10 rounded-bl-full -mr-8 -mt-8 opacity-40 transition-transform group-hover:scale-110" />
                                    <p className="text-[10px] md:text-[11px] font-black text-amber-500 uppercase tracking-widest mb-2 md:mb-3">High Alert</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-3xl md:text-4xl font-black leading-none">
                                            {result?.predictions.filter(p => p.urgency === "HIGH").length || 0}
                                        </p>
                                        <span className="text-xs md:text-sm text-muted-foreground font-bold uppercase tracking-tight">Warning</span>
                                    </div>
                                    <div className="mt-3 md:mt-4 flex items-center gap-2 text-[10px] md:text-[11px] text-amber-600 font-bold bg-amber-500/10 py-1.5 px-3 rounded-full w-fit">
                                        <Clock className="h-3.5 w-3.5" /> &lt; 4 Days Left
                                    </div>
                                </div>

                                <div className="bg-card p-5 md:p-6 rounded-2xl md:rounded-3xl border border-primary/20 shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
                                    <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-primary/10 rounded-bl-full -mr-8 -mt-8 opacity-40 transition-transform group-hover:scale-110" />
                                    <p className="text-[10px] md:text-[11px] font-black text-primary uppercase tracking-widest mb-2 md:mb-3">Total Exposure</p>
                                    <div className="flex items-baseline gap-2">
                                        <p className="text-3xl md:text-4xl font-black leading-none">
                                            {result?.predictions.length || 0}
                                        </p>
                                        <span className="text-xs md:text-sm text-muted-foreground font-bold uppercase tracking-tight">Active</span>
                                    </div>
                                    <div className="mt-3 md:mt-4 flex items-center gap-2 text-[10px] md:text-[11px] text-primary font-bold bg-primary/10 py-1.5 px-3 rounded-full w-fit">
                                        <Package className="h-3.5 w-3.5" /> Unit Capacity: OK
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Stock Table */}
                            <div className="bg-card rounded-2xl md:rounded-[2rem] border border-border/50 shadow-xl overflow-hidden">
                                <div className="p-6 border-b border-border flex items-center justify-between bg-muted/30">
                                    <h4 className="font-black text-lg flex items-center gap-2">
                                        Vulnerable Farmers
                                        <Badge className="bg-primary/20 text-primary border-none font-black text-[10px] px-2 h-5">
                                            {result?.predictions.length || 0}
                                        </Badge>
                                    </h4>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold uppercase tracking-wider">
                                        <Sparkles className="h-3.5 w-3.5 text-primary/70" /> AI Insights Active
                                    </div>
                                </div>
                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto premium-scrollbar pb-2">
                                    <Table className="min-w-[700px] md:min-w-full">
                                        <TableHeader className="bg-muted/10 border-b border-border/50">
                                            <TableRow className="hover:bg-transparent border-none">
                                                <TableHead className="font-black text-[10px] md:text-[11px] uppercase text-muted-foreground tracking-[0.2em] py-6 px-4 md:px-8">Farmer Entry</TableHead>
                                                <TableHead className="font-black text-[10px] md:text-[11px] uppercase text-muted-foreground tracking-[0.2em] py-6">Current Stock</TableHead>
                                                <TableHead className="font-black text-[10px] md:text-[11px] uppercase text-muted-foreground tracking-[0.2em] py-6 text-right">Daily Burn</TableHead>
                                                <TableHead className="font-black text-[10px] md:text-[11px] uppercase text-muted-foreground tracking-[0.2em] py-6 text-right">Est. Survival</TableHead>
                                                <TableHead className="font-black text-[10px] md:text-[11px] uppercase text-muted-foreground tracking-[0.2em] py-6 text-center px-4 md:px-8">Status</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody className="divide-y divide-border/30">
                                            {result?.predictions.map((p, i) => (
                                                <TableRow
                                                    key={i}
                                                    className="hover:bg-primary/5 transition-all duration-300 group border-none cursor-pointer"
                                                    onClick={() => window.location.href = getFarmerLink(p.farmerId)}
                                                >
                                                    <TableCell className="py-4 md:py-6 px-4 md:px-8">
                                                        <div className="flex flex-col">
                                                            <span className="font-black group-hover:text-primary transition-colors uppercase tracking-tight">{p.farmer}</span>
                                                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Active Unit</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-6">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`p-2 rounded-xl ${p.stock <= 2 ? 'bg-destructive/10' : 'bg-muted'} group-hover:scale-105 transition-transform`}>
                                                                <Package className={`h-4 w-4 ${p.stock <= 2 ? 'text-destructive' : 'text-muted-foreground'}`} />
                                                            </div>
                                                            <div className="flex flex-col">
                                                                <span className={`text-lg font-black leading-none ${p.stock <= 2 ? 'text-destructive' : ''}`}>
                                                                    {p.stock.toFixed(1)}
                                                                </span>
                                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter mt-1">Bags Remaining</span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-6">
                                                        <div className="flex flex-col items-end">
                                                            <span className="text-base font-black leading-none">{p.burnRate}</span>
                                                            <span className="text-[10px] text-muted-foreground font-bold uppercase mt-1">Units / Day</span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-right py-6">
                                                        <div className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-2xl font-black text-sm shadow-sm border ${parseFloat(p.daysRemaining) < 1.5
                                                            ? 'bg-destructive/10 text-destructive border-destructive/20'
                                                            : 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20'
                                                            }`}>
                                                            {parseFloat(p.daysRemaining) === 0 ? "OUT" : `${p.daysRemaining}d`}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-center py-4 md:py-6 px-4 md:px-8">
                                                        <Badge className={`font-black text-[9px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-full shadow-sm hover:scale-105 transition-transform border-none ${p.urgency === "CRITICAL"
                                                            ? "bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground"
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
                                <div className="md:hidden divide-y divide-border/30">
                                    {result?.predictions.map((p, i) => (
                                        <div
                                            key={i}
                                            className="p-5 space-y-4 hover:bg-muted/30 transition-colors active:bg-muted/50 cursor-pointer"
                                            onClick={() => window.location.href = getFarmerLink(p.farmerId)}
                                        >
                                            <div className="flex justify-between items-start">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-base">{p.farmer}</span>
                                                    <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">Active Unit</span>
                                                </div>
                                                <Badge className={`font-black text-[9px] uppercase tracking-[0.1em] px-2.5 py-1 rounded-full border-none ${p.urgency === "CRITICAL"
                                                    ? "bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground"
                                                    : "bg-gradient-to-r from-amber-400 to-orange-500 text-white"
                                                    }`}>
                                                    {p.urgency}
                                                </Badge>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-muted/30 p-3 rounded-2xl border border-border">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Package className={`h-3.5 w-3.5 ${p.stock <= 2 ? 'text-destructive' : 'text-muted-foreground'}`} />
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Stock</span>
                                                    </div>
                                                    <p className={`text-lg font-black ${p.stock <= 2 ? 'text-destructive' : ''}`}>
                                                        {p.stock.toFixed(1)} <span className="text-[10px] font-bold text-muted-foreground">Bags</span>
                                                    </p>
                                                </div>
                                                <div className="bg-muted/30 p-3 rounded-2xl border border-border">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                                                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Survival</span>
                                                    </div>
                                                    <p className={`text-lg font-black ${parseFloat(p.daysRemaining) < 1.5 ? 'text-destructive' : 'text-amber-600'}`}>
                                                        {parseFloat(p.daysRemaining) === 0 ? "OUT" : `${p.daysRemaining}d`}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] bg-primary/5 p-3 rounded-xl border border-primary/10">
                                                <span className="font-bold text-muted-foreground uppercase tracking-wider">Daily Burn Rate</span>
                                                <span className="font-black text-primary">{p.burnRate} Units / Day</span>
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
