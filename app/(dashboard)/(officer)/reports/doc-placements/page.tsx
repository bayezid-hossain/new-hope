"use client";

import { DocPlacementReportView } from "@/modules/reports/ui/components/doc-placement-report-view";

export default function DocPlacementReportPage() {
    return (
        <div className="flex flex-col min-h-screen bg-muted/5">
            <div className="flex-1 p-4 sm:p-6 space-y-8 max-w-7xl mx-auto w-full">
                <DocPlacementReportView />
            </div>
        </div>
    );
}
