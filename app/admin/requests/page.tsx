"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Check, Clock, Loader2, ShieldX, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminRequestsPage() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const [actionId, setActionId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [actionType, setActionType] = useState<"REVOKE" | "REJECT">("REVOKE");

    const { data: requests, isLoading } = useQuery(
        trpc.admin.listFeatureRequests.queryOptions()
    );

    const approveMutation = useMutation(trpc.admin.approveFeatureRequest.mutationOptions({
        onSuccess: () => {
            toast.success("Request approved and user upgraded to Pro.");
            queryClient.invalidateQueries(trpc.admin.listFeatureRequests.pathFilter());
            setActionId(null);
        },
        onError: (err) => {
            toast.error(`Failed to approve: ${err.message}`);
            setActionId(null);
        }
    }));

    const revokeMutation = useMutation(trpc.admin.revokeFeatureRequest.mutationOptions({
        onSuccess: () => {
            toast.success(actionType === "REVOKE" ? "Access revoked." : "Request rejected.");
            queryClient.invalidateQueries(trpc.admin.listFeatureRequests.pathFilter());
            setActionId(null);
            setDialogOpen(false);
        },
        onError: (err) => {
            toast.error(`Failed to ${actionType.toLowerCase()}: ${err.message}`);
            setActionId(null);
            setDialogOpen(false);
        }
    }));

    const handleApprove = (id: string) => {
        setActionId(id);
        approveMutation.mutate({ requestId: id });
    };

    const confirmAction = (req: any, type: "REVOKE" | "REJECT") => {
        setSelectedRequest(req);
        setActionType(type);
        setDialogOpen(true);
    };

    const handleConfirmAction = () => {
        if (!selectedRequest) return;
        setActionId(selectedRequest.id);
        revokeMutation.mutate({ requestId: selectedRequest.id });
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

            <Card className="border-slate-200 shadow-sm">
                <CardHeader className="px-7 bg-slate-50/50 border-b">
                    <CardTitle>Request Log</CardTitle>
                    <CardDescription>
                        History of all Pro Pack requests and their current status.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="max-h-[600px] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-6 w-[250px]">User Details</TableHead>
                                    <TableHead className="hidden sm:table-cell">Organization</TableHead>
                                    <TableHead className="hidden sm:table-cell">Request Type</TableHead>
                                    <TableHead className="hidden sm:table-cell">Status</TableHead>
                                    <TableHead className="hidden md:table-cell">Timing</TableHead>
                                    <TableHead className="text-right pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                                            No requests found.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    requests?.map((req) => (
                                        <TableRow key={req.id} className="group">
                                            <TableCell className="pl-6 py-4">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="font-semibold text-slate-900">{req.user?.name || "Unknown"}</span>
                                                    <span className="text-xs text-slate-500 font-mono">{req.user?.email}</span>
                                                    <span className="text-[10px] text-slate-400 font-mono">ID: {req.user?.id.slice(0, 8)}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                {req.organizationName ? (
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="secondary" className="font-medium text-slate-700 bg-slate-100">
                                                            {req.organizationName}
                                                        </Badge>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 text-sm italic">No Org</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <Badge variant="outline" className="font-mono bg-slate-50 text-slate-600 border-slate-200">
                                                    {req.feature}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden sm:table-cell">
                                                <Badge variant="outline" className={`
                                                font-bold text-[10px] uppercase tracking-wider border
                                                ${req.status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                                        req.status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                                                            "bg-amber-50 text-amber-700 border-amber-200"}
                                            `}>
                                                    {req.status === "APPROVED" ? <Check className="w-3 h-3 mr-1" /> :
                                                        req.status === "REJECTED" ? <ShieldX className="w-3 h-3 mr-1" /> :
                                                            <Clock className="w-3 h-3 mr-1" />}
                                                    {req.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell text-xs text-slate-500">
                                                <div className="flex flex-col gap-1">
                                                    <span>Req: {format(new Date(req.createdAt), "MMM d, h:mm a")}</span>
                                                    {req.status !== "PENDING" && req.updatedAt && (
                                                        <span className="text-slate-400">Upd: {format(new Date(req.updatedAt), "MMM d, h:mm a")}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                {req.status === "PENDING" && (
                                                    <div className="flex justify-end gap-2 text-white">
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                            onClick={() => confirmAction(req, "REJECT")}
                                                            disabled={actionId === req.id || approveMutation.isPending || revokeMutation.isPending}
                                                            title="Reject Request"
                                                        >
                                                            {actionId === req.id && actionType === "REJECT" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="bg-emerald-600 hover:bg-emerald-700 h-8 shadow-sm text-xs font-semibold"
                                                            onClick={() => handleApprove(req.id)}
                                                            disabled={actionId === req.id || approveMutation.isPending || revokeMutation.isPending}
                                                        >
                                                            {actionId === req.id && actionType !== "REJECT" ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Check className="w-3 h-3 mr-1.5" />}

                                                        </Button>
                                                    </div>
                                                )}
                                                {req.status === "APPROVED" && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-slate-400 hover:text-red-700 hover:bg-red-50 text-xs"
                                                        onClick={() => confirmAction(req, "REVOKE")}
                                                        disabled={actionId === req.id || revokeMutation.isPending || approveMutation.isPending}
                                                    >
                                                        Revoke Access
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className={actionType === "REVOKE" ? "text-red-600" : "text-slate-900"}>
                            {actionType === "REVOKE" ? "Revoke Pro Access" : "Reject Request"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {actionType === "REVOKE" ? (
                                <>
                                    Are you sure you want to revoke Pro features for <b>{selectedRequest?.user?.name}</b>?
                                    This will immediately disable their access.
                                </>
                            ) : (
                                <>
                                    Reject this request from <b>{selectedRequest?.user?.name}</b>?
                                    They will be notified and will not get Pro access.
                                </>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAction}
                            className={`${actionType === "REVOKE" || actionType === "REJECT" ? "bg-red-600 hover:bg-red-700 focus:ring-red-600" : "bg-slate-900"}`}
                        >
                            {revokeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            {actionType === "REVOKE" ? "Confirm Revoke" : "Reject Request"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
