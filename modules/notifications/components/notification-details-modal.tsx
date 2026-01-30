
"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface NotificationDetailsModalProps {
    id: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const NotificationDetailsModal = ({ id, open, onOpenChange }: NotificationDetailsModalProps) => {
    const trpc = useTRPC();
    const router = useRouter();
    const queryClient = useQueryClient();

    // Fetch details if ID is present
    const { data: notification, isLoading } = useQuery(trpc.notifications.getDetails.queryOptions(
        { id: id! },
        {
            enabled: !!id,
            staleTime: 5 * 60 * 1000 // Cache for 5 mins
        }
    ));

    const deleteMutation = useMutation(
        trpc.notifications.delete.mutationOptions({
            onSuccess: () => {
                toast.success("Notification deleted");
                queryClient.invalidateQueries(trpc.notifications.list.pathFilter());
                onOpenChange(false);
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

    // Auto mark as read when opened and loaded
    if (open && notification && !notification.isRead && !markReadMutation.isPending && !markReadMutation.isSuccess) {
        markReadMutation.mutate({ id: notification.id });
    }

    if (!id) return null;

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title={notification?.title || "Notification Details"}
            description={notification ? format(new Date(notification.createdAt), "PPP p") : ""}
        >
            {isLoading ? (
                <div className="h-40 flex items-center justify-center">Loading...</div>
            ) : notification ? (
                <div className="space-y-6 py-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                        <p className="text-sm font-medium text-slate-900 mb-2">{notification.message}</p>
                        {notification.details && (
                            <p className="text-xs text-slate-600 whitespace-pre-wrap leading-relaxed">
                                {notification.details}
                            </p>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteMutation.mutate({ id: notification.id })}
                            disabled={deleteMutation.isPending}
                        >
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </Button>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => onOpenChange(false)}>
                                Close
                            </Button>
                            {notification.link && (
                                <Link href={notification.link} onClick={() => onOpenChange(false)}>
                                    <Button className="gap-2">
                                        View Context <ArrowRight className="h-4 w-4" />
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-4 text-center text-muted-foreground">Notification not found</div>
            )}
        </ResponsiveDialog>
    );
};
