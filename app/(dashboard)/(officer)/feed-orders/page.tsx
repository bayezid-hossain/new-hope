"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { FeedOrdersPage } from "@/modules/feed-orders/ui/pages/feed-orders-page";

export default function FeedOrdersRoute() {
    const { orgId, isLoading } = useCurrentOrg();

    if (isLoading) {
        return (
            <div className="p-4 space-y-4 max-w-2xl mx-auto">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
            </div>
        );
    }

    if (!orgId) {
        return (
            <div className="p-4 text-center text-muted-foreground">
                <p>Please select an organization to continue.</p>
            </div>
        );
    }

    return <FeedOrdersPage orgId={orgId} />;
}
