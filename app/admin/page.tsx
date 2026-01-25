"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, Users, Wheat } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
    return (
        <AdminGuard>
            <div className="p-4 sm:p-8 space-y-8 bg-slate-50/50 min-h-screen">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">System Administration</h1>
                        <p className="text-slate-500 text-sm">Monitor system health, oversee global production, and manage organizations.</p>
                    </div>
                </div>

                <AdminStats />

                <div className="grid gap-6 md:grid-cols-2">
                    <Card className="border-none shadow-sm hover:shadow-md transition-shadow group">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <div className="p-3 rounded-2xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-all">
                                <Building2 className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle>Organizations</CardTitle>
                                <p className="text-sm text-slate-500">Manage all registered farms and entities</p>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full h-11" variant="outline" asChild>
                                <Link href="/admin/organizations">Enter Organization Manager</Link>
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm hover:shadow-md transition-shadow group">
                        <CardHeader className="flex flex-row items-center gap-4">
                            <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                                <Users className="h-6 w-6" />
                            </div>
                            <div>
                                <CardTitle>User Directory</CardTitle>
                                <p className="text-sm text-slate-500">Global user accounts and permissions</p>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full h-11" variant="outline" disabled>
                                Global User List (Coming Soon)
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AdminGuard>
    );
}

function AdminStats() {
    const trpc = useTRPC();
    const { data: stats, isPending } = useQuery(trpc.admin.getStats.queryOptions());

    if (isPending) return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 h-32 animate-pulse bg-slate-100 rounded-xl" />;

    const items = [
        { label: "Organizations", value: stats?.orgs, icon: Building2, gradient: "from-blue-500 to-indigo-600", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
        { label: "Total Users", value: stats?.users, icon: Users, gradient: "from-emerald-500 to-teal-600", iconBg: "bg-emerald-100", iconColor: "text-emerald-600" },
        { label: "Farmers", value: stats?.farmers, icon: Wheat, gradient: "from-amber-400 to-orange-500", iconBg: "bg-amber-100", iconColor: "text-amber-600" },
        { label: "Active Cycles", value: stats?.activeCycles, icon: Activity, gradient: "from-violet-500 to-purple-600", iconBg: "bg-violet-100", iconColor: "text-violet-600" },
    ];

    return (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
                <Card key={item.label} className="border-none shadow-sm overflow-hidden relative group">
                    <div className={`absolute top-0 left-0 w-1 h-full bg-gradient-to-b ${item.gradient}`} />
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">{item.label}</CardTitle>
                        <div className={`p-2 rounded-lg ${item.iconBg} ${item.iconColor} group-hover:scale-110 transition-transform`}>
                            <item.icon className="h-4 w-4" />
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold tracking-tight">{item.value?.toLocaleString() || 0}</div>
                        <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold tracking-wider">System Total</p>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}