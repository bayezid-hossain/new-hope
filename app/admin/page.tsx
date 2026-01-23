"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { AdminGuard } from "@/modules/admin/components/admin-guard";
import { EditOrgDialog } from "@/modules/admin/components/edit-organization-dialog";
import { MembersList } from "@/modules/admin/components/members-list";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, Building2, Loader2, Plus, Users, Wheat } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminDashboard() {
  return (
    <AdminGuard>
      <div className="p-8 space-y-8 bg-muted/10 min-h-screen">
        <div className="flex justify-between items-center">
            <h1 className="text-3xl font-bold tracking-tight">System Administration</h1>
            <CreateOrgButton />
        </div>
        
        <AdminStats />
        
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">All Organizations</h2>
            <OrgList />
        </div>
      </div>
    </AdminGuard>
  );
}

// --- Sub-Components ---

function AdminStats() {
    const trpc = useTRPC();
    const { data: stats, isPending } = useQuery(trpc.admin.getStats.queryOptions());

    if (isPending) return <div className="grid grid-cols-4 gap-4 h-32 animate-pulse bg-muted rounded-xl" />;

    const items = [
        { label: "Organizations", value: stats?.orgs, icon: Building2, color: "text-blue-600" },
        { label: "Total Users", value: stats?.users, icon: Users, color: "text-green-600" },
        { label: "Farmers", value: stats?.farmers, icon: Wheat, color: "text-yellow-600" },
        { label: "Active Cycles", value: stats?.activeCycles, icon: Activity, color: "text-purple-600" },
    ];

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {items.map((item) => (
                <Card key={item.label}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
                        <item.icon className={`h-4 w-4 ${item.color}`} />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{item.value}</div>
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
function OrgList() {
    const trpc = useTRPC();
    const { data: orgs } = useQuery(trpc.admin.getAllOrgs.queryOptions());

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {orgs?.map((org) => (
                <Card key={org.id} className="group relative hover:shadow-md transition-shadow">
                    <CardHeader className="flex flex-row items-start justify-between pb-2">
                        <div>
                            <CardTitle className="text-lg">{org.name}</CardTitle>
                            <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
                                {org.slug}
                            </span>
                        </div>
                        {/* Edit/Delete Dialog */}
                        <EditOrgDialog org={org} />
                    </CardHeader>
                    
                    <CardContent>
                        {/* Manage Members Sheet */}
                        <Sheet>
                            <SheetTrigger asChild>
                                <Button variant="outline" className="w-full justify-start">
                                    <Users className="h-4 w-4 mr-2" />
                                    Manage Members ({org.members.length})
                                </Button>
                            </SheetTrigger>
                            <SheetContent className="min-w-[600px] sm:w-[540px]">
                                <SheetHeader className="mb-6">
                                    <SheetTitle>Members: {org.name}</SheetTitle>
                                </SheetHeader>
                                <MembersList orgId={org.id} />
                            </SheetContent>
                        </Sheet>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}