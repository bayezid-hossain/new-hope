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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Copy, Trash2, Truck } from "lucide-react";
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
}

export function FeedOrderCard({ order }: FeedOrderCardProps) {
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
            text += `Farm No ${farmCounter.toString().padStart(2, '0')}\n`;
            text += `${farmer.name}\n`; // User example shows name directly, sometimes "Farmer: Name"
            if (farmer.location) text += `Location: ${farmer.location}\n`;
            if (farmer.mobile) text += `Phone: ${farmer.mobile}\n`;

            items.forEach(item => {
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
        navigator.clipboard.writeText(text);
        toast.success("Order copied to clipboard!");
    };

    const totalBags = order.items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className="w-full">
                <CardHeader className="p-4 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                            <CardTitle className="text-base font-semibold flex items-center gap-2">
                                <Truck className="h-4 w-4 text-primary" />
                                Order: {format(new Date(order.orderDate), "dd/MM/yyyy")}
                            </CardTitle>
                            <span className="text-xs text-muted-foreground">
                                Delivery: {format(new Date(order.deliveryDate), "dd/MM/yyyy")} • {totalBags} Bags
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleCopy}>
                                <Copy className="h-3 w-3 mr-2" />
                                Copy
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Delete Feed Order?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete this feed order. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => deleteMutation.mutate({ id: order.id })}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm">
                                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                    </div>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent className="p-4 pt-0">
                        <div className="mt-2 p-3 bg-muted rounded-md text-xs font-mono whitespace-pre-wrap border">
                            {generateCopyText()}
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
