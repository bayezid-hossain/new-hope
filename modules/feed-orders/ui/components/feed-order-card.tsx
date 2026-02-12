"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { copyToClipboard } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle, ChevronDown, ChevronUp, Copy, MoreHorizontal, Pencil, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FeedOrderCardProps {
    order: {
        id: string;
        orderDate: Date | string;
        deliveryDate: Date | string;
        status: "PENDING" | "CONFIRMED";
        items: {
            farmerId: string;
            feedType: string;
            quantity: number;
            farmer: {
                name: string;
                location: string | null;
                mobile: string | null;
                mainStock: number;
            };
        }[];
    };
    onEdit?: (order: any) => void;
}

export function FeedOrderCard({ order, onEdit }: FeedOrderCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [driverName, setDriverName] = useState("");
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const deleteMutation = useMutation(
        trpc.officer.feedOrders.delete.mutationOptions({
            onSuccess: () => {
                toast.success("Feed order deleted");
                queryClient.invalidateQueries(trpc.officer.feedOrders.list.pathFilter());
            },
            onError: (err) => {
                toast.error(`Failed to delete: ${err.message}`);
            }
        })
    );

    const confirmMutation = useMutation(
        trpc.officer.feedOrders.confirm.mutationOptions({
            onSuccess: () => {
                toast.success("Delivery confirmed! Stocks updated.");
                queryClient.invalidateQueries(trpc.officer.feedOrders.list.pathFilter());
                // Also invalidate farmers to reflect new stock
                queryClient.invalidateQueries(trpc.officer.farmers.listWithStock.pathFilter());
                queryClient.invalidateQueries(trpc.officer.farmers.getMany.pathFilter());
                setDriverName("");
            },
            onError: (err) => {
                toast.error(`Confirmation failed: ${err.message}`);
            }
        })
    );

    const generateCopyText = () => {
        const orderDateStr = format(new Date(order.orderDate), "dd/MM/yyyy");
        const deliveryDateStr = format(new Date(order.deliveryDate), "dd/MM/yyyy");

        let text = `Dear sir,\nFeed order date: ${orderDateStr}\nFeed delivery  date: ${deliveryDateStr}\n\n`;

        // Group items by farmer to handle multiple feed types per farmer if needed
        // The data structure is flat items, so let's group them first
        const farmerMap = new Map<string, typeof order.items>();

        order.items.forEach(item => {
            if (!farmerMap.has(item.farmerId)) {
                farmerMap.set(item.farmerId, []);
            }
            farmerMap.get(item.farmerId)?.push(item);
        });

        let farmCounter = 1;
        const totalByType: Record<string, number> = {};
        let grandTotal = 0;

        farmerMap.forEach((items, farmerId) => {
            const farmer = items[0].farmer;
            const activeItems = items.filter(i => i.quantity > 0);
            if (activeItems.length === 0) return;

            text += `Farm No ${farmCounter.toString().padStart(2, '0')}\n`;
            text += `${farmer.name}\n`; // User example shows name directly, sometimes "Farmer: Name"
            if (farmer.location) text += `Location: ${farmer.location}\n`;
            if (farmer.mobile) text += `Phone: ${farmer.mobile}\n`;

            activeItems.forEach(item => {
                text += `${item.feedType}: ${item.quantity} Bags\n`;

                // Totals
                totalByType[item.feedType] = (totalByType[item.feedType] || 0) + item.quantity;
                grandTotal += item.quantity;
            });

            text += `\n`;
            farmCounter++;
        });

        text += `Total:\n`;
        Object.entries(totalByType).forEach(([type, qty]) => {
            text += `${type}: ${qty} Bags\n`;
        });

        text += `\nGrand Total: ${grandTotal} Bags`; // Keeping user's typo "Tota" or maybe valid? formatting matching request exactly just in case, but let's fix to Total if logic suggests, but user request had "Grand Tota:". I will use "Grand Total" to be safe, or stick to request? Request: "Grand Tota: 160 Bags". I'll use "Grand Total".

        return text;
    };

    const handleCopy = () => {
        const text = generateCopyText();
        copyToClipboard(text);
        toast.success("Order copied to clipboard!");
    };

    const totalBags = order.items.reduce((sum, item) => sum + item.quantity, 0);

    const isConfirmed = order.status === "CONFIRMED";

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className={`w-full overflow-hidden border transition-all duration-300 ${isConfirmed
                ? "border-emerald-500/20 bg-emerald-500/5 shadow-lg shadow-emerald-500/5"
                : "border-border/50 bg-card/50 hover:bg-card/80 shadow-md"
                }`}>
                <CardHeader className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex gap-3">
                            <div className={`mt-1 p-2.5 rounded-xl shrink-0 transition-colors ${isConfirmed
                                ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20"
                                : "bg-primary/10 text-primary"
                                }`}>
                                {isConfirmed ? <CheckCircle className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Delivery Date</span>
                                    <Badge variant="secondary" className={`h-5 px-1.5 text-[10px] font-bold border-none transition-colors ${isConfirmed ? "bg-emerald-500/10 text-emerald-700" : "bg-primary/20 text-primary"
                                        }`}>
                                        {totalBags} Bags
                                    </Badge>
                                    <Badge
                                        variant={isConfirmed ? "default" : "secondary"}
                                        className={`h-5 px-1.5 text-[10px] font-bold border-none ${isConfirmed
                                            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700"
                                            : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"
                                            }`}
                                    >
                                        {isConfirmed ? "Confirmed" : "Pending"}
                                    </Badge>
                                </div>
                                <CardTitle className={`text-xl font-black tracking-tight leading-none transition-colors ${isConfirmed ? "text-emerald-950 dark:text-emerald-50" : "text-foreground"
                                    }`}>
                                    {format(new Date(order.deliveryDate), "dd MMM, yyyy")}
                                </CardTitle>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                    <span>Ordered: {format(new Date(order.orderDate), "dd/MM/yyyy")}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <div className={`grid ${isConfirmed ? "grid-cols-1" : "grid-cols-2"} sm:flex sm:items-center gap-2 w-full`}>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopy}
                                    className="h-9 rounded-lg px-3 bg-primary text-primary-foreground hover:bg-primary/10 border-none shadow-sm transition-all active:scale-95 text-xs sm:text-sm font-medium w-full sm:w-auto"
                                >
                                    <Copy className="h-3.5 w-3.5 mr-2" />
                                    Copy
                                </Button>

                                {order.status === "PENDING" && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 rounded-lg px-3 bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-sm transition-all active:scale-95 text-xs sm:text-sm font-medium w-full sm:w-auto"
                                            >
                                                <CheckCircle className="h-3.5 w-3.5 mr-2" />
                                                Confirm
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-2xl border-none shadow-2xl max-w-sm sm:max-w-md">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-bold">Confirm Delivery</AlertDialogTitle>
                                                <AlertDialogDescription className="text-sm space-y-4">
                                                    <div className="text-muted-foreground">Are you sure you want to confirm this delivery? This will increase the main stock.</div>

                                                    <div className="space-y-3 p-4 rounded-2xl bg-primary/5 border border-primary/10 transition-all hover:bg-primary/10">
                                                        <div className="flex items-center gap-2">
                                                            <Truck className="h-4 w-4 text-primary" />
                                                            <Label className="text-sm font-bold uppercase tracking-wider text-foreground/80">
                                                                Driver Name (Optional)
                                                            </Label>
                                                        </div>
                                                        <Input
                                                            value={driverName}
                                                            onChange={(e) => setDriverName(e.target.value)}
                                                            placeholder="Enter driver name..."
                                                            className="h-11 rounded-xl bg-background border-primary/20 focus:border-primary transition-all text-base placeholder:text-muted-foreground/50 shadow-sm"
                                                        />
                                                    </div>

                                                    <div className="bg-muted/50 rounded-xl p-3 space-y-3 border border-muted-foreground/10 max-h-[200px] overflow-y-auto">
                                                        {Array.from(order.items.reduce((acc, item) => {
                                                            const existing = acc.get(item.farmerId) || { name: item.farmer.name, current: item.farmer.mainStock || 0, qty: 0 };
                                                            acc.set(item.farmerId, { ...existing, qty: existing.qty + item.quantity });
                                                            return acc;
                                                        }, new Map<string, { name: string, current: number, qty: number }>()).values()).map((f, i) => (
                                                            <div key={i} className="flex flex-col gap-1.5 border-b border-muted-foreground/10 last:border-0 pb-2 last:pb-0">
                                                                <div className="font-bold text-foreground text-start text-xs flex justify-between">
                                                                    <span>{f.name}</span>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className="flex flex-col items-center justify-center gap-0.5 px-2 py-1 text-[10px] font-semibold 
             bg-emerald-500/5 text-emerald-600 border-emerald-500/20"
                                                                    >
                                                                        <span className="font-bold">
                                                                            +{f.qty} New Bags
                                                                        </span>

                                                                        <span className="text-[9px] text-muted-foreground">
                                                                            {f.current} → {f.current + f.qty}
                                                                        </span>
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="gap-2">
                                                <AlertDialogCancel className="rounded-xl border-muted">Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => confirmMutation.mutate({ id: order.id, driverName })}
                                                    className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl px-6"
                                                >
                                                    {confirmMutation.isPending ? "Confirming..." : "Confirm Delivery"}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg hover:bg-muted font-bold hidden sm:flex">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32 rounded-xl p-1 border-muted">
                                        {order.status === "PENDING" && (
                                            <>
                                                <DropdownMenuItem
                                                    onClick={() => onEdit?.(order)}
                                                    className="rounded-lg gap-2 cursor-pointer font-medium text-xs py-2"
                                                >
                                                    <Pencil className="h-3.5 w-3.5 text-blue-500" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-muted opacity-50" />
                                            </>
                                        )}
                                        <DropdownMenuItem
                                            onSelect={() => setIsDeleteDialogOpen(true)}
                                            className="rounded-lg gap-2 cursor-pointer font-medium text-xs py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Mobile Menu Trigger (Visible on small screens) */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-9 rounded-lg hover:bg-muted font-bold sm:hidden flex items-center justify-center gap-2 border border-input col-span-2">
                                            <MoreHorizontal className="h-4 w-4" />

                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[90vw] rounded-xl p-1 border-muted">
                                        {order.status === "PENDING" && (
                                            <>
                                                <DropdownMenuItem
                                                    onClick={() => onEdit?.(order)}
                                                    className="rounded-lg gap-2 cursor-pointer font-medium text-xs py-3"
                                                >
                                                    <Pencil className="h-3.5 w-3.5 text-blue-500" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-muted opacity-50" />
                                            </>
                                        )}
                                        <DropdownMenuItem
                                            onSelect={() => setIsDeleteDialogOpen(true)}
                                            className="rounded-lg gap-2 cursor-pointer font-medium text-xs py-3 text-destructive focus:text-destructive focus:bg-destructive/10"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                    <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-xl font-bold">Delete Feed Order?</AlertDialogTitle>
                                            <AlertDialogDescription className="text-sm">
                                                This will permanently delete this feed order. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="gap-2">
                                            <AlertDialogCancel className="rounded-xl border-muted">Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => deleteMutation.mutate({ id: order.id })}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl px-6"
                                            >
                                                {deleteMutation.isPending ? "Deleting..." : "Delete"}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors group mt-1">
                                    {isOpen ? "Hide Draft" : "View Draft"}
                                    {isOpen ? <ChevronUp className="h-3 w-3 ml-1.5 opacity-50 group-hover:opacity-100" /> : <ChevronDown className="h-3 w-3 ml-1.5 opacity-50 group-hover:opacity-100" />}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                    </div>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="p-4 bg-muted/40 rounded-xl text-xs font-mono whitespace-pre-wrap border border-dashed border-muted-foreground/20 leading-relaxed text-muted-foreground/90">
                            {generateCopyText()}
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
