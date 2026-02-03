"use client";

import LoadingState from "@/components/loading-state";
import { OfficerProfile } from "@/modules/admin/components/officer-profile";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

export default function ManagementOfficerDetailPage() {
    const params = useParams();
    const userId = params.userId as string;
    const trpc = useTRPC();
    // console.log("OFFICER:" + userId)
    const { data: status, isLoading: isStatusLoading } = useQuery(
        trpc.auth.getMyMembership.queryOptions()
    );

    if (isStatusLoading) return <LoadingState title="Loading Profile" description="Connecting to organization..." fullPage />;
    if (!status?.orgId) return (
        <div className="flex flex-col items-center justify-center min-h-[300px] p-8 text-center">
            <div className="p-4 rounded-2xl bg-destructive/10 text-destructive mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="size-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground">Unauthorized</h1>
            <p className="text-muted-foreground text-sm mt-1">You do not have permission to view this page.</p>
        </div>
    );

    return (
        <div className="bg-background min-h-screen">
            <OfficerProfile
                orgId={status.orgId}
                userId={userId}
                backUrl="/management"
                isAdminView={false}
            />
        </div>
    );
}
