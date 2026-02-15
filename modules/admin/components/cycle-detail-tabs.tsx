"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LogsTimeline } from "@/modules/cycles/ui/components/cycles/logs-timeline";
import { MobileCycleCard } from "@/modules/cycles/ui/components/cycles/mobile-cycle-card";
import { DataTable } from "@/modules/cycles/ui/components/data-table";
import { getHistoryColumns } from "@/modules/cycles/ui/components/shared/columns-factory";
import { History, UsersIcon } from "lucide-react";
import Link from "next/link";

export const OtherCyclesTabContent = ({
    history,
    isAdmin,
    isManagement,
    currentId,
    orgId,
    isMobile
}: {
    history: any[];
    isAdmin?: boolean;
    isManagement?: boolean;
    currentId?: string;
    orgId?: string;
    isMobile?: boolean;
}) => {
    const prefix = isAdmin ? `/admin/organizations/${orgId}` : (isManagement ? "/management" : "");
    return (
        <Card className={`${isMobile ? "border-none shadow-none bg-transparent" : "border-none shadow-sm bg-card"} overflow-hidden`}>
            {!isMobile && (
                <CardHeader className="border-b border-border/50 pb-4">
                    <CardTitle className="text-lg font-bold text-foreground">Other Farmer Cycles</CardTitle>
                </CardHeader>
            )}
            <CardContent className="p-0">
                <div className={isMobile ? "p-0" : "p-4"}>
                    {history && history.length > 0 ? (
                        <>
                            <div className="hidden md:block">
                                <DataTable
                                    columns={getHistoryColumns({ prefix, currentId })}
                                    data={history}
                                />
                            </div>
                            <div className="md:hidden space-y-3">
                                {history.map((h) => (
                                    <MobileCycleCard key={h.id} cycle={h} prefix={prefix} currentId={currentId} />
                                ))}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <History className="h-10 w-10 mb-3 opacity-20" />
                            <p className="font-medium">No other cycles found.</p>
                        </div>
                    )}
                </div>
                {/* Navigation Aid: Nearby Farmers */}
                {!currentId && !isMobile && (
                    <div className="mt-8 pt-8 border-t border-dashed border-border">
                        <h4 className="text-sm font-semibold text-muted-foreground mb-4 px-1 uppercase tracking-wider">Quick Navigation</h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <Link href={prefix + "/farmers"} className="p-4 rounded-lg border border-border bg-muted/30 hover:bg-card hover:border-primary/30 hover:shadow-md transition-all text-center group">
                                <UsersIcon className="h-6 w-6 mx-auto mb-2 text-muted-foreground/50 group-hover:text-primary" />
                                <span className="text-xs font-bold text-muted-foreground group-hover:text-primary block">All Farmers</span>
                            </Link>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export const LogsTabContent = ({ logs, isMobile }: { logs: any[]; isMobile?: boolean }) => {
    return (
        <div className={isMobile ? "space-y-0" : "space-y-6"}>
            {!isMobile && (
                <CardHeader className="px-0 pt-0 pb-4">
                    <CardTitle className="flex items-center gap-2 text-lg text-foreground">
                        <History className="h-5 w-5 text-muted-foreground" /> Activity Logs
                    </CardTitle>
                </CardHeader>
            )}
            <div className={isMobile ? "" : "p-6 pt-0"}>
                <LogsTimeline logs={logs as any[]} height={isMobile ? "350px" : "500px"} />
            </div>
        </div>
    );
};
