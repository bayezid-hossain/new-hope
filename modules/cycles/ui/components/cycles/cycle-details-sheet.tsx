"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bird, Calendar, FileText, Loader2, Scale } from "lucide-react";

interface CycleDetailsSheetProps {
    id: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CycleDetailsSheet = ({ id, open, onOpenChange }: CycleDetailsSheetProps) => {
    const trpc = useTRPC();

    const { data, isLoading } = useQuery(
        trpc.cycles.getDetails.queryOptions(
            { id: id! },
            { enabled: !!id && open }
        )
    );

    if (!id) return null;

    // --- HELPER: Normalize Data ---
    // We determine values based on whether it is an Active or Archived cycle
    // to satisfy TypeScript's union checks.
    let cycleName = "Cycle Details";
    let intake = 0;
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let doc = 0;

    if (data?.data) {
        const d = data.data;
        doc = d.doc;

        // Check if "cycleName" exists (Archived) or "name" exists (Active)
        if ('cycleName' in d) {
            // It is an Archived Cycle
            cycleName = d.cycleName;
            intake = d.finalIntake;
            startDate = d.startDate;
            endDate = d.endDate;
        } else {
            // It is an Active Cycle
            cycleName = d.name;
            intake = d.intake;
            startDate = d.createdAt; // Active cycles usually use createdAt as start
            endDate = null; // Active cycles have no end date yet
        }
    }

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title={cycleName}
            description="Historical record and logs for this cycle."
        >
            {isLoading ? (
                <div className="h-40 flex items-center justify-center"><Loader2 className="animate-spin mr-2" /> Loading...</div>
            ) : data ? (
                <div className="space-y-6 pt-2">
                    {/* Top Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="p-3 bg-muted/40 rounded-lg border space-y-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Bird className="h-3 w-3" /> Initial Birds</span>
                            <p className="text-xl font-bold">{doc}</p>
                        </div>
                        <div className="p-3 bg-muted/40 rounded-lg border space-y-1">
                            <span className="text-xs text-muted-foreground flex items-center gap-1"><Scale className="h-3 w-3" /> Total Consumed</span>
                            <p className="text-xl font-bold">{intake.toFixed(1)} <span className="text-sm font-normal text-muted-foreground">bags</span></p>
                        </div>
                    </div>

                    {/* Timeline Info */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2"><Calendar className="h-4 w-4" /> Timeline</h4>
                        <div className="text-sm border rounded-md p-3 grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-xs text-muted-foreground">Start Date</span>
                                <p>{startDate ? format(new Date(startDate), "PPP") : "N/A"}</p>
                            </div>
                            <div>
                                <span className="text-xs text-muted-foreground">End Date</span>
                                <p>{endDate ? format(new Date(endDate), "PPP") : <span className="text-emerald-600 font-medium">Active</span>}</p>
                            </div>
                        </div>
                    </div>

                    {/* Logs List */}
                    <div className="space-y-2">
                        <h4 className="text-sm font-medium flex items-center gap-2"><FileText className="h-4 w-4" /> Cycle Logs</h4>
                        <ScrollArea className="h-[200px] border rounded-md p-2">
                            <div className="space-y-3">
                                {data.logs.map((log: any) => (
                                    <div key={log.id} className="text-sm pb-2 border-b last:border-0 last:pb-0">
                                        <p className="font-medium">{log.note}</p>
                                        <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                            <span>{format(new Date(log.createdAt), "dd MMM HH:mm")}</span>
                                            {log.valueChange !== 0 && (
                                                <span>Change: {log.valueChange}</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {data.logs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No logs found.</p>}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            ) : (
                <div className="text-center text-destructive py-4">Failed to load cycle data.</div>
            )}
        </ResponsiveDialog>
    );
};
