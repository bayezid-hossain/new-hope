"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { EditOrgDialog } from "@/modules/admin/components/edit-organization-dialog";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

export default function OrganizationsPage() {
    const [searchQuery, setSearchQuery] = useState("");

    return (
        <AdminGuard>
            <div className="p-4 sm:p-8 space-y-8 bg-slate-50/50 min-h-screen">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Organizations</h1>
                        <p className="text-slate-500 text-sm">Manage and oversee all registered organizations in the system.</p>
                    </div>
                    <CreateOrgButton />
                </div>

                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="relative w-full sm:w-72">
                            <Input
                                placeholder="Search organizations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 bg-white border-slate-200 focus:ring-primary/20"
                            />
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        </div>
                    </div>
                    <OrgList searchQuery={searchQuery} />
                </div>
            </div>
        </AdminGuard>
    );
}

function CreateOrgButton() {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const createMutation = useMutation(
        trpc.admin.organizations.create.mutationOptions({
            onSuccess: () => {
                toast.success("Organization created successfully");
                queryClient.invalidateQueries(trpc.admin.organizations.getAll.queryOptions());
                queryClient.invalidateQueries(trpc.admin.stats.getDashboardStats.queryOptions());
                setOpen(false);
                setName("");
                setSlug("");
            },
            onError: (err) => toast.error(err.message)
        })
    );

    return (
        <>
            <Button onClick={() => setOpen(true)} className="w-full sm:w-auto">
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
    const { data: orgs, isPending } = useQuery(trpc.admin.organizations.getAll.queryOptions());

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
                            <div className="flex items-center gap-2 mt-1">
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

                        <Button variant="secondary" className="w-full justify-center bg-slate-50 hover:bg-slate-100 text-slate-700 border-none" asChild>
                            <Link href={`/admin/organizations/${org.id}`}>
                                <Building2 className="h-4 w-4 mr-2" />
                                Manage Organization
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ))}
            {filteredOrgs?.length === 0 && (
                <div className="col-span-full py-12 text-center bg-white rounded-xl border-2 border-dashed border-slate-200">
                    <Building2 className="h-12 w-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-slate-500 font-medium italic">No organizations found matching your search.</p>
                </div>
            )}
        </div>
    );
}
