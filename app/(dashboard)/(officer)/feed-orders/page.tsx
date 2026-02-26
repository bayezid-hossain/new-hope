"use client";

import { ProBlocker } from "@/components/pro-blocker";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { FeedOrdersPage } from "@/modules/feed-orders/ui/pages/feed-orders-page";

export default function FeedOrdersRoute() {
    const { orgId, isLoading, isPro } = useCurrentOrg();

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

    if (!isPro) {
        return <ProBlocker feature="Feed Orders" description="Manage and track feed orders seamlessly with Pro." />;
    }

    return <FeedOrdersPage orgId={orgId} />;
}
