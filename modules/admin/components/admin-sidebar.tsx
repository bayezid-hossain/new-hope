"use client";

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
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import {
    Building2,
    ExternalLink,
    LogOut,
    ShieldCheck
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

export function AdminSidebar() {
    const pathname = usePathname();
    const router = useRouter();

    const onLogout = () => {
        authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/sign-in");
                },
            },
        });
    };

    return (
        <Sidebar>
            <SidebarHeader className="text-sidebar-accent-foreground">
                <Link
                    href="/admin"
                    className="flex items-center gap-2 px-2 pt-2 text-slate-900"
                >
                    <Image
                        src="/logo.svg"
                        height={36}
                        width={36}
                        alt="Logo"
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
                            {/* Overview */}
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    className={cn(
                                        "h-10 transition-all duration-200 hover:bg-slate-100 group",
                                        pathname === "/admin" && "bg-primary/5 text-primary font-bold border border-primary/10"
                                    )}
                                    isActive={pathname === "/admin"}
                                >
                                    <Link href="/admin">
                                        <ShieldCheck className={cn(
                                            "size-5 transition-colors",
                                            pathname === "/admin" ? "text-primary" : "text-slate-500 group-hover:text-slate-900"
                                        )} />
                                        <span className={cn(
                                            "text-sm tracking-tight",
                                            pathname === "/admin" ? "text-primary" : "text-slate-600 group-hover:text-slate-900"
                                        )}>
                                            Overview
                                        </span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            {/* Organizations */}
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    className={cn(
                                        "h-10 transition-all duration-200 hover:bg-slate-100 group",
                                        pathname.startsWith("/admin/organizations") && "bg-primary/5 text-primary font-bold border border-primary/10"
                                    )}
                                    isActive={pathname.startsWith("/admin/organizations")}
                                >
                                    <Link href="/admin/organizations">
                                        <Building2 className={cn(
                                            "size-5 transition-colors",
                                            pathname.startsWith("/admin/organizations") ? "text-primary" : "text-slate-500 group-hover:text-slate-900"
                                        )} />
                                        <span className={cn(
                                            "text-sm tracking-tight",
                                            pathname.startsWith("/admin/organizations") ? "text-primary" : "text-slate-600 group-hover:text-slate-900"
                                        )}>
                                            Organizations
                                        </span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            {/* Main Website */}
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    className="h-10 transition-all duration-200 hover:bg-slate-100 group"
                                >
                                    <Link href="/">
                                        <ExternalLink className="size-5 text-white" />
                                        <span className="text-sm tracking-tight text-white">
                                            Main Website
                                        </span>
                                    </Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="p-4 border-t">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            onClick={onLogout}

                        >
                            <LogOut className="text-white" />
                            <span className="text-sm  tracking-wider">Logout</span>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarFooter>
        </Sidebar>
    );
}
