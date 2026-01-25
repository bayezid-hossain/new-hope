"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    ArrowRight,
    Bird,
    Calendar,
    ChevronRight,
    Clock,
    MoreVertical,
    Skull,
    Trash2,
    Wheat
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { AddMortalityModal } from "./add-mortality-modal";
import { EndCycleModal } from "./end-cycle-modal";

interface MobileCycleCardProps {
    cycle: any;
    prefix?: string;
    currentId?: string;
}

export const MobileCycleCard = ({ cycle, prefix, currentId }: MobileCycleCardProps) => {
    const isCurrent = cycle.id === currentId;
    const [showEndCycle, setShowEndCycle] = useState(false);
    const [showAddMortality, setShowAddMortality] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const { orgId } = useCurrentOrg();

    const deleteMutation = useMutation(
        trpc.officer.cycles.deleteHistory.mutationOptions({
            onSuccess: async () => {
                toast.success("Record deleted successfully");
                await queryClient.invalidateQueries(trpc.officer.cycles.listPast.queryOptions({ orgId: orgId! }));
                setShowDeleteModal(false);
            },
            onError: (err: any) => {
                toast.error(err.message || "Failed to delete record");
            }
        })
    );

    const isPast = cycle.status === "history" || (cycle.status !== "active" && (cycle.endDate || cycle.updatedAt && !cycle.age));
    // Check if it's a history item or active based on fields
    const cycleName = cycle.name || cycle.cycleName;
    const intakeValue = parseFloat(cycle.intake || cycle.finalIntake || "0");
    const docValue = parseInt(cycle.doc || "0");
    const mortalityValue = cycle.mortality || 0;
    const createdAt = cycle.startDate || cycle.createdAt;

    return (
        <Card className={`border-slate-200 shadow-sm overflow-hidden active:bg-slate-50 transition-colors ${isCurrent ? 'ring-2 ring-primary border-primary/20 bg-primary/5' : ''}`}>
            <CardContent className="p-4 space-y-4">
                {/* Top Section: Header & Status */}
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <Link href={`${prefix || ""}/farmers/${cycle.farmerId}`} className="group flex items-center gap-1.5 focus:outline-none">
                            <h3 className="font-bold text-slate-900 group-hover:text-primary transition-colors underline decoration-slate-200 underline-offset-4">{cycleName}</h3>
                            {isCurrent && (
                                <Badge variant="outline" className="text-[8px] h-4 bg-white border-primary text-primary font-bold uppercase tracking-wider px-1">Current</Badge>
                            )}
                            <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                        </Link>
                    </div>

                    {!isPast ? (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Cycle Management</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => setShowAddMortality(true)}>
                                    <Skull className="mr-2 h-4 w-4" /> Add Mortality
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={() => setShowEndCycle(true)}
                                    className="text-destructive focus:text-destructive"
                                >
                                    <ArrowRight className="mr-2 h-4 w-4 rotate-45" /> End Cycle
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    ) : (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                                    onClick={() => setShowDeleteModal(true)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete Record
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {/* Middle Section: Metrics Grid */}
                <div className="grid grid-cols-3 gap-2 py-1">
                    <div className="bg-blue-50/50 p-2.2 rounded-xl border border-blue-100/50 flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[10px] text-blue-600 font-bold uppercase tracking-wider">
                            <Clock className="h-3 w-3" /> Age
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-blue-900 leading-none">{cycle.age}</span>
                            <span className="text-[10px] text-blue-600/70 font-medium lowercase">days</span>
                        </div>
                    </div>

                    <div className="bg-slate-50/50 p-2.2 rounded-xl border border-slate-100 flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            <Bird className="h-3 w-3" /> DOC
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-slate-800 leading-none">{docValue}</span>
                        </div>
                    </div>

                    <div className="bg-amber-50/50 p-2.2 rounded-xl border border-amber-100 flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[10px] text-amber-600 font-bold uppercase tracking-wider">
                            <Wheat className="h-3 w-3" /> Intake
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-lg font-black text-amber-900 leading-none">{intakeValue}</span>
                            <span className="text-[10px] text-amber-700/70 font-medium">bags</span>
                        </div>
                    </div>
                </div>

                {/* Bottom Section: Footer Info */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-2">
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-medium">
                            {createdAt ? format(new Date(createdAt), "MMM d, yyyy") : "-"}
                        </span>
                    </div>

                    {mortalityValue > 0 ? (
                        <div className="flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                            <Skull className="h-3 w-3 text-red-500" />
                            <span className="text-[10px] font-bold text-red-600">-{mortalityValue} Deaths</span>
                        </div>
                    ) : (
                        <div className="text-[10px] font-medium text-slate-400 italic">No mortality recorded</div>
                    )}
                </div>

                {/* View Details Button */}
                <Button variant="outline" className="w-full text-xs font-semibold h-9 rounded-lg border-slate-200 text-slate-600 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all group" asChild>
                    <Link href={`${prefix || ""}/cycles/${cycle.id}`}>
                        View Details
                        <ArrowRight className="ml-2 h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
                    </Link>
                </Button>
            </CardContent>

            {!isPast && (
                <>
                    <AddMortalityModal
                        cycleId={cycle.id}
                        farmerName={cycle.farmerName}
                        open={showAddMortality}
                        onOpenChange={setShowAddMortality}
                    />

                    <EndCycleModal
                        cycleId={cycle.id}
                        farmerName={cycle.farmerName}
                        intake={intakeValue}
                        open={showEndCycle}
                        onOpenChange={setShowEndCycle}
                    />
                </>
            )}

            {isPast && (
                <ResponsiveDialog
                    open={showDeleteModal}
                    onOpenChange={setShowDeleteModal}
                    title="Delete Record"
                    description="Are you sure you want to delete this history record? This action cannot be undone."
                >
                    <div className="flex justify-end gap-2 pt-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteModal(false)}
                            disabled={deleteMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => deleteMutation.mutate({ id: cycle.id })}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </div>
                </ResponsiveDialog>
            )}
        </Card>
    );
};
