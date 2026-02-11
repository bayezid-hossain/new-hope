"use client";

import { useCurrentOrg } from "@/hooks/use-current-org";
import { PerformanceReportView } from "@/modules/reports/ui/components/performance-report-view";

export default function ManagementPerformanceReportPage() {
    const { orgId, isLoading } = useCurrentOrg();

    if (isLoading) return null;
    if (!orgId) return <div>Organization not found</div>;

    return (
        <div className="flex flex-col min-h-screen bg-muted/5">
            <div className="flex-1 p-4 sm:p-6 space-y-8 max-w-7xl mx-auto w-full">
                <PerformanceReportView isManagement orgId={orgId} />
            </div>
        </div>
    );
}
