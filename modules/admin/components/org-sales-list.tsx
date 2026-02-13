"use client";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, Loader2, MapPin, Search, ShoppingCart, TrendingUp, User } from "lucide-react";
import { useState } from "react";

interface OrgSalesListProps {
    orgId: string;
}

export const OrgSalesList = ({ orgId }: OrgSalesListProps) => {
    const trpc = useTRPC();
    const [search, setSearch] = useState("");

    const { data: sales, isPending } = useQuery(
        trpc.admin.organizations.getSales.queryOptions({ orgId })
    );

    const filteredSales = sales?.filter(sale => {
        const searchLower = search.toLowerCase();
        const farmerName = sale.cycle?.farmer?.name || sale.history?.farmer?.name || "";
        return (
            farmerName.toLowerCase().includes(searchLower) ||
            sale.location.toLowerCase().includes(searchLower)
        );
    });

    if (isPending) {
        return (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                <span className="text-xs font-bold tracking-widest text-muted-foreground/50 uppercase italic">Gathering Transaction Records...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6 lg:p-10 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="max-w-7xl mx-auto w-full flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-2">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-xl">
                            <ShoppingCart className="h-5 w-5 text-primary" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-foreground">Sales Registry</h1>
                    </div>
                    <p className="text-sm text-muted-foreground font-medium max-w-md">
                        Comprehensive ledger of all bird sales transactions for this organization.
                    </p>
                </div>

                <div className="relative w-full max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                    <Input
                        placeholder="Search by farmer or location..."
                        className="pl-10 h-11 bg-muted/40 border-none shadow-none focus-visible:ring-2 focus-visible:ring-primary/10 transition-all rounded-xl placeholder:text-muted-foreground/40 font-medium"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Content Section */}
            <Card className="max-w-7xl mx-auto overflow-hidden border-border/40 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-2xl bg-card/50 backdrop-blur-sm">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-muted/30">
                            <TableRow className="hover:bg-transparent border-border/40">
                                <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="h-3 w-3" />
                                        Transaction Date
                                    </div>
                                </TableHead>
                                <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">
                                    <div className="flex items-center gap-2">
                                        <User className="h-3 w-3" />
                                        Farmer Details
                                    </div>
                                </TableHead>
                                <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 text-right">Birds</TableHead>
                                <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 text-right">Avg Weight</TableHead>
                                <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 text-right">Unit Price</TableHead>
                                <TableHead className="py-5 px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70 text-right">Gross Total</TableHead>
                                <TableHead className="py-5 px-6 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/70">Officer</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {!filteredSales || filteredSales.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-40 text-center">
                                        <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground/40">
                                            <ShoppingCart className="h-10 w-10 opacity-10" />
                                            <span className="text-sm font-bold tracking-tight">No sales records found</span>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSales.map((sale) => (
                                    <TableRow key={sale.id} className="hover:bg-muted/20 transition-all duration-300 border-border/40 group">
                                        <TableCell className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <span className="font-bold text-sm tracking-tight group-hover:text-primary transition-colors">
                                                    {format(new Date(sale.saleDate), "dd/MM/yyyy")}
                                                </span>
                                                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 font-bold uppercase tracking-wider">
                                                    <MapPin className="h-2.5 w-2.5" />
                                                    {sale.location}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-sm text-foreground/80 tracking-tight">
                                                    {sale.cycle?.farmer?.name || sale.history?.farmer?.name || "Unassigned"}
                                                </span>
                                                <span className="text-[10px] text-muted-foreground/50 font-medium">
                                                    {sale.cycle?.name || sale.history?.cycleName || "Cycle Data Unavailable"}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right">
                                            <Badge variant="secondary" className="bg-primary/5 text-primary border-none font-black text-xs px-2.5 py-1 rounded-lg">
                                                {sale.birdsSold.toLocaleString()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="text-sm font-bold tracking-tight text-foreground/70">{sale.avgWeight}kg</span>
                                                <span className="text-[10px] text-muted-foreground/40 font-medium italic">total: {sale.totalWeight}kg</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="px-6 py-4 text-right">
                                            <span className="text-xs font-bold text-muted-foreground/60 tracking-tight italic">৳{sale.pricePerKg}</span>
                                        </TableCell>
                                        <TableCell className="px-4 py-4 text-right">
                                            <span className="text-base font-black text-emerald-600 tracking-tighter">
                                                ৳{Number(sale.totalAmount).toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell className="px-6 py-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-7 w-7 rounded-full bg-muted/60 flex items-center justify-center text-[10px] font-black text-muted-foreground/60 border border-border/40">
                                                    {(sale.createdByUser?.name || "S")[0]}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-[11px] font-bold text-foreground/60 tracking-tight">{sale.createdByUser?.name || "System"}</span>
                                                    <span className="text-[9px] text-muted-foreground/40 font-medium uppercase tracking-tighter">Recording Officer</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {/* Footer Metrics */}
            {filteredSales && filteredSales.length > 0 && (
                <div className="max-w-7xl mx-auto w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    <Card className="p-5 border-border/30 bg-emerald-50/30 shadow-none rounded-2xl flex flex-col justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700/60 mb-2">Total Revenue</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-emerald-600 tracking-tighter">
                                ৳{filteredSales.reduce((acc, sale) => acc + Number(sale.totalAmount), 0).toLocaleString()}
                            </span>
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        </div>
                    </Card>
                    <Card className="p-5 border-border/30 bg-primary/5 shadow-none rounded-2xl flex flex-col justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2">Total Birds Sold</span>
                        <span className="text-2xl font-black text-primary tracking-tighter">
                            {filteredSales.reduce((acc, sale) => acc + sale.birdsSold, 0).toLocaleString()}
                        </span>
                    </Card>
                    <Card className="p-5 border-border/30 bg-muted/50 shadow-none rounded-2xl flex flex-col justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Avg. Weight</span>
                        <span className="text-2xl font-black text-foreground/60 tracking-tighter">
                            {(filteredSales.reduce((acc, sale) => acc + Number(sale.avgWeight), 0) / filteredSales.length).toFixed(2)}kg
                        </span>
                    </Card>
                    <Card className="p-5 border-border/30 bg-muted/50 shadow-none rounded-2xl flex flex-col justify-between">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-2">Trans. Volume</span>
                        <span className="text-2xl font-black text-foreground/60 tracking-tighter">
                            {filteredSales.length} Records
                        </span>
                    </Card>
                </div>
            )}
        </div>
    );
};
