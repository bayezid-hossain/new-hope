"use client";

import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Calendar, ClipboardCopy, MapPin, Trash2, Weight } from "lucide-react";
import { toast } from "sonner";

interface SaleOrderCardProps {
    order: {
        id: string;
        orderDate: string | Date;
        branchName?: string | null;
        createdAt: string | Date;
        items: Array<{
            id: string;
            farmerId: string;
            totalWeight: number;
            totalDoc: number;
            avgWeight?: string | null;
            age: number;
            farmer: {
                id: string;
                name: string;
                location?: string | null;
                mobile?: string | null;
            };
        }>;
    };
}

export function SaleOrderCard({ order }: SaleOrderCardProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const deleteMutation = useMutation(
        trpc.officer.saleOrders.delete.mutationOptions({
            onSuccess: () => {
                toast.success("Sale order deleted");
                queryClient.invalidateQueries(trpc.officer.saleOrders.list.pathFilter());
            },
            onError: (err) => toast.error(`Failed to delete: ${err.message}`)
        })
    );

    const grandTotalWeight = order.items.reduce((sum, i) => sum + i.totalWeight, 0);
    const grandTotalDoc = order.items.reduce((sum, i) => sum + i.totalDoc, 0);

    const generateCopyText = () => {
        const dateStr = format(new Date(order.orderDate), "dd.MM.yy");
        let text = `Date:  ${dateStr}\n`;
        text += `Broiler Sale Plan for ${order.branchName || "___"} Branch\n\n`;

        let farmCounter = 1;

        order.items.forEach(item => {
            if (item.totalDoc <= 0 && item.totalWeight <= 0) return;

            text += `${farmCounter}. ${item.farmer.name} \n`;
            if (item.farmer.location) text += `Location: ${item.farmer.location} \n`;
            text += `Total: ${item.totalWeight} kg.\n`;
            text += `Total: ${item.totalDoc} PCs \n`;
            if (item.avgWeight) text += `Avg: ${item.avgWeight}kg \n`;
            if (item.age > 0) text += `Age: ${item.age} days\n`;
            if (item.farmer.mobile) {
                let formattedMobile = item.farmer.mobile;
                if (formattedMobile.startsWith("0")) {
                    formattedMobile = "+880 " + formattedMobile.substring(1);
                }
                text += `Mobile:  ${formattedMobile}\n`;
            }
            text += `\n`;
            farmCounter++;
        });

        text += `\nTotal- ${grandTotalWeight} kg  \n`;
        text += `Total Kg - ${grandTotalDoc} PCs \n`;
        text += `\nThanks`;

        return text;
    };

    return (
        <div className="border rounded-xl bg-card p-4 space-y-3 shadow-sm">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                        {format(new Date(order.orderDate), "dd MMM yyyy")}
                    </div>
                    {order.branchName && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {order.branchName} Branch
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                            copyToClipboard(generateCopyText());
                            toast.success("Copied to clipboard!");
                        }}
                    >
                        <ClipboardCopy className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => deleteMutation.mutate({ id: order.id })}
                        disabled={deleteMutation.isPending}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Summary */}
            <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                    <Weight className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{grandTotalWeight} kg</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                    <span className="font-medium">{grandTotalDoc} PCs</span>
                </div>
                <span className="text-muted-foreground ml-auto">
                    {order.items.length} farmer{order.items.length > 1 ? "s" : ""}
                </span>
            </div>

            {/* Farmers List */}
            <div className="space-y-1.5 pt-1 border-t">
                {order.items.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between text-xs py-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="text-muted-foreground shrink-0">{idx + 1}.</span>
                            <span className="font-medium truncate">{item.farmer.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground shrink-0">
                            <span>{item.totalWeight}kg</span>
                            <span>{item.totalDoc}pcs</span>
                            {item.age > 0 && <span>{item.age}d</span>}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
