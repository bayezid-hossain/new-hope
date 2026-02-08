"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ManagementGuard } from "@/modules/management/components/management-guard";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, ChevronUp, Copy, Package, Search, Truck, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function ManagementFeedOrdersPage() {
    const trpc = useTRPC();
    const [selectedOfficer, setSelectedOfficer] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const { data: statusData } = useQuery(
        trpc.auth.getMyMembership.queryOptions()
    );

    const { data: officers } = useQuery({
        ...trpc.management.officers.getProductionTree.queryOptions({
            orgId: statusData?.orgId || ""
        }),
        enabled: !!statusData?.orgId
    });

    const { data: orders, isLoading } = useQuery({
        ...trpc.management.feedOrders.list.queryOptions({
            orgId: statusData?.orgId || "",
            officerId: selectedOfficer === "all" ? undefined : selectedOfficer,
            limit: 100
        }),
        enabled: !!statusData?.orgId
    });

    // Filter by search query
    const filteredOrders = orders?.filter((order: any) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        // Search by officer name or farmer names in items
        return (
            order.officer?.name?.toLowerCase().includes(query) ||
            order.items.some((item: any) => item.farmer?.name?.toLowerCase().includes(query))
        );
    });

    return (
        <ManagementGuard>
            <div className="flex flex-col min-h-screen bg-muted/5">
                <div className="flex-1 p-3 sm:p-6 space-y-6 max-w-4xl mx-auto w-full">
                    {/* Header */}
                    <div className="flex flex-col gap-4">
                        <div className="flex items-center gap-2">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">Feed Orders</h1>
                                <p className="text-xs text-muted-foreground">View all feed orders from officers</p>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-muted-foreground/70" />
                                </div>
                                <Input
                                    placeholder="Search by officer or farmer..."
                                    className="pl-9 bg-background/50 backdrop-blur"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={selectedOfficer} onValueChange={setSelectedOfficer}>
                                <SelectTrigger className="w-full sm:w-[200px]">
                                    <SelectValue placeholder="Filter by officer" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Officers</SelectItem>
                                    {officers?.map((officer) => (
                                        <SelectItem key={officer.userId} value={officer.userId}>
                                            {officer.name || "Unknown"}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Orders List */}
                    {isLoading ? (
                        <div className="space-y-4">
                            {[...Array(3)].map((_, i) => (
                                <Skeleton key={i} className="h-32 w-full rounded-xl" />
                            ))}
                        </div>
                    ) : filteredOrders && filteredOrders.length > 0 ? (
                        <div className="space-y-4">
                            {filteredOrders.map((order) => (
                                <ManagementFeedOrderCard key={order.id} order={order} />
                            ))}
                        </div>
                    ) : (
                        <Card className="border-dashed bg-muted/30">
                            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <Package className="h-6 w-6 text-muted-foreground" />
                                </div>
                                <h3 className="text-lg font-medium text-foreground">No feed orders found</h3>
                                <p className="text-sm text-muted-foreground max-w-xs mx-auto mt-2">
                                    {searchQuery || selectedOfficer !== "all"
                                        ? "No orders match your filters."
                                        : "Feed orders from officers will appear here."}
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </ManagementGuard>
    );
}

// Separate card component for management view (shows officer info)
function ManagementFeedOrderCard({ order }: {
    order: {
        id: string;
        orderDate: Date | string;
        deliveryDate: Date | string;
        officer?: {
            id: string;
            name: string;
            email: string;
            image: string | null;
        } | null;
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
    }
}) {
    const [isOpen, setIsOpen] = useState(false);

    const generateCopyText = () => {
        const orderDateStr = format(new Date(order.orderDate), "d MMM yy");
        const deliveryDateStr = format(new Date(order.deliveryDate), "d MMM yy");

        let text = `Dear sir,\nFeed order date: ${orderDateStr}\nFeed delivery date: ${deliveryDateStr}\n`;

        text += `\n`;

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

        farmerMap.forEach((items) => {
            const farmer = items[0].farmer;
            text += `Farm No ${farmCounter.toString().padStart(2, '0')}\n`;
            text += `${farmer.name}\n`;
            if (farmer.location) text += `Location: ${farmer.location}\n`;
            if (farmer.mobile) text += `Phone: ${farmer.mobile}\n`;

            items.forEach(item => {
                text += `${item.feedType}: ${item.quantity} Bags\n`;
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
        text += `\nGrand Total: ${grandTotal} Bags`;

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
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src={order.officer?.image || undefined} />
                                    <AvatarFallback>
                                        <User className="h-4 w-4" />
                                    </AvatarFallback>
                                </Avatar>
                                <div>
                                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                                        <Truck className="h-4 w-4 text-primary" />
                                        Order: {format(new Date(order.orderDate), "dd MMM")}
                                    </CardTitle>
                                    <span className="text-xs text-muted-foreground">
                                        by {order.officer?.name || "Unknown"} • {totalBags} Bags
                                    </span>
                                </div>
                            </div>
                            <span className="text-xs text-muted-foreground ml-11">
                                Delivery: {format(new Date(order.deliveryDate), "dd MMM yyyy")}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleCopy}>
                                <Copy className="h-3 w-3 mr-2" />
                                Copy
                            </Button>
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
