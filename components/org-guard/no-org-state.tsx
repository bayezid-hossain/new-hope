"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"; // Import TanStack hooks
import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export const NoOrgState = () => {
    const [selectedOrgId, setSelectedOrgId] = useState<string>("");
    const router = useRouter();

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const onLogout = () => {
        authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/sign-in");
                },
            },
        });
    };

    // FIXED: Use standard useQuery + queryOptions
    const { data: orgs, isPending: isLoadingOrgs } = useQuery(
        trpc.organization.getAll.queryOptions()
    );

    // FIXED: Use standard useMutation + mutationOptions
    const joinMutation = useMutation(
        trpc.organization.join.mutationOptions({
            onSuccess: async () => {
                toast.success("Request sent successfully!");
                // Invalidate the status query to trigger a re-render in OrgGuard
                await queryClient.invalidateQueries(
                    trpc.organization.getMyStatus.queryOptions()
                );
            },
            onError: (err) => {
                toast.error(err.message || "Failed to join organization.");
            }
        })
    );

    const handleJoin = () => {
        if (!selectedOrgId) return;
        joinMutation.mutate({
            orgId: selectedOrgId,
            role: "OFFICER"
        });
    };

    return (
        <div className="h-screen w-full bg-muted/20 flex items-center justify-center p-4">
            <Dialog open={true}>
                <DialogContent className="sm:max-w-md [&>button]:hidden" onInteractOutside={(e) => e.preventDefault()}>
                    <DialogHeader>
                        <DialogTitle>Join an Organization</DialogTitle>
                        <DialogDescription>
                            You must be a member of an organization to access the dashboard.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-6 py-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">
                                Select Organization
                            </label>

                            <Select
                                onValueChange={setSelectedOrgId}
                                value={selectedOrgId}
                                disabled={isLoadingOrgs || joinMutation.isPending}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={isLoadingOrgs ? "Loading organizations..." : "Select an organization..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {orgs?.map((org) => (
                                        <SelectItem key={org.id} value={org.id}>
                                            {org.name}
                                        </SelectItem>
                                    ))}
                                    {orgs?.length === 0 && (
                                        <div className="p-2 text-sm text-muted-foreground text-center">
                                            No organizations found.
                                        </div>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex flex-col gap-2">
                            <Button
                                onClick={handleJoin}
                                disabled={!selectedOrgId || joinMutation.isPending}
                                className="w-full"
                            >
                                {joinMutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending Request...
                                    </>
                                ) : (
                                    "Request to Join"
                                )}
                            </Button>
                            <Button variant="ghost" onClick={onLogout} className="w-full text-muted-foreground">
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};