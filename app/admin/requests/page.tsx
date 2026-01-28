"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Clock, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function AdminRequestsPage() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const { data: requests, isLoading } = useQuery(
        trpc.admin.listFeatureRequests.queryOptions()
    );

    const approveMutation = useMutation(trpc.admin.approveFeatureRequest.mutationOptions({
        onSuccess: () => {
            toast.success("Request approved and user upgraded to Pro.");
            queryClient.invalidateQueries(trpc.admin.listFeatureRequests.pathFilter());
        },
        onError: (err) => {
            toast.error(`Failed to approve: ${err.message}`);
        }
    }));

    const handleApprove = (id: string) => {
        approveMutation.mutate({ requestId: id });
    };

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
            <div className="flex items-center gap-4">
                <div className="p-2 bg-indigo-100 rounded-lg">
                    <Sparkles className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                    <h1 className="font-semibold text-lg md:text-2xl">Pro Feature Requests</h1>
                    <p className="text-sm text-slate-500">Manage access requests for premium features.</p>
                </div>
            </div>

            <Card>
                <CardHeader className="px-7">
                    <CardTitle>Pending Requests</CardTitle>
                    <CardDescription>
                        Review and approve access requests.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead className="hidden sm:table-cell">Feature</TableHead>
                                <TableHead className="hidden sm:table-cell">Status</TableHead>
                                <TableHead className="hidden md:table-cell">Date</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {requests?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        No pending requests found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                requests?.map((req) => (
                                    <TableRow key={req.id}>
                                        <TableCell>
                                            <div className="font-medium">{req.user?.name || "Unknown"}</div>
                                            <div className="hidden text-sm text-muted-foreground md:inline">
                                                {req.user?.email}
                                            </div>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <Badge variant="outline" className="font-mono">
                                                {req.feature}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden sm:table-cell">
                                            <Badge className={req.status === "APPROVED" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                                                {req.status === "APPROVED" ? <Check className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                                                {req.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell">
                                            {format(new Date(req.createdAt), "PPP p")}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            {req.status === "PENDING" && (
                                                <Button
                                                    size="sm"
                                                    className="bg-emerald-600 hover:bg-emerald-700"
                                                    onClick={() => handleApprove(req.id)}
                                                    disabled={approveMutation.isPending}
                                                >
                                                    {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                                                    Approve
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
