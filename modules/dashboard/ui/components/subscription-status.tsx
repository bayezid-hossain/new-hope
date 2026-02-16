"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Crown, Zap } from "lucide-react";

interface SubscriptionStatusProps {
    initialSession?: any;
}

export const SubscriptionStatus = ({ initialSession }: SubscriptionStatusProps) => {
    const trpc = useTRPC();
    const { data: sessionData } = useQuery({
        ...trpc.auth.getSession.queryOptions(),
        initialData: initialSession,
    });

    const user = sessionData?.user;
    if (!user) return null;

    const isPro = user.isPro;
    const expiresAt = user.proExpiresAt ? new Date(user.proExpiresAt) : null;

    return (
        <div className="px-1 mb-2">
            <div className="rounded-lg py-2 bg-sidebar-accent/30 border border-border/10 flex items-center justify-between gap-2 overflow-hidden relative group transition-all hover:bg-sidebar-accent/50">
                <div className="flex items-center gap-2 min-w-0 relative z-10">
                    <div className={`shrink-0 p-1.5 rounded-md ${isPro ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-500/10 text-slate-400'}`}>
                        {isPro ? (
                            <Crown className="size-3.5" />
                        ) : (
                            <Zap className="size-3.5" />
                        )}
                    </div>
                    <span className={`text-[11px] font-bold truncate ${isPro ? 'bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent' : 'text-muted-foreground'}`}>
                        {isPro ? 'PRO MEMBER' : 'FREE PLAN'}
                    </span>
                </div>

                {isPro && expiresAt && (
                    <div className="flex items-center gap-1.5 relative z-10 shrink-0">
                        <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                            {formatDistanceToNow(expiresAt, { addSuffix: false })}
                        </span>
                        <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                    </div>
                )}
            </div>
        </div>
    );
};
