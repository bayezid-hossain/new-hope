"use client";

import LoadingState from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export const ManagementGuard = ({ children }: { children: React.ReactNode }) => {
    const router = useRouter();
    const trpc = useTRPC();

    const { data: statusData, isPending } = useQuery(
        trpc.auth.getMyMembership.queryOptions()
    );

    const isAuthorized = statusData?.orgId && (statusData.role === "OWNER" || statusData.role === "MANAGER") && statusData.activeMode === "MANAGEMENT";

    useEffect(() => {
        if (!isPending && !isAuthorized) {
            // We don't necessarily want to redirect to / if they just need to toggle mode
            // But for deep links, it might be better to redirect to / so they get the HomeView or whatever.
            // Actually, showing the "Access Denied" with a message to toggle mode is better in-place.
        }
    }, [isAuthorized, isPending]);

    if (isPending) {
        return <LoadingState title="Loading Management" description="Fetching organization details..." />;
    }

    if (!statusData?.orgId) {
        return (
            <div className="p-8 text-center shrink-0 min-h-screen bg-slate-50 flex flex-col justify-center items-center">
                <Building2 className="size-12 mx-auto text-slate-300 mb-4" />
                <h1 className="text-2xl font-bold text-slate-900">No Organization Found</h1>
                <p className="text-slate-500">You are not currently part of an organization.</p>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="p-12 text-center shrink-0 min-h-screen bg-slate-50 flex flex-col justify-center items-center">
                <Users className="size-12 mx-auto text-slate-300 mb-4" />
                <h1 className="text-2xl font-bold text-slate-900">Management Mode Required</h1>
                <p className="text-slate-500 mb-6">Please enable Management Mode in the sidebar to access this area.</p>
                <button
                    onClick={() => router.push("/")}
                    className="px-4 py-2 bg-primary text-white rounded-lg font-medium"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return <>{children}</>;
};
