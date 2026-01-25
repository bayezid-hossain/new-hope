"use client";

import { CycleDetails } from "@/modules/admin/components/cycle-details";
import { useParams } from "next/navigation";

export default function ManagementCycleDetailsPage() {
    const params = useParams();
    const cycleId = params.id as string;

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            <CycleDetails cycleId={cycleId} isManagement={true} />
        </div>
    );
}
