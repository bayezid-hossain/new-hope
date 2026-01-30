
"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Loader2, Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { NotificationDetailsModal } from "./notification-details-modal";
import { NotificationItem, NotificationType } from "./notification-item";

export const NotificationCenter = () => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detailsOpen, setDetailsOpen] = useState(false);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const { data: sessionData } = useQuery(trpc.auth.getSession.queryOptions());
    const { data: membershipData } = useQuery(trpc.auth.getMyMembership.queryOptions());

    const isAdminMode = sessionData?.user?.activeMode === "ADMIN";
    const isManagementMode = membershipData?.activeMode === "MANAGEMENT";
    const canSeeNotifications = isAdminMode || isManagementMode;

    const { data: unreadData } = useQuery(trpc.notifications.getUnreadCount.queryOptions(
        undefined, {
        refetchInterval: 30000,
        enabled: canSeeNotifications
    }));

    const { data: notifications, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useInfiniteQuery({
            ...trpc.notifications.list.infiniteQueryOptions(
                { limit: 10, search: search || undefined },
            ),
            getNextPageParam: (lastPage: any) => lastPage.nextCursor,
            initialPageParam: 0,
            enabled: open && canSeeNotifications
        });

    const markAllReadMutation = useMutation(
        trpc.notifications.markAllAsRead.mutationOptions({
            onSuccess: () => {
                toast.success("All marked as read");
                queryClient.invalidateQueries(trpc.notifications.list.pathFilter());
                queryClient.invalidateQueries(trpc.notifications.getUnreadCount.pathFilter());
            }
        })
    );

    const markReadMutation = useMutation(
        trpc.notifications.markAsRead.mutationOptions({
            onSuccess: () => {
                queryClient.invalidateQueries(trpc.notifications.list.pathFilter());
                queryClient.invalidateQueries(trpc.notifications.getUnreadCount.pathFilter());
            }
        })
    );

    if (!canSeeNotifications) {
        return null;
    }

    const handleNotificationClick = (n: any) => {
        if (!n.isRead) {
            markReadMutation.mutate({ id: n.id });
        }

        if (n.link) {
            setOpen(false); // Close dropdown if navigating
        } else {
            setSelectedId(n.id);
            setDetailsOpen(true);
        }
    };

    const allItems = notifications?.pages.flatMap((page: any) => page.items) || [];
    const unreadCount = unreadData?.count || 0;

    const getEffectiveLink = (link: string | null | undefined, orgId: string | null | undefined) => {
        if (!link) return null;
        const isAdminMode = sessionData?.user?.activeMode === "ADMIN";
        if (isAdminMode && orgId) {
            return link.replace(/^\/management/, `/admin/organizations/${orgId}`);
        }
        return link;
    };

    return (
        <>
            <DropdownMenu open={open} onOpenChange={setOpen}>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative text-slate-500 hover:text-slate-900">
                        <Bell className="h-5 w-5" />
                        {unreadCount > 0 && (
                            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-red-600 border-2 border-white box-content" />
                        )}
                        <span className="sr-only">Toggle notifications</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80 sm:w-96 p-0 overflow-hidden" sideOffset={8}>
                    {/* Header */}
                    <div className="p-4 border-b bg-white relative z-10">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-sm">Notifications</h3>
                            {unreadCount > 0 && (
                                <Badge variant="secondary" className="text-xs font-normal">
                                    {unreadCount} unread
                                </Badge>
                            )}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Search notifications..."
                                className="pl-9 h-9 text-xs"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* List */}
                    <ScrollArea className="h-[400px]">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-20 text-slate-400">
                                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
                            </div>
                        ) : allItems.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-center px-6">
                                <Bell className="h-8 w-8 mb-2 opacity-20" />
                                <p className="text-sm">No notifications yet</p>
                                {search && <p className="text-xs text-muted-foreground mt-1">Try a different search term</p>}
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100">
                                {allItems.map((item: any) => (
                                    <NotificationItem
                                        key={item.id}
                                        id={item.id}
                                        title={item.title}
                                        message={item.message}
                                        type={item.type as NotificationType}
                                        createdAt={item.createdAt}
                                        isRead={item.isRead}
                                        link={getEffectiveLink(item.link, item.organizationId)}
                                        onClick={() => handleNotificationClick(item)}
                                    />
                                ))}
                                {hasNextPage && (
                                    <div className="p-2 text-center">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => fetchNextPage()}
                                            disabled={isFetchingNextPage}
                                            className="text-xs text-muted-foreground w-full h-8"
                                        >
                                            {isFetchingNextPage ? <Loader2 className="h-3 w-3 animate-spin" /> : "Load more"}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </ScrollArea>

                    {/* Footer */}
                    <div className="p-2 border-t bg-slate-50 flex items-center justify-between">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-slate-500"
                            onClick={() => markAllReadMutation.mutate()}
                            disabled={unreadCount === 0 || markAllReadMutation.isPending}
                        >
                            <CheckCheck className="h-3.5 w-3.5 mr-1.5" /> Mark all read
                        </Button>
                        <Link href="/notifications" onClick={() => setOpen(false)}>
                            <Button variant="ghost" size="sm" className="h-8 text-xs text-primary font-medium hover:text-primary hover:bg-primary/5">
                                View History
                            </Button>
                        </Link>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>

            <NotificationDetailsModal
                id={selectedId}
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
            />
        </>
    );
};
