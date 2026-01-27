
import { OrgGuard } from "@/components/org-guard/org-guard";
import { SidebarProvider } from "@/components/ui/sidebar";
import { auth } from "@/lib/auth";
import DashboardNavbar from "@/modules/dashboard/ui/components/dashboard-navbar";
import DashboardSidebar from "@/modules/dashboard/ui/components/dashboard-sidebar";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

interface Props {
  children: React.ReactNode;
}

const layout = async ({ children }: Props) => {
  // Check admin mode BEFORE rendering the sidebar
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (session?.user) {
    const { db } = await import("@/db");
    const { user: userTable } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const userData = await db.query.user.findFirst({
      where: eq(userTable.id, session.user.id)
    });

    // If user is in Admin mode, redirect immediately before rendering sidebar
    // Note: Management uses the same (dashboard) layout, so no redirect needed
    if (userData?.globalRole === "ADMIN" && userData?.activeMode === "ADMIN") {
      redirect("/admin");
    }
  }

  return (
    <OrgGuard>
      <SidebarProvider>
        <DashboardSidebar />
        <main className="flex flex-col min-h-screen w-full bg-muted bg-white">
          <DashboardNavbar />
          {children}
        </main>
      </SidebarProvider>
    </OrgGuard>
  );
};

export default layout;
