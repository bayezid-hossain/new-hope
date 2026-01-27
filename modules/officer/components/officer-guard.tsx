"use client";

import LoadingState from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface OfficerGuardProps {
    children: React.ReactNode;
}

export const OfficerGuard = ({ children }: OfficerGuardProps) => {
    const router = useRouter();
    const trpc = useTRPC();

    // Fetch session and membership to check modes
    const { data: sessionData, isLoading: isSessionLoading } = useQuery(trpc.auth.getSession.queryOptions());
    const { data: orgStatus, isLoading: isOrgLoading } = useQuery(trpc.auth.getMyMembership.queryOptions());

    useEffect(() => {
        if (isSessionLoading || isOrgLoading) return;

        // 1. Check for global Admin mode
        if (sessionData?.user?.globalRole === "ADMIN" && sessionData?.user?.activeMode === "ADMIN") {
            router.push("/admin");
            return;
        }

        // 2. Check for Management mode
        const isManager = orgStatus?.role === "OWNER" || orgStatus?.role === "MANAGER";
        if (isManager && orgStatus?.activeMode === "MANAGEMENT") {
            router.push("/management");
            return;
        }

    }, [sessionData, orgStatus, isSessionLoading, isOrgLoading, router]);

    if (isSessionLoading || isOrgLoading) {
        return <LoadingState title="Accessing" description="Verifying permissions..." />;
    }

    // Don't render content if we're about to redirect 
    if (
        (sessionData?.user?.globalRole === "ADMIN" && sessionData?.user?.activeMode === "ADMIN") ||
        (orgStatus?.activeMode === "MANAGEMENT" && (orgStatus?.role === "OWNER" || orgStatus?.role === "MANAGER"))
    ) {
        return <LoadingState title="Redirecting" description="Redirecting to your dashboard..." />;
    }

    return <>{children}</>;
};
