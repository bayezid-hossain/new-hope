"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/modules/admin/components/admin-sidebar";
import React from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
