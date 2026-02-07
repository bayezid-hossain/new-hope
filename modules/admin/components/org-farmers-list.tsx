"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArchiveFarmerDialog } from "@/modules/farmers/ui/components/archive-farmer-dialog";
import { EditFarmerProfileModal } from "@/modules/farmers/ui/components/edit-farmer-profile-modal";
import { MobileFarmerCard } from "@/modules/farmers/ui/components/mobile-farmer-card";
import { RestoreFarmerModal } from "@/modules/farmers/ui/components/restore-farmer-modal";
import { useTRPC } from "@/trpc/client";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Activity, AlertCircle, Loader2, RotateCcw, Search, Trash2, Wheat, Wrench } from "lucide-react";
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
    const [editingFarmer, setEditingFarmer] = useState<{ id: string; name: string; location?: string | null; mobile?: string | null } | null>(null);
    const [archivingFarmer, setArchivingFarmer] = useState<{ id: string; name: string } | null>(null);
    const [restoringFarmer, setRestoringFarmer] = useState<{ id: string; name: string } | null>(null);
    const [status, setStatus] = useState<"active" | "deleted">("active");

    const handleEdit = useCallback((id: string, name: string, location?: string | null, mobile?: string | null) => {
        setEditingFarmer({ id, name, location, mobile });
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
                    <TabsList className="grid w-full grid-cols-2 sm:w-[300px] bg-muted/50 border border-border/50 p-1 rounded-xl h-auto">
                        <TabsTrigger value="active" className="font-bold py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary shadow-sm transition-all">Active</TabsTrigger>
                        <TabsTrigger value="deleted" className="font-bold uppercase py-2 px-4 rounded-lg data-[state=active]:bg-background data-[state=active]:text-primary shadow-sm transition-all">Archived</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search farmers..."
                        className="pl-10 h-11 bg-card border-border/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all rounded-xl"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="relative min-h-[300px]">
                {isFetching && !isLoading && (
                    <div className="absolute inset-0 bg-background/90 backdrop-blur-[4px] z-50 flex flex-col items-center justify-center rounded-xl animate-in fade-in duration-300">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm font-bold text-primary mt-3 uppercase tracking-widest">Updating View...</p>
                    </div>
                )}

                {!filteredFarmers || filteredFarmers.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground bg-muted/30 rounded-lg border-2 border-dashed border-border">
                        No farmers found.
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-2xl border border-border/50 overflow-hidden bg-card shadow-sm">
                            <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
                                <Table>
                                    <TableHeader className="bg-muted/50 sticky top-0 z-10 backdrop-blur-md border-b border-border/50">
                                        <TableRow className="hover:bg-transparent">
                                            <TableHead className="font-bold px-6 text-foreground/70 uppercase tracking-wider text-[10px]">Farmer Name</TableHead>
                                            <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px]">Officer</TableHead>
                                            <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px]">Status</TableHead>
                                            <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px]">Cycles (Live/Total)</TableHead>
                                            <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px]">Active Birds</TableHead>
                                            <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px]">Stock Status</TableHead>
                                            {status === "active" ? (
                                                <TableHead className="font-bold text-foreground/70 uppercase tracking-wider text-[10px]">Joined</TableHead>
                                            ) : (
                                                <TableHead className="font-bold px-2 text-foreground/70 uppercase tracking-wider text-[10px]">Archived At</TableHead>
                                            )}
                                            <TableHead className="w-[50px] px-6"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredFarmers.map((farmer) => (
                                            <TableRow key={farmer.id} className="hover:bg-muted/30 group transition-colors border-b last:border-0 border-border/50">
                                                <TableCell className="px-6">
                                                    <div className="flex items-center gap-2">
                                                        <Link href={getFarmerLink(farmer.id)} className="font-bold text-foreground hover:text-primary hover:underline transition-colors">
                                                            {farmer.name}
                                                        </Link>
                                                        {(!farmer.location || !farmer.mobile) && (
                                                            <span title="Missing location or mobile" className="text-destructive">
                                                                <AlertCircle className="h-3.5 w-3.5" />
                                                            </span>
                                                        )}
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground/30 hover:text-foreground transition-all"
                                                            onClick={() => handleEdit(farmer.id, farmer.name, farmer.location, farmer.mobile)}
                                                        >
                                                            <Wrench className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground font-medium text-sm">
                                                    <Link
                                                        href={isAdmin
                                                            ? `/admin/organizations/${farmer.organizationId}/officers/${farmer.officerId}`
                                                            : (isManagement ? `/management/officers/${farmer.officerId}` : "#")}
                                                        className={`hover:underline hover:text-foreground transition-colors ${!isAdmin && !isManagement ? "pointer-events-none hover:no-underline" : ""}`}
                                                    >
                                                        {farmer.officerName || "Unknown"}
                                                    </Link>
                                                </TableCell>
                                                <TableCell>
                                                    {status === "deleted" ? (
                                                        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20 font-bold text-[10px] uppercase tracking-wider">Archived</Badge>
                                                    ) : farmer.activeCyclesCount > 0 ? (
                                                        <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none font-bold text-[10px] uppercase tracking-wider">Active</Badge>
                                                    ) : (
                                                        <Badge variant="secondary" className="bg-muted text-muted-foreground border-none font-bold text-[10px] uppercase tracking-wider">Idle</Badge>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 font-bold text-primary text-xs">
                                                            <Activity className="h-3 w-3" />
                                                            {farmer.activeCyclesCount} / {farmer.activeCyclesCount + farmer.pastCyclesCount}
                                                        </div>
                                                        <div className="flex items-center gap-1.5 font-medium text-muted-foreground text-[10px]">
                                                            <span className="uppercase tracking-wider">Live / Total</span>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-foreground text-sm">
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
                                                                        <Wheat className="h-4 w-4 text-muted-foreground/30" />
                                                                        <span className="font-bold text-sm text-muted-foreground">
                                                                            {farmer.mainStock.toFixed(2)} <span className="text-[10px] font-normal uppercase tracking-wider">Remaining</span>
                                                                        </span>
                                                                    </div>
                                                                );
                                                            }

                                                            return (
                                                                <>
                                                                    <div className="flex items-center gap-1.5">
                                                                        <span className={`font-bold text-sm ${isLow ? "text-destructive" : "text-foreground"}`}>
                                                                            {remaining.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">current</span>
                                                                        </span>
                                                                    </div>
                                                                    <div className="text-[10px] text-muted-foreground flex flex-col gap-0.5">
                                                                        <span className="text-amber-600/90 dark:text-amber-500/90">+ {activeConsumption.toFixed(2)} used in active cycles</span>
                                                                        <span className="text-muted-foreground/50">Total Prov: {farmer.mainStock.toFixed(2)}</span>
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </TableCell>

                                                <TableCell className="text-muted-foreground/60 text-[11px] font-medium">
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
                                                                className="text-destructive hover:bg-destructive/10 font-bold text-xs gap-1"
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
                                    onEdit={() => handleEdit(farmer.id, farmer.name, farmer.location, farmer.mobile)}
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

            <EditFarmerProfileModal
                farmerId={editingFarmer?.id || ""}
                currentName={editingFarmer?.name || ""}
                currentLocation={editingFarmer?.location}
                currentMobile={editingFarmer?.mobile}
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
        </div>
    );
};
