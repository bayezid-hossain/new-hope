"use client";

import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-current-org";
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
    const { canEdit } = useCurrentOrg();
    const trpc = useTRPC();

    const { data: orders, isPending } = useQuery(
        trpc.officer.feedOrders.list.queryOptions({
            orgId,
            limit: 50
        })
    );

    return (
        <div className="space-y-4 p-4 pb-20">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold tracking-tight">Feed Orders</h2>
                    <p className="text-sm text-muted-foreground">Manage and share feed requests</p>
                </div>
                {canEdit && (
                    <Button onClick={() => setIsCreateOpen(true)} size="sm" className="bg-primary text-primary-foreground">
                        <Plus className="h-4 w-4 mr-2" />
                        New Order
                    </Button>
                )}
            </div>

            {isCreateOpen && (
                <CreateFeedOrderModal
                    open={isCreateOpen}
                    onOpenChange={setIsCreateOpen}
                    orgId={orgId}
                />
            )}

            <div className="space-y-4">
                {isPending ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : orders && orders.length > 0 ? (
                    orders.map((order: any) => (
                        <FeedOrderCard key={order.id} order={order} />
                    ))
                ) : (
                    <div className="text-center py-10 text-muted-foreground border rounded-lg border-dashed">
                        <p>No feed orders found</p>
                        {canEdit && <Button variant="link" onClick={() => setIsCreateOpen(true)}>Create your first order</Button>}
                    </div>
                )}
            </div>
        </div>
    );
}
