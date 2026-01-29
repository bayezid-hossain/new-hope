"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Lock, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface SmartWatchdogWidgetProps {
    orgId: string;
    officerId?: string;
    className?: string;
}

interface RiskAssessment {
    summary: string;
    risks: Array<{
        farmer: string;
        level: "CRITICAL" | "WARNING";
        message: string;
    }>;
}

export const SmartWatchdogWidget = ({ orgId, officerId, className }: SmartWatchdogWidgetProps) => {
    const trpc = useTRPC();
    const [assessment, setAssessment] = useState<RiskAssessment | null>(null);

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
        ...trpc.officer.getMyRequestStatus.queryOptions({ feature: "PRO_PACK" }),
        enabled: !isPro && !!user
    });

    const hasRequested = requestStatus?.status === "PENDING";
    const isApprovedInDb = requestStatus?.status === "APPROVED";

    const handleRequestAccess = () => {
        requestAccessMutation.mutate({ feature: "PRO_PACK" });
    };

    useEffect(() => {
        if (!assessment && !isScanning && isPro && orgId) {
            runRiskScan({
                orgId,
                officerId
            });
        }
    }, [assessment, isScanning, runRiskScan, orgId, officerId, isPro]);

    return (
        <Card className={`shadow-sm relative overflow-hidden transition-all duration-500 ${assessment?.risks.length
            ? "border-red-100 bg-red-50/30"
            : "border-emerald-100 bg-emerald-50/20"
            } ${className}`}>
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
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-3">
                        <div className="h-12 w-12 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 shadow-sm">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-emerald-900 font-bold text-sm">System Secure</p>
                            <p className="text-emerald-700/70 text-xs mt-1 px-4">
                                Smart Watchdog has not detected any immediate mortality or growth risks in the last scan.
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => runRiskScan({ orgId, officerId })}
                            disabled={isScanning}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 h-7 text-xs"
                        >
                            <Sparkles className="h-3 w-3 mr-1.5" />
                            Run New Scan
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
