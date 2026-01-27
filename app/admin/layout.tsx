import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import AdminSidebar from "@/modules/admin/components/admin-sidebar";
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
            <main className="flex flex-col min-h-screen w-full bg-slate-50/50">
                <header className="flex h-14 items-center gap-4 border-b bg-white px-4 shrink-0">
                    <SidebarTrigger className="text-slate-500 hover:text-slate-900 transition-colors" />
                    <div className="h-4 w-[1px] bg-slate-200" />
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">System Administration</span>
                </header>
                {children}
            </main>
        </SidebarProvider>
    );
}
