"use client";

import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { ProUpgradeTeaser } from "@/modules/shared/components/pro-upgrade-teaser";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";

import { CreateDocOrderModal } from "../components/create-doc-order-modal";
import { DocOrderCard } from "../components/doc-order-card";

interface DocOrdersPageProps {
    orgId: string;
}

export function DocOrdersPage({ orgId }: DocOrdersPageProps) {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<any>(null);

    const trpc = useTRPC();
    const { isPro, canEdit } = useCurrentOrg();

    const { data: orders, isPending } = useQuery({
        ...trpc.officer.docOrders.list.queryOptions({
            orgId,
            limit: 50
        }),
        enabled: isPro
    });

    const handleEdit = (order: any) => {
        // Group items for the modal if needed, or pass as is.
        // The modal expects a specific structure. 
        // Our backend returns items as an array. The modal should handle it.
        // Let's pass the raw order and let the modal sanitize/map it.

        setEditingOrder(order);
    };

    if (!isPro) {
        return (
            <div className="space-y-6 p-4 max-w-4xl mx-auto">
                <div>
                    <h2 className="text-2xl font-black tracking-tight uppercase">DOC Orders</h2>
                    <p className="text-sm text-muted-foreground font-medium">Coordinate DOC logistics across multiple farming units.</p>
                </div>

                <ProUpgradeTeaser
                    title="DOC Logistics Locked"
                    description="The centralized DOC ordering and tracking system is a Pro feature designed for large scale operations."
                    className="py-20"
                />
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4 pb-20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-y-4 sm:gap-y-0 justify-between">
                <div>
                    <h2 className="text-lg font-bold tracking-tight">DOC Orders</h2>
                    <p className="text-sm text-muted-foreground">Manage and share DOC requests</p>
                </div>
                {canEdit && (
                    <Button onClick={() => { setEditingOrder(null); setIsCreateOpen(true); }} size="sm" className="bg-primary text-primary-foreground">
                        <Plus className="h-4 w-4 mr-2" />
                        New Order
                    </Button>
                )}
            </div>

            {(isCreateOpen || editingOrder) && (
                <CreateDocOrderModal
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
                        <DocOrderCard key={order.id} order={order} onEdit={handleEdit} />
                    ))
                ) : (
                    <div className="text-center py-10 text-muted-foreground border rounded-lg border-dashed">
                        <p>No DOC orders found</p>
                        {canEdit && <Button variant="link" onClick={() => { setEditingOrder(null); setIsCreateOpen(true); }}>Create your first order</Button>}
                    </div>
                )}
            </div>
        </div>
    );
}
