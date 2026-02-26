"use client";

import { ProBlocker } from "@/components/pro-blocker";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { PerformanceReportView } from "@/modules/reports/ui/components/performance-report-view";

export default function PerformanceReportsPage() {
    const { isPro, isLoading } = useCurrentOrg();

    if (isLoading) {
        return (
            <div className="p-4 space-y-4 max-w-2xl mx-auto">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!isPro) {
        return <ProBlocker feature="Performance Reports" description="Analyze farm performance metrics and gain actionable insights with Pro." />;
    }

    return <PerformanceReportView />;
}
