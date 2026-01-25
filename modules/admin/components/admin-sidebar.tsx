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
import { Building, HomeIcon, LogOut, WholeWord } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const firstSection = [
    {
        icon: HomeIcon,
        label: "Overview",
        href: "/admin",
    },
    {
        icon: Building,
        label: "Organizations",
        href: "/admin/organizations",
    },
    {
        icon: WholeWord,
        label: "Main Website",
        href: "/",
    },

];

const AdminSidebar = () => {
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
};

export default AdminSidebar;
