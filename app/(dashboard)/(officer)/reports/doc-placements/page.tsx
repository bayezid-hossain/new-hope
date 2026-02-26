"use client";

import { ProBlocker } from "@/components/pro-blocker";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { DocPlacementReportView } from "@/modules/reports/ui/components/doc-placement-report-view";

export default function DocPlacementReportPage() {
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
        return <ProBlocker feature="DOC Placements Report" description="Access detailed historical data and analytics for DOC Placements." />;
    }

    return (
        <div className="flex flex-col min-h-screen bg-muted/5">
            <div className="flex-1 p-4 sm:p-6 space-y-8 max-w-7xl mx-auto w-full">
                <DocPlacementReportView />
            </div>
        </div>
    );
}
