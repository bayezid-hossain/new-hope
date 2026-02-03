import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import AdminSidebar from "@/modules/admin/components/admin-sidebar";
import { NotificationCenter } from "@/modules/notifications/components/notification-center";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/sign-in");
    }

    // Server-side check: must be ADMIN and in ADMIN mode
    const { db } = await import("@/db");
    const { user: userTable } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const userData = await db.query.user.findFirst({
        where: eq(userTable.id, session.user.id),
    });

    if (userData?.globalRole !== "ADMIN" || userData.activeMode !== "ADMIN") {
        redirect("/");
    }

    return (
        <SidebarProvider>
            <AdminSidebar />
            <main className="flex flex-col min-h-screen w-full bg-background">
                <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-md px-6 shrink-0">
                    <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
                    <div className="h-4 w-[1px] bg-border/60" />
                    <span className="text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.2em]">System Administration</span>
                    <div className="ml-auto flex items-center gap-2">
                        <NotificationCenter />
                    </div>
                </header>
                {children}
            </main>
        </SidebarProvider>
    );
}
