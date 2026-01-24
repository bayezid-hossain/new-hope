
import { OrgGuard } from "@/components/org-guard/org-guard";
import { SidebarProvider } from "@/components/ui/sidebar";
import DashboardNavbar from "@/modules/dashboard/ui/components/dashboard-navbar";
import DashboardSidebar from "@/modules/dashboard/ui/components/dashboard-sidebar";
import React from "react";

interface Props {
  children: React.ReactNode;
}
const layout = ({ children }: Props) => {
  return (
    <OrgGuard>
      <SidebarProvider>
        <DashboardSidebar />
        <main className="flex flex-col min-h-screen w-full bg-muted bg-white">
          <DashboardNavbar />
          {children}
        </main>
      </SidebarProvider></OrgGuard>
  );
};

export default layout;
