"use client";

import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { ProUpgradeTeaser } from "@/modules/shared/components/pro-upgrade-teaser";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { CreateFeedOrderModal } from "../components/create-feed-order-modal";
import { FeedOrderCard } from "../components/feed-order-card";

interface FeedOrdersPageProps {
    orgId: string;
}

export function FeedOrdersPage({ orgId }: FeedOrdersPageProps) {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<any>(null);

    const trpc = useTRPC();
    const { isPro, canEdit } = useCurrentOrg();

    const { data: orders, isPending } = useQuery({
        ...trpc.officer.feedOrders.list.queryOptions({
            orgId,
            limit: 50
        }),
        enabled: isPro
    });

    const handleEdit = (order: any) => {
        // ... (rest of handleEdit)
        // Group flat items by farmerId for the modal
        const farmerMap = new Map<string, any>();
        order.items.forEach((item: any) => {
            if (!farmerMap.has(item.farmerId)) {
                farmerMap.set(item.farmerId, {
                    id: item.id,
                    farmerId: item.farmerId,
                    farmerName: item.farmer.name,
                    location: item.farmer.location,
                    mobile: item.farmer.mobile,
                    feeds: []
                });
            }
            farmerMap.get(item.farmerId).feeds.push({
                type: item.feedType,
                quantity: item.quantity
            });
        });

        const groupedOrder = {
            id: order.id,
            orderDate: new Date(order.orderDate),
            deliveryDate: new Date(order.deliveryDate),
            items: Array.from(farmerMap.values())
        };

        setEditingOrder(groupedOrder);
    };

    if (!isPro) {
        return (
            <div className="space-y-6 p-4 max-w-4xl mx-auto">
                <div>
                    <h2 className="text-2xl font-black tracking-tight uppercase">Feed Orders</h2>
                    <p className="text-sm text-muted-foreground font-medium">Coordinate logistics across multiple farming units.</p>
                </div>

                <ProUpgradeTeaser
                    title="Feed Logistics Locked"
                    description="The centralized feed ordering and tracking system is a Pro feature designed for large scale operations."
                    className="py-20"
                />
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold tracking-tight">Feed Orders</h2>
                    <p className="text-sm text-muted-foreground">Manage and share feed requests</p>
                </div>
                {canEdit && (
                    <Button onClick={() => { setEditingOrder(null); setIsCreateOpen(true); }} size="sm" className="bg-primary text-primary-foreground">
                        <Plus className="h-4 w-4 mr-2" />
                        New Order
                    </Button>
                )}
            </div>
            {/* ... rest of the component */}

            {(isCreateOpen || editingOrder) && (
                <CreateFeedOrderModal
                    open={isCreateOpen || !!editingOrder}
                    onOpenChange={(open) => {
                        setIsCreateOpen(open);
                        if (!open) setEditingOrder(null);
                    }}
                    orgId={orgId}
                    initialData={editingOrder}
                />
            )}

            <div className="space-y-4">
                {isPending ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : orders && orders.length > 0 ? (
                    orders.map((order: any) => (
                        <FeedOrderCard key={order.id} order={order} onEdit={handleEdit} />
                    ))
                ) : (
                    <div className="text-center py-10 text-muted-foreground border rounded-lg border-dashed">
                        <p>No feed orders found</p>
                        {canEdit && <Button variant="link" onClick={() => { setEditingOrder(null); setIsCreateOpen(true); }}>Create your first order</Button>}
                    </div>
                )}
            </div>
        </div>
    );
}
