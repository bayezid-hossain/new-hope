"use client";

import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, Bird, Building2, Users, Wheat } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
    return (
        <AdminGuard>
            <div className="flex flex-col min-h-screen bg-background">
                {/* Premium Page Header */}
                <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 px-4 py-6 sm:px-8">
                    <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-sm ring-1 ring-primary/20">
                                <Activity className="h-6 w-6" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-black tracking-tighter text-foreground uppercase mb-0.5">
                                    System Intelligence
                                </h1>
                                <p className="text-muted-foreground text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Global Infrastructure & Governance</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-1 p-4 sm:p-8 max-w-7xl mx-auto w-full space-y-10 pb-20">

                    <AdminStats />

                    <div className="grid gap-8 md:grid-cols-2">
                        <Card className="border-border/50 shadow-sm hover:shadow-xl transition-all duration-300 group rounded-[2.5rem] overflow-hidden bg-card/50 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center gap-6 p-8 pb-4">
                                <div className="h-16 w-16 rounded-3xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white group-hover:rotate-3 transition-all duration-500 flex items-center justify-center shadow-inner border border-primary/20">
                                    <Building2 className="h-8 w-8" />
                                </div>
                                <div className="flex flex-col">
                                    <CardTitle className="text-2xl font-black uppercase tracking-tight">Organizations</CardTitle>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Entity Management Layer</p>
                                </div>
                            </CardHeader>
                            <CardContent className="px-8 pb-8">
                                <p className="text-sm text-muted-foreground/80 font-medium mb-6 leading-relaxed">
                                    Oversee all registered production units, manage organizational hierarchy, and monitor multi-tenant system health.
                                </p>
                                <Button className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-wider shadow-lg shadow-primary/10 hover:scale-[1.02] active:scale-[0.98] transition-all" asChild>
                                    <Link href="/admin/organizations">Enter Command Center</Link>
                                </Button>
                            </CardContent>
                        </Card>

                        <Card className="border-border/50 shadow-sm hover:shadow-xl transition-all duration-300 group rounded-[2.5rem] overflow-hidden bg-card/50 backdrop-blur-sm">
                            <CardHeader className="flex flex-row items-center gap-6 p-8 pb-4">
                                <div className="h-16 w-16 rounded-3xl bg-emerald-500/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white group-hover:-rotate-3 transition-all duration-500 flex items-center justify-center shadow-inner border border-emerald-500/20">
                                    <Users className="h-8 w-8" />
                                </div>
                                <div className="flex flex-col">
                                    <CardTitle className="text-2xl font-black uppercase tracking-tight">User Directory</CardTitle>
                                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">Identity & Access Control</p>
                                </div>
                            </CardHeader>
                            <CardContent className="px-8 pb-8">
                                <p className="text-sm text-muted-foreground/80 font-medium mb-6 leading-relaxed">
                                    Global authority for user accounts, credential management, and role-based access deployments across the system.
                                </p>
                                <Button className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-wider bg-muted text-muted-foreground/50 border-none cursor-not-allowed group-hover:bg-muted/80 transition-all" variant="outline" disabled>
                                    Global User Registry
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AdminGuard>
    );
}

function AdminStats() {
    const trpc = useTRPC();
    const { data: stats, isPending } = useQuery(trpc.admin.stats.getDashboardStats.queryOptions());

    if (isPending) {
        return (
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                {[...Array(5)].map((_, i) => (
                    <Card key={i} className="border-border/50 bg-card/50 overflow-hidden relative rounded-2xl h-32">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-8 rounded-lg" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-16 mb-2" />
                            <Skeleton className="h-3 w-20" />
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    const items = [
        { label: "Organizations", value: stats?.orgs, icon: Building2, color: "text-blue-500", ring: "ring-blue-500/20" },
        { label: "Total Accounts", value: stats?.users, icon: Users, color: "text-emerald-500", ring: "ring-emerald-500/20" },
        { label: "Farmers", value: stats?.farmers, icon: Wheat, color: "text-amber-500", ring: "ring-amber-500/20" },
        { label: "Active Cycles", value: stats?.activeCycles, icon: Activity, color: "text-violet-500", ring: "ring-violet-500/20" },
        { label: "Active Birds", value: stats?.totalActiveBirds, icon: Bird, color: "text-pink-500", ring: "ring-pink-500/20" },
    ];

    return (
        <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {items.map((item) => (
                <Card key={item.label} className="border-border/50 bg-card overflow-hidden relative group transition-all duration-300 hover:shadow-lg rounded-3xl">
                    <div className={cn("absolute top-0 left-0 w-1.5 h-full opacity-20 group-hover:opacity-100 transition-opacity", item.color.replace("text-", "bg-"))} />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-5">
                        <span className="text-[10px] uppercase font-black text-muted-foreground/60 tracking-[0.15em]">{item.label}</span>
                        <div className={cn("p-2 rounded-xl bg-muted/50 transition-all duration-300 group-hover:scale-110 ring-1", item.ring)}>
                            <item.icon className={cn("h-4 w-4", item.color)} />
                        </div>
                    </CardHeader>
                    <CardContent className="px-5 pb-5">
                        <div className="text-3xl font-black tracking-tighter text-foreground">
                            {item.value?.toLocaleString() || 0}
                        </div>
                        <p className="text-[10px] text-muted-foreground/40 mt-1 uppercase font-black tracking-widest leading-none">Global Infrastructure</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
