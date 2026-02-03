"use client";

import { useLoading } from "@/components/providers/loading-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, ShieldCheck, User, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export const ModeToggle = () => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const { data: sessionData } = useQuery(trpc.auth.getSession.queryOptions());
    const { data: orgStatus } = useQuery(trpc.auth.getMyMembership.queryOptions());

    const isGlobalAdmin = sessionData?.user?.globalRole === "ADMIN";
    const isOrgManager = orgStatus?.role === "OWNER" || orgStatus?.role === "MANAGER";

    const globalMode = sessionData?.user?.activeMode || "USER";
    const orgMode = orgStatus?.activeMode || "OFFICER";

    const router = useRouter();
    const { showLoading, hideLoading } = useLoading();

    const updateGlobalMode = useMutation(
        trpc.auth.updateGlobalMode.mutationOptions({
            onSuccess: async (data, variables) => {
                if (variables.mode === "ADMIN") {
                    // Manually update cache to avoid flicker/race condition
                    queryClient.setQueryData(
                        trpc.auth.getSession.queryKey(),
                        (oldData: any) => {
                            if (!oldData) return oldData;
                            return {
                                ...oldData,
                                user: {
                                    ...oldData.user,
                                    activeMode: "ADMIN"
                                }
                            };
                        }
                    );
                    toast.success("System mode updated");
                    router.push("/admin");
                } else {
                    // Standard behavior for switching back to USER (Officer)
                    await queryClient.invalidateQueries(trpc.auth.getSession.queryOptions());
                    toast.success("System mode updated");
                    router.push("/");
                    // Relying on LoadingProvider auto-hide on pathname change
                }
            },
            onError: () => hideLoading()
        })
    );

    const updateOrgMode = useMutation(
        trpc.auth.updateOrgMode.mutationOptions({
            onSuccess: async (data, variables) => {
                await queryClient.invalidateQueries(trpc.auth.getMyMembership.queryOptions());
                toast.success("Dashboard mode updated");
                if (variables.mode === "MANAGEMENT") {
                    router.push("/management");
                }
                if (variables.mode === "OFFICER") {
                    router.push("/");
                }
                // Relying on LoadingProvider auto-hide on pathname change
            },
            onError: () => hideLoading()
        })
    );

    if (!isGlobalAdmin && !isOrgManager) return null;

    return (
        <div className="flex flex-col gap-2 p-4 dark:bg-black bg-white rounded-xl border border-border">
            <p className="text-[10px] font-bold text-foreground dark:text-white uppercase tracking-widest px-1">View Mode</p>

            <div className="flex flex-col gap-1">
                {isGlobalAdmin && (
                    <div className="grid grid-cols-2 gap-1 bg-card p-1 rounded-lg border border-border shadow-sm">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 text-[11px] font-bold gap-1.5 rounded-md transition-all",
                                globalMode === "ADMIN" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
                            )}
                            onClick={() => {
                                if (globalMode !== "ADMIN") {
                                    showLoading("Switching to Admin...");
                                    updateGlobalMode.mutate({ mode: "ADMIN" });
                                }
                            }}
                        >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            ADMIN
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 text-[11px] font-bold gap-1.5 rounded-md transition-all",
                                globalMode === "USER" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
                            )}
                            onClick={() => {
                                if (globalMode !== "USER") {
                                    showLoading("Switching to Officer...");
                                    updateGlobalMode.mutate({ mode: "USER" });
                                }
                            }}
                        >
                            <User className="h-3.5 w-3.5" />
                            Officer
                        </Button>
                    </div>
                )}

                {isOrgManager && (
                    <div className="grid grid-cols-2 gap-1 bg-card p-1 rounded-lg border border-border shadow-sm mt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 text-[11px] font-bold gap-1.5 rounded-md transition-all",
                                orgMode === "MANAGEMENT" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
                            )}
                            onClick={() => {
                                if (orgMode !== "MANAGEMENT") {
                                    showLoading("Switching to Management...");
                                    updateOrgMode.mutate({ mode: "MANAGEMENT" });
                                }
                            }}
                        >
                            <Briefcase className="h-3.5 w-3.5" />
                            MGT
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 text-[11px] font-bold gap-1.5 rounded-md transition-all",
                                orgMode === "OFFICER" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent"
                            )}
                            onClick={() => {
                                if (orgMode !== "OFFICER") {
                                    showLoading("Switching to Officer...");
                                    updateOrgMode.mutate({ mode: "OFFICER" });
                                }
                            }}
                        >
                            <Users className="h-3.5 w-3.5" />
                            OFFICER
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};
