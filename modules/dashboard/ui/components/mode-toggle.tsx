"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Briefcase, ShieldCheck, User, Users } from "lucide-react";
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

    const updateGlobalMode = useMutation(
        trpc.auth.updateGlobalMode.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries(trpc.auth.getSession.queryOptions());
                toast.success("System mode updated");
            }
        })
    );

    const updateOrgMode = useMutation(
        trpc.auth.updateOrgMode.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries(trpc.auth.getMyMembership.queryOptions());
                toast.success("Dashboard mode updated");
            }
        })
    );

    if (!isGlobalAdmin && !isOrgManager) return null;

    return (
        <div className="flex flex-col gap-2 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">View Mode</p>

            <div className="flex flex-col gap-1">
                {isGlobalAdmin && (
                    <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 text-[11px] font-bold gap-1.5 rounded-md transition-all",
                                globalMode === "ADMIN" ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                            )}
                            onClick={() => updateGlobalMode.mutate({ mode: "ADMIN" })}
                        >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            ADMIN
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 text-[11px] font-bold gap-1.5 rounded-md transition-all",
                                globalMode === "USER" ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                            )}
                            onClick={() => updateGlobalMode.mutate({ mode: "USER" })}
                        >
                            <User className="h-3.5 w-3.5" />
                            USER
                        </Button>
                    </div>
                )}

                {isOrgManager && (
                    <div className="grid grid-cols-2 gap-1 bg-white p-1 rounded-lg border border-slate-200 shadow-sm mt-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 text-[11px] font-bold gap-1.5 rounded-md transition-all",
                                orgMode === "MANAGEMENT" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                            )}
                            onClick={() => updateOrgMode.mutate({ mode: "MANAGEMENT" })}
                        >
                            <Briefcase className="h-3.5 w-3.5" />
                            MGT
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "h-8 text-[11px] font-bold gap-1.5 rounded-md transition-all",
                                orgMode === "OFFICER" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                            )}
                            onClick={() => updateOrgMode.mutate({ mode: "OFFICER" })}
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
