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

    if (isStatusLoading) return <LoadingState title="Loading Profile" description="Connecting to organization..." />;
    if (!status?.orgId) return <div>Unauthorized.</div>;

    return (
        <div className="p-4 sm:p-8 bg-slate-50/50 min-h-screen">
            <OfficerProfile
                orgId={status.orgId}
                userId={userId}
                backUrl="/management"
                isAdminView={false}
            />
        </div>
    );
}
