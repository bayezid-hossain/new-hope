"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Badge } from "@/components/ui/badge";
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
            <div className="w-full space-y-6 bg-background min-h-screen">
                <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50 shadow-sm">
                    <div className="max-w-7xl mx-auto p-4 md:p-8 py-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
                                <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                                    <Building2 className="h-6 w-6 md:h-7 md:w-7 text-primary" />
                                </div>
                                Organizations
                            </h1>
                            <p className="text-muted-foreground text-sm font-medium italic mt-1 ml-1">Manage and oversee all registered organizations.</p>
                        </div>
                        <CreateOrgButton />
                    </div>
                </div>

                <div className="max-w-7xl mx-auto px-4 md:px-8 pb-8 space-y-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card/50 p-4 rounded-2xl border border-border/50 backdrop-blur-sm">
                        <div className="relative w-full sm:w-80">
                            <Input
                                placeholder="Search organizations..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 h-11 bg-background border-border/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all rounded-xl"
                            />
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
            <Button onClick={() => setOpen(true)} className="w-full sm:w-auto font-bold shadow-sm rounded-xl h-11 transition-all active:scale-95">
                <Plus className="mr-2 h-5 w-5" /> Create Organization
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
                        className="w-full h-11 rounded-xl font-bold shadow-sm transition-all active:scale-[0.98]"
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
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => <div key={i} className="h-48 animate-pulse bg-muted/30 rounded-2xl border border-border/50" />)}
        </div>
    );

    return (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrgs?.map((org: any) => (
                <Card key={org.id} className="group relative hover:shadow-md transition-all border-border/50 overflow-hidden bg-card rounded-2xl">
                    <div className="absolute top-0 left-0 w-full h-[2px] bg-muted group-hover:bg-primary transition-colors" />
                    <CardHeader className="flex flex-row items-start justify-between pb-4">
                        <div className="space-y-1">
                            <CardTitle className="text-xl font-bold text-foreground leading-none">{org.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] font-bold bg-muted px-2 py-0.5 rounded-md text-muted-foreground uppercase tracking-widest">
                                    {org.slug}
                                </span>
                            </div>
                        </div>
                        <EditOrgDialog org={org} />
                    </CardHeader>

                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 text-muted-foreground font-medium">
                                <Users className="h-3.5 w-3.5 text-primary" />
                                <span>{(org.members || []).length} Members</span>
                            </div>
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-500 border-none font-bold text-[10px] uppercase tracking-wider">Active</Badge>
                        </div>

                        <Button variant="secondary" className="w-full justify-center bg-muted/50 hover:bg-muted text-foreground font-bold border-none h-11 rounded-xl transition-all" asChild>
                            <Link href={`/admin/organizations/${org.id}`}>
                                <Building2 className="h-4 w-4 mr-2 text-primary" />
                                Manage Organization
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            ))}
            {filteredOrgs?.length === 0 && (
                <div className="col-span-full py-16 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-border/50">
                    <Building2 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
                    <p className="text-muted-foreground font-medium italic">No organizations found matching your search.</p>
                </div>
            )}
        </div>
    );
}
