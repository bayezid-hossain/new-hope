"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { EditFarmerNameModal } from "@/modules/farmers/ui/components/edit-farmer-name-modal";
import { MobileFarmerCard } from "@/modules/farmers/ui/components/mobile-farmer-card";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    ArrowRight,
    Bird,
    Loader2,
    Search,
    Users,
    Wheat,
    Wrench
} from "lucide-react";
import Link from "next/link"; // Assuming Next.js navigation
import { useState } from "react";

// --- Mobile Farmer Card Component ---
// --- Mobile Farmer Card Component ---
// Imported from @/modules/farmers/ui/components/mobile-farmer-card

export const FarmersListView = () => {
    const { orgId } = useCurrentOrg();
    const trpc = useTRPC();

    // Local state for search
    const [searchTerm, setSearchTerm] = useState("");
    // Debounce search to avoid spamming the API (optional but recommended)
    // If you don't have a debounce hook, just pass searchTerm directly for now.
    const debouncedSearch = searchTerm;

    const [editingFarmer, setEditingFarmer] = useState<{ id: string; name: string } | null>(null);

    const { data, isLoading } = useQuery(
        trpc.management.farmers.getMany.queryOptions({
            orgId: orgId!,
            search: debouncedSearch,
            pageSize: 50, // Fetch a good amount for the list
            onlyMine: true,
        }, { enabled: !!orgId })
    );

    return (
        <div className="space-y-6 w-full max-w-6xl mx-auto p-4 md:p-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-xl xs:text-2xl font-bold tracking-tight">Farmers Directory</h1>
                    <p className="text-muted-foreground text-xs xs:text-sm">Manage and monitor all farmers.</p>
                </div>
                {/* Search Bar */}
                <div className="relative w-full md:w-72">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search name or phone..."
                        className="pl-9 h-8 xs:h-9 sm:h-10 text-[11px] xs:text-xs sm:text-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Farmers Table Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5 xs:space-y-1">
                            <CardTitle className="flex items-center gap-2 text-sm xs:text-base sm:text-lg">
                                <Users className="h-4 w-4 xs:h-5 xs:w-5 text-muted-foreground" />
                                All Farmers
                            </CardTitle>
                            <CardDescription className="text-[10px] xs:text-xs">
                                Total Registered: {data?.total || 0}
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Desktop View: Table */}
                    <div className="hidden md:block rounded-md border text-foreground bg-card overflow-hidden shadow-sm">
                        <div className="max-h-[600px] overflow-y-auto">
                            <Table>
                                <TableHeader className="bg-muted/90 backdrop-blur sticky top-0 z-10 shadow-sm">
                                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                                        <TableHead className="h-9 sm:h-11 font-semibold text-foreground/80 text-[10px] sm:text-[11px] px-4">Farmer Name</TableHead>
                                        <TableHead className="h-9 sm:h-11 font-semibold text-foreground/80 text-[10px] sm:text-[11px] px-4">Status</TableHead>
                                        <TableHead className="h-9 sm:h-11 font-semibold text-foreground/80 text-[10px] sm:text-[11px] px-4">Cycles (Live/Total)</TableHead>
                                        <TableHead className="h-9 sm:h-11 font-semibold text-foreground/80 text-[10px] sm:text-[11px] px-4">Current Stock</TableHead>
                                        <TableHead className="text-right h-9 sm:h-11 font-semibold text-foreground/80 text-[10px] sm:text-[11px] px-4">Joined</TableHead>
                                        <TableHead className="w-[50px] h-9 sm:h-11 text-[10px] sm:text-[11px] px-4"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-24 text-center">
                                                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading farmers...
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ) : data?.items.map((farmer) => (
                                        <TableRow key={farmer.id} className="group hover:bg-muted/30 transition-colors border-border/50">
                                            {/* Name & Phone */}
                                            <TableCell className="px-4 py-3 text-xs sm:text-sm">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-foreground">{farmer.name}</div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-6 w-6 text-muted-foreground/40 hover:text-muted-foreground transition-all"
                                                        onClick={() => setEditingFarmer({ id: farmer.id, name: farmer.name })}
                                                    >
                                                        <Wrench className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </TableCell>

                                            {/* Status (derived logic) */}
                                            <TableCell className="px-4 py-3">
                                                {farmer.activeCyclesCount > 0 ? (
                                                    <Badge variant="default" className="bg-primary/20 text-primary hover:bg-primary/30 border-none font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">Active</Badge>
                                                ) : (
                                                    <Badge variant="secondary" className="bg-muted text-muted-foreground hover:bg-muted/80 border-none font-bold text-[10px] uppercase tracking-wider px-2 py-0.5">Idle</Badge>
                                                )}
                                            </TableCell>

                                            {/* Active Cycles Count */}
                                            <TableCell className="px-4 py-3 text-xs sm:text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <Bird className="h-4 w-4 text-primary/70" />
                                                    <span className="font-bold text-foreground">{farmer.activeCyclesCount} / {farmer.activeCyclesCount + farmer.pastCyclesCount}</span>
                                                    <span className="text-[10px] font-medium text-muted-foreground">Live / Total</span>
                                                </div>
                                            </TableCell>

                                            {/* Main Warehouse Stock */}
                                            <TableCell className="px-4 py-3 text-xs sm:text-sm">
                                                <div className="flex items-center gap-1.5">
                                                    <Wheat className="h-4 w-4 text-amber-500/70" />
                                                    <span className="font-bold text-foreground font-mono">{farmer.mainStock.toFixed(2)}</span>
                                                    <span className="text-[10px] font-medium text-muted-foreground">bags</span>
                                                </div>
                                            </TableCell>

                                            {/* Joined Date */}
                                            <TableCell className="text-right text-muted-foreground font-medium text-[10px] sm:text-[11px] px-4 py-3">
                                                {format(new Date(farmer.createdAt), "MMM d, yyyy")}
                                            </TableCell>

                                            {/* Action: Link to History View */}
                                            <TableCell>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground/40 hover:text-primary hover:bg-primary/5 transition-colors" asChild>
                                                    {/* Update this HREF to match your routing structure */}
                                                    <Link href={`/farmers/${farmer.id}`}>
                                                        <ArrowRight className="h-4 w-4" />
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {!isLoading && data?.items.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                                No farmers found matching "{searchTerm}".
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Mobile View: Cards */}
                    <div className="md:hidden space-y-4">
                        {isLoading ? (
                            <div className="flex items-center justify-center p-12 text-muted-foreground gap-2">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                <span className="text-sm font-medium">Loading directory...</span>
                            </div>
                        ) : data?.items.map((farmer) => (
                            <MobileFarmerCard key={farmer.id} farmer={farmer} />
                        ))}

                        {!isLoading && data?.items.length === 0 && (
                            <div className="flex flex-col items-center justify-center p-12 bg-muted/30 rounded-3xl border-2 border-dashed border-border text-muted-foreground">
                                <Search className="h-8 w-8 opacity-20 mb-2" />
                                <p className="text-sm font-medium">No results for "{searchTerm}"</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {editingFarmer && (
                <EditFarmerNameModal
                    farmerId={editingFarmer.id}
                    currentName={editingFarmer.name}
                    open={!!editingFarmer}
                    onOpenChange={(open) => !open && setEditingFarmer(null)}
                />
            )}
        </div>
    );
};