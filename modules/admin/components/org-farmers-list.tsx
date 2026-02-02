"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArchiveFarmerDialog } from "@/modules/farmers/ui/components/archive-farmer-dialog";
import { EditFarmerNameModal } from "@/modules/farmers/ui/components/edit-farmer-name-modal";
import { MobileFarmerCard } from "@/modules/farmers/ui/components/mobile-farmer-card";
import { RestoreFarmerModal } from "@/modules/farmers/ui/components/restore-farmer-modal";
import { useTRPC } from "@/trpc/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, Loader2, RotateCcw, Search, Trash2, Wheat, Wrench } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useDebounce } from "use-debounce";

interface OrgFarmersListProps {
    orgId: string;
    isManagement?: boolean;
    isAdmin?: boolean;
}

export const OrgFarmersList = ({ orgId, isManagement, isAdmin }: OrgFarmersListProps) => {
    const trpc = useTRPC();
    const [search, setSearch] = useState("");
    const [debouncedSearch] = useDebounce(search, 300);
    const [editingFarmer, setEditingFarmer] = useState<{ id: string; name: string } | null>(null);
    const [archivingFarmer, setArchivingFarmer] = useState<{ id: string; name: string } | null>(null);
    const [restoringFarmer, setRestoringFarmer] = useState<{ id: string; name: string } | null>(null);
    const [status, setStatus] = useState<"active" | "deleted">("active");

    const handleEdit = useCallback((id: string, name: string) => {
        setEditingFarmer({ id, name });
    }, []);

    const handleArchive = useCallback((id: string, name: string) => {
        setArchivingFarmer({ id, name });
    }, []);

    const { data: farmers, isLoading, isFetching, refetch } = useQuery({
        ...trpc.management.farmers.getOrgFarmers.queryOptions({ orgId, search: debouncedSearch, status }),
        placeholderData: keepPreviousData
    });

    const queryClient = useQueryClient();

    const archiveMutation = useMutation(
        trpc.management.farmers.delete.mutationOptions({
            onSuccess: () => {
                toast.success("Farmer profile archived");
                setArchivingFarmer(null);
                refetch();
                queryClient.invalidateQueries({ queryKey: [["management", "farmers"]] });
            },
            onError: (err) => toast.error(err.message || "Failed to archive farmer")
        })
    );

    const handleRestoreClick = (id: string, name: string) => {
        setRestoringFarmer({ id, name });
    };

    const filteredFarmers = farmers as any[]; // Data is already filtered by backend

    const getFarmerLink = (farmerId: string) => {
        if (isAdmin) return `/admin/organizations/${orgId}/farmers/${farmerId}`;
        if (isManagement) return `/management/farmers/${farmerId}`;
        return `/farmers/${farmerId}`;
    };

    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <Tabs value={status} onValueChange={(v: any) => setStatus(v)} className="w-full sm:w-auto">
                    <TabsList className="grid w-full grid-cols-2 sm:w-[300px]">
                        <TabsTrigger value="active" className="font-bold">Active</TabsTrigger>
                        <TabsTrigger value="deleted" className="font-bold uppercase">Archived</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Search farmers..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="relative min-h-[300px]">
                {isFetching && !isLoading && (
                    <div className="absolute inset-0 bg-white/90 backdrop-blur-[4px] z-50 flex flex-col items-center justify-center rounded-xl animate-in fade-in duration-300">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm font-bold text-primary mt-3 uppercase tracking-widest">Updating View...</p>
                    </div>
                )}

                {!filteredFarmers || filteredFarmers.length === 0 ? (
                    <div className="text-center p-8 text-slate-500 bg-slate-50 rounded-lg border-2 border-dashed">
                        No farmers found.
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
                            <div className="max-h-[600px] overflow-y-auto">
                                <Table>
                                    <TableHeader className="bg-slate-50/50 sticky top-0 z-10 shadow-sm">
                                        <TableRow>
                                            <TableHead className="font-semibold px-6">Farmer Name</TableHead>
                                            <TableHead className="font-semibold">Officer</TableHead>
                                            <TableHead className="font-semibold">Status</TableHead>
                                            <TableHead className="font-semibold">Cycles (Live/Total)</TableHead>
                                            <TableHead className="font-semibold">Active Birds</TableHead>
                                            <TableHead className="font-semibold">Stock</TableHead>
                                            {status === "active" ? (
                                                <TableHead className="font-semibold">Joined</TableHead>
                                            ) : (
                                                <TableHead className="font-semibold px-2">Archived At</TableHead>
                                            )}
                                            <TableHead className="w-[50px] px-6"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredFarmers.map((farmer) => (
                                            <TableRow key={farmer.id} className="hover:bg-slate-50/50 group transition-colors">
                                                <TableCell className="px-6">
                                                    <div className="flex items-center gap-2">
                                                        <Link href={getFarmerLink(farmer.id)} className="font-bold text-slate-900 hover:text-primary hover:underline transition-colors">
                                                            {farmer.name}
                                                        </Link>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
                                                            onClick={() => handleEdit(farmer.id, farmer.name)}
                                                        >
                                                            <Wrench className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-slate-600 font-medium text-sm">
                                                    <Link
                                                        href={isAdmin
                                                            ? `/admin/organizations/${farmer.organizationId}/officers/${farmer.officerId}`
                                                            : (isManagement ? `/management/officers/${farmer.officerId}` : "#")}
                                                        className={`hover:underline ${!isAdmin && !isManagement ? "pointer-events-none hover:no-underline" : ""}`}
                                                    >
                                                        {farmer.officerName || "Unknown"}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    {status === "deleted" ? (
                                                        <Badge variant="destructive" className="bg-red-50 text-red-600 border-red-200 font-bold text-[10px] uppercase tracking-wider">Archived</Badge>
                                                    ) : farmer.activeCyclesCount > 0 ? (
                                                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-bold text-[10px] uppercase tracking-wider">Active</Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-none font-bold text-[10px] uppercase tracking-wider">Idle</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 font-bold text-emerald-600 text-xs">
                                                            <Activity className="h-3 w-3" />
                                                            {farmer.activeCyclesCount} / {farmer.activeCyclesCount + farmer.pastCyclesCount}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 font-medium text-slate-400 text-[10px]">
                                                            <span className="uppercase tracking-wider">Live / Total</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-slate-900 text-sm">
                                                        {farmer.activeBirdsCount?.toLocaleString() || 0}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-0.5">
                                                        {(() => {
                                                            const activeConsumption = farmer.cycles.reduce((acc: number, c: any) => acc + (c.intake || 0), 0);
                                                            const remaining = farmer.mainStock - activeConsumption;
                                                            const isLow = remaining < 3;

                                                            if (status === "deleted") {
                                                                return (
                                                                    <div className="flex items-center gap-1.5 justify-start">
                                                                        <Wheat className="h-4 w-4 text-slate-300" />
                                                                        <span className="font-bold text-sm text-slate-500">
                                                                            {farmer.mainStock.toFixed(2)} <span className="text-[10px] font-normal uppercase tracking-wider">Remaining</span>
                                                                        </span>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className={`font-bold text-sm ${isLow ? "text-red-600" : "text-slate-900"}`}>
                                                                            {remaining.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">current</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
                                                                        <span className="text-amber-600/90">+ {activeConsumption.toFixed(2)} used in active cycles</span>
                                                                        <span className="text-slate-400">Total Prov: {farmer.mainStock.toFixed(2)}</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-slate-400 text-[11px] font-medium">
                                                    {format(new Date(status === "active" ? farmer.createdAt : farmer.deletedAt || farmer.updatedAt), "MMM d, yyyy")}
                                                </TableCell>
                                                <TableCell className="px-6 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        {status === "deleted" ? (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-primary hover:bg-primary/10 font-bold text-xs gap-1"
                                                                onClick={() => handleRestoreClick(farmer.id, farmer.name)}
                                                            >
                                                                <RotateCcw className="h-3.5 w-3.5" />
                                                                Restore
                                                            </Button>
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="text-red-500 hover:text-red-600 hover:bg-red-50 font-bold text-xs gap-1"
                                                                disabled={archiveMutation.isPending}
                                                                onClick={() => handleArchive(farmer.id, farmer.name)}
                                                            >
                                                                {archiveMutation.isPending ? (
                                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                ) : (
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                )}
                                                                archive
                                                            </Button>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-2">
                            {filteredFarmers.map((farmer) => (
                                <MobileFarmerCard
                                    key={farmer.id}
                                    farmer={farmer}
                                    prefix={isAdmin ? `/admin/organizations/${orgId}` : (isManagement ? '/management' : '')}
                                    onEdit={() => handleEdit(farmer.id, farmer.name)}
                                    onDelete={status === "active" ? (() => handleArchive(farmer.id, farmer.name)) : undefined}
                                    actions={
                                        status === "deleted" ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="w-full text-primary border-primary/20 bg-primary/5 font-bold gap-2"
                                                onClick={() => handleRestoreClick(farmer.id, farmer.name)}
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                                RESTORE FARMER PROFILE
                                            </Button>
                                        ) : undefined
                                    }
                                />
                            ))}
                        </div>
                    </>
                )}
            </div>

            <EditFarmerNameModal
                farmerId={editingFarmer?.id || ""}
                currentName={editingFarmer?.name || ""}
                open={!!editingFarmer}
                onOpenChange={(open) => !open && setEditingFarmer(null)}
            />

            <ArchiveFarmerDialog
                open={!!archivingFarmer}
                onOpenChange={(v) => !v && setArchivingFarmer(null)}
                farmerName={archivingFarmer?.name || ""}
                isPending={archiveMutation.isPending}
                onConfirm={() => archiveMutation.mutate({ orgId, farmerId: archivingFarmer?.id || "" })}
            />

            <RestoreFarmerModal
                open={!!restoringFarmer}
                onOpenChange={(v) => !v && setRestoringFarmer(null)}
                farmerId={restoringFarmer?.id || ""}
                archivedName={restoringFarmer?.name || ""}
                orgId={orgId}
            />
        </div >
    );
};
