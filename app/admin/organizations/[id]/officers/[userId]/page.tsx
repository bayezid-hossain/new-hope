"use client";

import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { OfficerProfile } from "@/modules/admin/components/officer-profile";
import { useParams } from "next/navigation";

export default function AdminOfficerDetailPage() {
    const params = useParams();
    const id = params.id as string; // OrgId
    const userId = params.userId as string;

    return (
        <AdminGuard>
            <div className="p-4 sm:p-8 bg-slate-50/50 min-h-screen">
                <OfficerProfile
                    orgId={id}
                    userId={userId}
                    backUrl={`/admin/organizations/${id}`}
                    isAdminView={true}
                />
            </div>
        </AdminGuard>
    );
}
