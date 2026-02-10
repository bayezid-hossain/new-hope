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
import { copyToClipboard } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Copy, MoreHorizontal, Pencil, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FeedOrderCardProps {
    order: {
        id: string;
        orderDate: Date | string;
        deliveryDate: Date | string;
        items: {
            farmerId: string;
            feedType: string;
            quantity: number;
            farmer: {
                name: string;
                location: string | null;
                mobile: string | null;
            };
        }[];
    };
    onEdit?: (order: any) => void;
}

export function FeedOrderCard({ order, onEdit }: FeedOrderCardProps) {
    const [isOpen, setIsOpen] = useState(false);
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

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="w-full overflow-hidden border-none shadow-md bg-card/50 hover:bg-card/80 transition-all duration-300">
                <CardHeader className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-3">
                            <div className="mt-1 p-2 rounded-xl bg-primary/10 text-primary shrink-0">
                                <Truck className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Delivery Date</span>
                                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-bold bg-primary/20 text-primary border-none">
                                        {totalBags} Bags
                                    </Badge>
                                </div>
                                <CardTitle className="text-xl font-black tracking-tight leading-none text-foreground">
                                    {format(new Date(order.deliveryDate), "dd MMM, yyyy")}
                                </CardTitle>
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
                                    <span>Ordered: {format(new Date(order.orderDate), "dd/MM/yyyy")}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopy}
                                    className="h-8 rounded-lg px-3 bg-primary text-primary-foreground hover:bg-primary/90 border-none shadow-sm transition-all active:scale-95"
                                >
                                    <Copy className="h-3.5 w-3.5 mr-2" />
                                    Copy
                                </Button>

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg hover:bg-muted font-bold">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32 rounded-xl p-1 border-muted">
                                        <DropdownMenuItem
                                            onClick={() => onEdit?.(order)}
                                            className="rounded-lg gap-2 cursor-pointer font-medium text-xs py-2"
                                        >
                                            <Pencil className="h-3.5 w-3.5 text-blue-500" />
                                            Edit
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className="bg-muted opacity-50" />
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <div className="flex items-center w-full px-2 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-lg cursor-pointer gap-2" onClick={(e) => e.stopPropagation()}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                    Delete
                                                </div>
                                            </AlertDialogTrigger>
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
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors group">
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
