"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Activity, Building2, Users, Wheat } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
    const [searchQuery, setSearchQuery] = useState("");

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
                        <p className="text-slate-500 text-sm">Manage organizations, monitors system health, and oversee members.</p>
                    </div>
                    <CreateOrgButton />
                </div>

                <AdminStats />

                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <h2 className="text-xl font-semibold text-slate-800">All Organizations</h2>
                        <div className="relative w-full sm:w-72">
                            <Input
                                placeholder="Search organizations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-white border-slate-200 focus:ring-primary/20"
                            />
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        </div>
                    </div>
                    <OrgList searchQuery={searchQuery} />
                </div>
            </div>
        </AdminGuard>
    );
}

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
                <Card key={item.label} className=" py-2 border-none shadow-sm overflow-hidden relative group">
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

function CreateOrgButton() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const createMutation = useMutation(
        trpc.admin.createOrganization.mutationOptions({
            onSuccess: () => {
                toast.success("Organization created successfully");
                queryClient.invalidateQueries(trpc.admin.getAllOrgs.queryOptions());
                queryClient.invalidateQueries(trpc.admin.getStats.queryOptions());
                setOpen(false);
                setName("");
                setSlug("");
            },
            onError: (err) => toast.error(err.message)
        })
    );

    return (
        <>
            <Button onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Create Organization
            </Button>

            <ResponsiveDialog
                open={open}
                onOpenChange={setOpen}
                title="Create New Organization"
                description="Enter the details below to create a new organization."
            >
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Organization Name</Label>
                        <Input
                            placeholder="e.g. Sunny Side Farms"
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value);
                                setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
                            }}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>URL Slug</Label>
                        <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
                    </div>
                    <Button
                        className="w-full"
                        onClick={() => createMutation.mutate({ name, slug })}
                        disabled={createMutation.isPending || !name || !slug}
                    >
                        {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Organization
                    </Button>
                </div>
            </ResponsiveDialog>
        </>
    );
}
function OrgList({ searchQuery }: { searchQuery: string }) {
    const trpc = useTRPC();
    const { data: orgs, isPending } = useQuery(trpc.admin.getAllOrgs.queryOptions());

    const filteredOrgs = orgs?.filter(org =>
        org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        org.slug.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (isPending) return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse bg-slate-100 rounded-xl" />)}
        </div>
    );

    return (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrgs?.map((org) => (
                <Card key={org.id} className="group relative hover:shadow-lg transition-all border-slate-200 overflow-hidden bg-white">
                    <div className="absolute top-0 left-0 w-full h-[3px] bg-slate-100 group-hover:bg-primary/50 transition-colors" />
                    <CardHeader className="flex flex-row items-start justify-between pb-4">
                        <div className="space-y-1">
                            <CardTitle className="text-xl font-bold text-slate-900 leading-none">{org.name}</CardTitle>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase tracking-wider">
                                    {org.slug}
                                </span>
                            </div>
                        </div>
                        <EditOrgDialog org={org} />
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between text-xs text-slate-500">
                            <div className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                <span>{org.members.length} Members</span>
                            </div>
                            <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-semibold text-[10px]">Active</span>
                        </div>

                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="secondary" className="w-full justify-center bg-slate-50 hover:bg-slate-100 text-slate-700 border-none">
                                    <Users className="h-4 w-4 mr-2" />
                                    Manage Members
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="w-full sm:max-w-[600px] overflow-y-auto">
                                <SheetHeader className="mb-6">
                                    <SheetTitle className="text-2xl font-bold flex items-center gap-2">
                                        <Building2 className="h-6 w-6 text-primary" />
                                        Members: {org.name}
                                    </SheetTitle>
                                </SheetHeader>
                                <div className="mt-4">
                                    <MembersList orgId={org.id} />
                                </div>
                            </SheetContent>
                        </Sheet>
                    </CardContent>
                </Card>
            ))}
            {filteredOrgs?.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white rounded-xl border-2 border-dashed border-slate-200">
                    <Users className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium italic">No organizations found matching your search.</p>
                </div>
            )}
        </div>
    );
}