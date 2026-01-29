"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
    const isApprovedInDb = requestStatus?.status === "APPROVED";

    const handleRequestAccess = () => {
        requestAccessMutation.mutate({ feature: "PRO_PACK" });
    };

    useEffect(() => {
        if (!result && !isPending && isPro) {
            predict({ orgId, officerId });
        }
    }, [orgId, officerId, result, isPending, predict, isPro]);

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
                                AI-powered supply chain predictions are available for Pro officers only.
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
                    <div className="flex flex-col items-center justify-center py-4 text-center space-y-2">
                        <div className="h-10 w-10 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600">
                            <Truck className="h-5 w-5" />
                        </div>
                        <p className="text-emerald-900 font-medium text-sm">Supply Chain Healthy</p>
                        <p className="text-emerald-700/70 text-xs">No stockouts predicted for next 4 days.</p>
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
                            <Button variant="ghost" size="sm" className="w-full text-indigo-600 text-xs h-7 hover:bg-indigo-50 hover:text-indigo-700">
                                View Logistics Details <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
