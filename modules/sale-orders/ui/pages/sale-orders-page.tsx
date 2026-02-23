"use client";

import { Button } from "@/components/ui/button";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { ProUpgradeTeaser } from "@/modules/shared/components/pro-upgrade-teaser";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { CreateSaleOrderModal } from "../components/create-sale-order-modal";
import { SaleOrderCard } from "../components/sale-order-card";

interface SaleOrdersPageProps {
    orgId: string;
}

export function SaleOrdersPage({ orgId }: SaleOrdersPageProps) {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const { isPro, canEdit } = useCurrentOrg();

    const trpc = useTRPC();

    const { data: orders, isPending } = useQuery({
        ...trpc.officer.saleOrders.list.queryOptions({
            orgId,
            limit: 50
        }),
        enabled: isPro
    });

    if (!isPro) {
        return (
            <div className="space-y-6 p-4 max-w-4xl mx-auto">
                <div>
                    <h2 className="text-2xl font-black tracking-tight uppercase">Sale Orders</h2>
                    <p className="text-sm text-muted-foreground font-medium">Create and share broiler sale plans.</p>
                </div>

                <ProUpgradeTeaser
                    title="Sale Orders Locked"
                    description="The sale order generator is a Pro feature designed for coordinating broiler sales."
                    className="py-20"
                />
            </div>
        );
    }

    return (
        <div className="space-y-4 p-4 pb-20">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-y-4 sm:gap-y-0 justify-between">
                <div>
                    <h2 className="text-lg font-bold tracking-tight">Sale Orders</h2>
                    <p className="text-sm text-muted-foreground">Create and share broiler sale plans</p>
                </div>
                {canEdit && (
                    <Button onClick={() => setIsCreateOpen(true)} size="sm" className="bg-primary text-primary-foreground">
                        <Plus className="h-4 w-4 mr-2" />
                        New Sale Order
                    </Button>
                )}
            </div>

            {isCreateOpen && (
                <CreateSaleOrderModal
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
                        <SaleOrderCard key={order.id} order={order} />
                    ))
                ) : (
                    <div className="text-center py-10 text-muted-foreground border rounded-lg border-dashed">
                        <p>No sale orders found</p>
                        {canEdit && <Button variant="link" onClick={() => setIsCreateOpen(true)}>Create your first sale order</Button>}
                    </div>
                )}
            </div>
        </div>
    );
}
