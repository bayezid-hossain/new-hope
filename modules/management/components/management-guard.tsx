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
            // Redirect officers/non-managers to the dashboard
            router.push("/");
        }
    }, [isAuthorized, isPending, router]);

    if (isPending) {
        return <LoadingState title="Loading Management" description="Fetching organization details..." />;
    }

    if (!statusData?.orgId) {
        return (
            <div className="p-8 text-center shrink-0 min-h-screen bg-background flex flex-col justify-center items-center">
                <Building2 className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                <h1 className="text-2xl font-bold text-foreground">No Organization Found</h1>
                <p className="text-muted-foreground">You are not currently part of an organization.</p>
            </div>
        );
    }

    if (!isAuthorized) {
        return (
            <div className="p-12 text-center shrink-0 min-h-screen bg-background flex flex-col justify-center items-center">
                <Users className="size-12 mx-auto text-muted-foreground/50 mb-4" />
                <h1 className="text-2xl font-bold text-foreground">Management Mode Required</h1>
                <p className="text-muted-foreground mb-6">Please enable Management Mode in the sidebar to access this area.</p>
                <button
                    onClick={() => router.push("/")}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return <>{children}</>;
};
