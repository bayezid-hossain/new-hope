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
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Building2, ChevronRight, HistoryIcon, HomeIcon, ShieldCheck, StarIcon, UsersIcon, WheatIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardUserButton from "./dashboard-user-button";

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
    icon: HistoryIcon,
    label: "History",
    href: "/history",
  },
  {
    icon: WheatIcon,
    label: "Farmers",
    href: "/farmers",
  },
];

const secondSection = [
  {
    icon: StarIcon,
    label: "Upgrade",
    href: "/upgrade",
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


const DashboardSidebar = () => {
  const pathname = usePathname();
  const trpc = useTRPC();

  // Fetch session for globalRole
  const { data: sessionData } = useQuery(trpc.auth.getSession.queryOptions());

  // Fetch org status for organization role
  const { data: orgStatus } = useQuery(trpc.auth.getMyMembership.queryOptions());

  const isAdmin = sessionData?.user?.globalRole === "ADMIN";
  const isManager = orgStatus?.role === "OWNER" || orgStatus?.role === "MANAGER";

  return (
    <Sidebar>
      <SidebarHeader className="text-sidebar-accent-foreground">
        <Link
          href="/"
          className="flex items-center gap-2 px-2 pt-2"
        >
          <Image
            src="/logo.svg"
            height={36}
            width={36}
            alt="Feed Reminder Logo"
          />
          <p className="text-2xl font-semibold">Feed Reminder</p>
        </Link>
      </SidebarHeader>

      <div className="px-4 py-2">
        <Separator className="opacity-10 text-[#5D6B68]" />
      </div>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {firstSection.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-10 hover:bg-linear-to-r/oklch border border-transparent hover:border[#5D6B68]/10 from-sidebar-accent from-5% via-30% via-sidebar/50 to-sidebar/50",
                      pathname === item.href &&
                      "bg-linear-to-r/oklch border-[#5D6B68]/10"
                    )}
                    isActive={pathname === item.href}
                  >
                    <Link href={item.href}>
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

        {(isAdmin || isManager) && (
          <>
            <div className="px-4 py-2">
              <Separator className="opacity-10 text-[#5D6B68]" />
            </div>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {isManager && (
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
                                  <Link href={subItem.href}>
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

                  {isAdmin && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        asChild
                        className={cn(
                          "h-10 hover:bg-linear-to-r/oklch border border-transparent hover:border[#5D6B68]/10 from-sidebar-accent from-5% via-30% via-sidebar/50 to-sidebar/50",
                          pathname === "/admin" &&
                          "bg-linear-to-r/oklch border-[#5D6B68]/10"
                        )}
                        isActive={pathname === "/admin"}
                      >
                        <Link href="/admin">
                          <ShieldCheck className="size-5" />
                          <span className="text-sm font-medium tracking-tight">
                            System Admin
                          </span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <div className="px-4 py-2">
          <Separator className="opacity-10 text-[#5D6B68]" />
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {secondSection.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    className={cn(
                      "h-10 hover:bg-linear-to-r/oklch border border-transparent hover:border[#5D6B68]/10 from-sidebar-accent from-5% via-30% via-sidebar/50 to-sidebar/50",
                      pathname === item.href &&
                      "bg-linear-to-r/oklch border-[#5D6B68]/10"
                    )}
                    isActive={pathname === item.href}
                  >
                    <Link href={item.href}>
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
      <SidebarFooter className="text-white">
        <DashboardUserButton />
      </SidebarFooter>
    </Sidebar>
  );
};

export default DashboardSidebar;
