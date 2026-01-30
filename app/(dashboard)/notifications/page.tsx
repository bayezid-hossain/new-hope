"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NotificationDetailsModal } from "@/modules/notifications/components/notification-details-modal";
import { NotificationItem, NotificationType } from "@/modules/notifications/components/notification-item";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Loader2, Search, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function NotificationsPage() {
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const { data: sessionData, isLoading: sessionLoading } = useQuery(trpc.auth.getSession.queryOptions());
    const { data: membershipData, isLoading: membershipLoading } = useQuery(trpc.auth.getMyMembership.queryOptions());

    const isAdmin = sessionData?.user?.globalRole === "ADMIN";
    const isManager = membershipData?.role === "MANAGER" || membershipData?.role === "OWNER";
    const canSeeNotifications = isAdmin || isManager;

    const { data, isLoading: queryLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useInfiniteQuery({
            ...trpc.notifications.list.infiniteQueryOptions(
                { limit: 20, search: search || undefined },
            ),
            getNextPageParam: (lastPage: any) => lastPage.nextCursor,
            initialPageParam: 0,
            enabled: canSeeNotifications
        });

    const isLoading = queryLoading || sessionLoading || membershipLoading;

    if (!isLoading && !canSeeNotifications) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                <ShieldAlert className="h-12 w-12 text-red-500 mb-4" />
                <h3 className="text-xl font-bold">Access Denied</h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                    Notifications are only available for Administrators and Managers.
                    Officers do not have access to this notification center.
                </p>
            </div>
        );
    }

    const markAllReadMutation = useMutation(
        trpc.notifications.markAllAsRead.mutationOptions({
            onSuccess: () => {
                toast.success("All notifications marked as read");
                queryClient.invalidateQueries(trpc.notifications.list.pathFilter());
                queryClient.invalidateQueries(trpc.notifications.getUnreadCount.pathFilter());
            }
        })
    );

    const handleNotificationClick = (n: any) => {
        if (!n.link) {
            setSelectedId(n.id);
            setDetailsOpen(true);
        }
    };

    const allItems = data?.pages.flatMap((page: any) => page.items) || [];

    return (
        <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
            <div className="flex items-center justify-between space-y-2">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 w-full">
                    <h2 className="text-3xl font-bold tracking-tight">Notifications</h2>
                    <div className="flex w-full sm:w-auto gap-2">
                        <Button
                            variant="outline"
                            onClick={() => markAllReadMutation.mutate()}
                            disabled={markAllReadMutation.isPending}
                        >
                            <CheckCheck className="h-4 w-4 mr-2" /> Mark all as read
                        </Button>
                    </div>
                </div>
            </div>

            <div className="mt-6 space-y-4">
                <div className="relative max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search notifications..."
                        className="pl-9 bg-white"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="bg-white rounded-lg border shadow-sm">
                    {isLoading ? (
                        <div className="flex items-center justify-center p-12 text-muted-foreground">
                            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading notifications...
                        </div>
                    ) : allItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                            <p>No notifications found</p>
                            {search && <Button variant="link" onClick={() => setSearch("")} className="mt-2">Clear search</Button>}
                        </div>
                    ) : (
                        <div className="divide-y">
                            {allItems.map((item: any) => (
                                <NotificationItem
                                    key={item.id}
                                    id={item.id}
                                    title={item.title}
                                    message={item.message}
                                    type={item.type as NotificationType}
                                    createdAt={item.createdAt}
                                    isRead={item.isRead}
                                    link={item.link}
                                    onClick={() => handleNotificationClick(item)}
                                    className="px-4 py-4"
                                />
                            ))}
                        </div>
                    )}

                    {hasNextPage && (
                        <div className="p-4 border-t bg-slate-50 flex justify-center sticky bottom-0">
                            <Button
                                variant="outline"
                                onClick={() => fetchNextPage()}
                                disabled={isFetchingNextPage}
                                className="w-full sm:w-auto"
                            >
                                {isFetchingNextPage ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...
                                    </>
                                ) : (
                                    "Load Older Notifications"
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <NotificationDetailsModal
                id={selectedId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />
        </div>
    );
}
