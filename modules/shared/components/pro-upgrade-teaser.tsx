"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, Lock, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface ProUpgradeTeaserProps {
    title?: string;
    description?: string;
    className?: string;
}

export function ProUpgradeTeaser({
    title = "PRO FEATURE LOCKED",
    description = "This advanced feature requires a Pro subscription for your organization.",
    className
}: ProUpgradeTeaserProps) {
    const trpc = useTRPC();

    // Request Access Mutation
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
    const { data: requestStatus, refetch: refetchStatus, isPending: isLoadingStatus } = useQuery(
        trpc.officer.getMyRequestStatus.queryOptions({ feature: "PRO_PACK" })
    );

    const hasRequested = requestStatus?.status === "PENDING";
    const isApprovedInDb = requestStatus?.status === "APPROVED";

    const handleRequestAccess = () => {
        requestAccessMutation.mutate({ feature: "PRO_PACK" });
    };

    return (
        <div className={cn(
            "flex flex-col items-center justify-center text-center p-8 border border-dashed rounded-3xl bg-muted/5 space-y-4 animate-in fade-in zoom-in duration-300",
            className
        )}>
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mb-2 shadow-inner ring-4 ring-primary/5">
                <Lock className="h-8 w-8" />
            </div>
            <div className="max-w-md space-y-2">
                <h3 className="text-xl font-black text-foreground uppercase tracking-tight">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {description}
                </p>
            </div>
            <Button
                size="lg"
                onClick={handleRequestAccess}
                disabled={requestAccessMutation.isPending || hasRequested || isLoadingStatus || isApprovedInDb}
                className={cn(
                    "w-full max-w-xs shadow-xl text-sm font-black h-12 rounded-2xl transition-all",
                    hasRequested
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105 active:scale-95"
                )}
            >
                {requestAccessMutation.isPending || isLoadingStatus ? (
                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                ) : isApprovedInDb ? (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                ) : hasRequested ? (
                    <Clock className="h-4 w-4 mr-2" />
                ) : (
                    <Sparkles className="h-4 w-4 mr-2" />
                )}
                {isLoadingStatus ? "Checking status..." : isApprovedInDb ? "Access Approved (Reload)" : hasRequested ? "Access Requested" : "Request Pro Access"}
            </Button>

            <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-bold">
                Powerful tools for precision production
            </p>
        </div>
    );
}
