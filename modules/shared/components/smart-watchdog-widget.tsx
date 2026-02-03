"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
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
    const isApprovedInDb = (requestStatus?.status === "APPROVED") && isPro;

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
        <Card className={cn(
            "shadow-sm relative overflow-hidden transition-all duration-500 border-border/50",
            assessment?.risks.length
                ? "bg-destructive/5 dark:bg-destructive/10"
                : "bg-primary/5 dark:bg-primary/5",
            className
        )}>
            <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em]">
                    {isScanning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : assessment?.risks.length ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                        <ShieldAlert className="h-3.5 w-3.5 text-primary" />
                    )}
                    <span className={assessment?.risks.length ? "text-destructive" : "text-primary"}>
                        Smart Watchdog
                    </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 min-h-[140px] relative">
                {!isPro ? (
                    <div className="absolute inset-0 z-10 bg-background/40 dark:bg-background/60 backdrop-blur-[6px] flex flex-col items-center justify-center text-center p-4">
                        <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-3 shadow-inner">
                            <Lock className="h-5 w-5" />
                        </div>
                        <h3 className="text-sm font-bold text-foreground mb-1">PRO ACCESS REQUIRED</h3>
                        <p className="text-[11px] text-muted-foreground mb-4 max-w-[200px] leading-relaxed">
                            AI-driven mortality trends and automated risk analysis is a Pro feature.
                        </p>
                        <Button
                            size="sm"
                            onClick={handleRequestAccess}
                            disabled={requestAccessMutation.isPending || hasRequested || isLoadingStatus || isApprovedInDb}
                            className={cn(
                                "w-full max-w-[180px] h-9 text-xs font-bold rounded-xl transition-all shadow-sm",
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
                            {isLoadingStatus ? "Checking..." : isApprovedInDb ? "Approved (Refresh)" : hasRequested ? "Requested" : "Unlock Watchdog"}
                        </Button>
                    </div>
                ) : null}

                {isScanning ? (
                    <div className="space-y-3 p-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Scanning cycle logs...
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary/50 w-1/3 animate-loading-bar" />
                        </div>
                        <p className="text-xs text-muted-foreground/70">Analyzing mortality trends & feed intake...</p>
                    </div>
                ) : assessment ? (
                    <div className="space-y-4">
                        <p className={cn(
                            "text-sm font-bold leading-relaxed",
                            assessment.risks.length ? "text-destructive" : "text-primary"
                        )}>
                            {assessment.summary}
                        </p>

                        {assessment.risks.length > 0 && (
                            <div className="space-y-2">
                                {assessment.risks.map((risk, i) => (
                                    <div key={i} className="bg-card/50 dark:bg-card/30 p-3 rounded-xl border border-border/50 shadow-sm backdrop-blur-sm">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="font-black text-[11px] uppercase tracking-tight">{risk.farmer}</span>
                                            <Badge variant={risk.level === "CRITICAL" ? "destructive" : "secondary"} className={cn(
                                                "font-black text-[9px] uppercase tracking-wider px-2 py-0.5",
                                                risk.level === "CRITICAL"
                                                    ? "bg-destructive/10 text-destructive border-destructive/20"
                                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20"
                                            )}>{risk.level}</Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">{risk.message}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                        <div className="h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center text-primary shadow-sm border border-primary/20">
                            <CheckCircle2 className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-primary font-black text-[11px] uppercase tracking-[0.2em]">All Systems Nominal</p>
                            <p className="text-muted-foreground text-[11px] mt-2 px-6 leading-relaxed font-medium">
                                No immediate mortality or growth risks detected in current production cycles.
                            </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => runRiskScan({ orgId, officerId })}
                            disabled={isScanning}
                            className="text-primary hover:text-primary/90 hover:bg-primary/10 h-7 text-xs"
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
