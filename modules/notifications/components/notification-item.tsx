
"use client";

import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, AlertTriangle, CheckCircle, Info, RefreshCw } from "lucide-react";
import Link from "next/link";
import { forwardRef } from "react";

export type NotificationType = "INFO" | "WARNING" | "CRITICAL" | "SUCCESS" | "UPDATE";

interface NotificationItemProps {
    id: string;
    title: string;
    message: string;
    type: NotificationType;
    createdAt: Date | string;
    isRead: boolean;
    link?: string | null;
    onClick?: () => void;
    className?: string; // Allow external styling
}

export const NotificationItem = forwardRef<HTMLDivElement, NotificationItemProps>(({
    id,
    title,
    message,
    type,
    createdAt,
    isRead,
    link,
    onClick,
    className
}, ref) => {

    // Icon mapping
    const getIcon = () => {
        switch (type) {
            case "WARNING": return <AlertTriangle className="h-4 w-4 text-amber-600" />;
            case "CRITICAL": return <AlertCircle className="h-4 w-4 text-red-600" />;
            case "SUCCESS": return <CheckCircle className="h-4 w-4 text-emerald-600" />;
            case "UPDATE": return <RefreshCw className="h-4 w-4 text-blue-600" />;
            default: return <Info className="h-4 w-4 text-slate-500" />;
        }
    };

    // Background color mapping for unread state
    const bgClass = isRead ? "bg-white" : "bg-slate-50";

    const Content = (
        <div
            ref={ref}
            onClick={onClick}
            className={cn(
                "flex gap-3 p-3 text-sm transition-colors hover:bg-slate-100 cursor-pointer relative",
                bgClass,
                className
            )}
        >
            {!isRead && (
                <div className="absolute left-0 top-3 h-2 w-2 rounded-full bg-blue-600 mx-1" />
            )}

            <div className={cn("mt-1 flex-shrink-0", !isRead && "ml-2")}>
                <div className={cn("h-8 w-8 rounded-full flex items-center justify-center bg-white border shadow-sm")}>
                    {getIcon()}
                </div>
            </div>

            <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                    <p className={cn("font-medium leading-none", !isRead ? "text-slate-900 font-semibold" : "text-slate-700")}>
                        {title}
                    </p>
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                        {formatDistanceToNow(new Date(createdAt), { addSuffix: true })}
                    </span>
                </div>
                <p className={cn("text-xs line-clamp-2", !isRead ? "text-slate-600" : "text-slate-500")}>
                    {message}
                </p>
            </div>
        </div>
    );

    if (link) {
        return (
            <Link href={link} className="block focus:outline-none" onClick={onClick}>
                {Content}
            </Link>
        );
    }

    return Content;
});

NotificationItem.displayName = "NotificationItem";
