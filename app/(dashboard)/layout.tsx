
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

  let membershipData = null;

  if (session?.user) {
    const { db } = await import("@/db");
    const { user: userTable, member: memberTable } = await import("@/db/schema");
    const { eq, and } = await import("drizzle-orm");

    const userData = await db.query.user.findFirst({
      where: eq(userTable.id, session.user.id)
    });

    // Sync session user data with DB (optional, but good for activeMode)
    if (userData) {
      session.user.activeMode = userData.activeMode;
      session.user.globalRole = userData.globalRole;
    }

    if (session.session.activeOrganizationId) {
      membershipData = await db.query.member.findFirst({
        where: and(
          eq(memberTable.userId, session.user.id),
          eq(memberTable.organizationId, session.session.activeOrganizationId)
        )
      });
    }

    // If user is in Admin mode, redirect immediately before rendering sidebar
    if (userData?.globalRole === "ADMIN" && userData?.activeMode === "ADMIN") {
      redirect("/admin");
    }
  }

  return (
    <OrgGuard>
      <SidebarProvider>
        <DashboardSidebar initialSession={session} initialMembership={membershipData} />
        <main className="flex flex-col min-h-screen w-full bg-background">
          <DashboardNavbar />
          {children}
        </main>
      </SidebarProvider>
    </OrgGuard>
  );
};

export default layout;
