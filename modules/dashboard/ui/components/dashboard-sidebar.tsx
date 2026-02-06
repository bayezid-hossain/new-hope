"use client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { getUserPasswordStatus } from "@/modules/settings/actions/security-actions";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, ClipboardList, HomeIcon, ShoppingBag, StarIcon, UsersIcon, WheatIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import DashboardUserButton from "./dashboard-user-button";
import { ModeToggle } from "./mode-toggle";
import { ThemeToggle } from "./theme-toggle";

const firstSection = [
  {
    icon: HomeIcon,
    label: "Dashboard",
    href: "/",
  },
  {
    icon: UsersIcon,
    label: "Cycles",
    href: "/cycles",
  },
  {
    icon: WheatIcon,
    label: "Farmers",
    href: "/farmers",
  },
  {
    icon: ShoppingBag,
    label: "Sales",
    href: "/sales",
    isPro: true,
  },
  {
    icon: ClipboardList,
    label: "Stock Ledger",
    href: "/stock-ledger",
    isPro: true,
  },
];

const secondSection = [
  {
    icon: StarIcon,
    label: "Security",
    href: "/settings/security",
  },
];

const managerSection = {
  icon: Building2,
  label: "Management",
  items: [
    {
      label: "Overview",
      href: "/management",
    },
    {
      label: "Officers",
      href: "/management/officers",
    },
    {
      label: "Farmers",
      href: "/management/farmers",
    },
    {
      label: "Cycles",
      href: "/management/cycles",
    },
  ]
};


interface DashboardSidebarProps {
  initialSession?: any;
  initialMembership?: any;
}

const DashboardSidebar = ({ initialSession, initialMembership }: DashboardSidebarProps) => {
  const pathname = usePathname();
  const trpc = useTRPC();
  const { setOpenMobile, isMobile } = useSidebar();

  // Fetch session for globalRole
  const { data: sessionData } = useQuery({
    ...trpc.auth.getSession.queryOptions(),
    initialData: initialSession
  });

  // Fetch org status for organization role
  const { data: orgStatus } = useQuery({
    ...trpc.auth.getMyMembership.queryOptions(),
    initialData: initialMembership
  });

  const [hasPassword, setHasPassword] = useState<boolean | null>(null);

  useEffect(() => {
    if (sessionData?.user) {
      getUserPasswordStatus().then((res) => setHasPassword(res.hasPassword));
    }
  }, [sessionData]);

  const filteredSecondSection = secondSection.filter((item) => {
    if (item.label === "Security" && hasPassword === false) return false;
    return true;
  });

  const isAdmin = sessionData?.user?.globalRole === "ADMIN";
  const isManager = orgStatus?.role === "OWNER" || orgStatus?.role === "MANAGER";

  const activeGlobalMode = sessionData?.user?.activeMode || "USER";
  const activeOrgMode = orgStatus?.activeMode || "OFFICER";

  const showManagementLinks = isManager && activeOrgMode === "MANAGEMENT";
  const showAdminLinks = false; // Prevent flash, auto-redirect handles admin
  const showOfficerLinks = activeOrgMode === "OFFICER" && !showManagementLinks;

  // Determine the current mode for sidebar styling
  const currentMode = showManagementLinks ? "management" : "officer";

  // Sidebar color classes based on mode
  const sidebarModeStyles = {
    officer: "", // Default styling
    management: "[&_[data-slot=sidebar-inner]]:bg-gradient-to-b [&_[data-slot=sidebar-inner]]:from-sidebar-management-from [&_[data-slot=sidebar-inner]]:to-sidebar-management-to [&_[data-sidebar=sidebar]]:bg-gradient-to-b [&_[data-sidebar=sidebar]]:from-sidebar-management-from [&_[data-sidebar=sidebar]]:to-sidebar-management-to",
  };


  return (
    <Sidebar className={cn(sidebarModeStyles[currentMode], "transition-colors duration-300")}>
      <SidebarHeader className="text-sidebar-accent-foreground">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 px-2 pt-2"
          >
            <Image
              src="/logo.png"
              height={36}
              width={36}
              alt="Feed Reminder Logo"
              unoptimized
            />
            <p className="text-2xl font-semibold">Feed Reminder</p>
          </Link>
          <div className="pt-2 pr-2">
            <ThemeToggle />
          </div>
        </div>
      </SidebarHeader>

      <div className="px-4 py-2">
        <Separator className="opacity-10" />
      </div>

      <SidebarContent>
        {/* Persistent Mode Toggle */}
        {(isAdmin || isManager) && (
          <div className="px-3 pt-2">
            <ModeToggle />
          </div>
        )}

        {showOfficerLinks && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {firstSection.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      className={cn(
                        "h-10 hover:bg-sidebar-accent/50 border border-transparent hover:border-border/10",
                        pathname === item.href &&
                        "bg-sidebar-accent border-border/10"
                      )}
                      isActive={pathname === item.href}
                    >
                      <Link
                        href={item.href}
                        onClick={() => isMobile && setOpenMobile(false)}
                        className="flex items-center gap-2"
                      >
                        <item.icon className="size-5 " />
                        <span className="text-sm font-medium tracking-tight flex-1">
                          {item.label}
                        </span>
                        {/* @ts-ignore - isPro is optional */}
                        {item.isPro && (
                          <div className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-sm leading-none">
                            PRO
                          </div>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {(showManagementLinks || showAdminLinks) && (
          <>
            <div className="px-4 py-2">
              <Separator className="opacity-10" />
            </div>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {showManagementLinks && (
                    <Collapsible defaultOpen className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton tooltip="Management">
                            <managerSection.icon className="size-5" />
                            <span className="text-sm font-medium tracking-tight">{managerSection.label}</span>
                            <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <SidebarMenuSub>
                            {managerSection.items.map((subItem) => (
                              <SidebarMenuSubItem key={subItem.href}>
                                <SidebarMenuSubButton asChild isActive={pathname === subItem.href}>
                                  <Link
                                    href={subItem.href}
                                    onClick={() => isMobile && setOpenMobile(false)}
                                  >
                                    <span>{subItem.label}</span>
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            ))}
                          </SidebarMenuSub>
                        </CollapsibleContent>
                      </SidebarMenuItem>
                    </Collapsible>
                  )}


                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <div className="px-4 py-2">
          <Separator className="opacity-10" />
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {filteredSecondSection.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-10 hover:bg-sidebar-accent/50 border border-transparent hover:border-border/10",
                      pathname === item.href &&
                      "bg-sidebar-accent border-border/10"
                    )}
                    isActive={pathname === item.href}
                  >
                    <Link
                      href={item.href}
                      onClick={() => isMobile && setOpenMobile(false)}
                    >
                      <item.icon className="size-5 " />
                      <span className="text-sm font-medium tracking-tight">
                        {item.label}
                      </span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <DashboardUserButton />
      </SidebarFooter>
    </Sidebar>
  );
};

export default DashboardSidebar;
