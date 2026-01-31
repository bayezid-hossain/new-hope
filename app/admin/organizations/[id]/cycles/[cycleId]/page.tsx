"use client";

import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { CycleDetails } from "@/modules/admin/components/cycle-details";
import { useParams } from "next/navigation";

export default function AdminCycleDetailsPage() {
    const params = useParams();
    const cycleId = params.cycleId as string;

    return (
        <AdminGuard>
            <div className="p-4 md:p-8 max-w-7xl mx-auto w-full">
                <CycleDetails cycleId={cycleId} isAdmin={true} />
            </div>
        </AdminGuard>
    );
}
