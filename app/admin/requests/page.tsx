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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTRPC } from "@/trpc/client";
import { Tabs } from "@radix-ui/react-tabs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import { Building2, Calendar, Check, Clock, Loader2, Mail, Plus, ShieldX, Sparkles, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminRequestsPage() {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const [actionId, setActionId] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [actionType, setActionType] = useState<"REVOKE" | "REJECT" | "EXTEND">("REVOKE");
    const [selectedMonths, setSelectedMonths] = useState<{ [key: string]: number }>({});
    const [extendMonths, setExtendMonths] = useState(1);
    const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED">("PENDING");

    const { data: requests, isLoading } = useQuery(
        trpc.admin.listFeatureRequests.queryOptions()
    );

    const approveMutation = useMutation(trpc.admin.approveFeatureRequest.mutationOptions({
        onSuccess: (data) => {
            toast.success(`Request approved! Pro expires ${format(new Date(data.expiresAt), "MMM d, yyyy")}`);
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

    const extendMutation = useMutation(trpc.admin.extendPro.mutationOptions({
        onSuccess: (data) => {
            toast.success(`Pro extended! New expiry: ${format(new Date(data.expiresAt), "MMM d, yyyy")}`);
            queryClient.invalidateQueries(trpc.admin.listFeatureRequests.pathFilter());
            setActionId(null);
            setDialogOpen(false);
        },
        onError: (err) => {
            toast.error(`Failed to extend: ${err.message}`);
            setActionId(null);
            setDialogOpen(false);
        }
    }));

    const handleApprove = (id: string) => {
        const months = selectedMonths[id] || 1;
        setActionId(id);
        approveMutation.mutate({ requestId: id, months });
    };

    const confirmAction = (req: any, type: "REVOKE" | "REJECT" | "EXTEND") => {
        setSelectedRequest(req);
        setActionType(type);
        setExtendMonths(1);
        setDialogOpen(true);
    };

    const handleConfirmAction = () => {
        if (!selectedRequest) return;
        setActionId(selectedRequest.id);

        if (actionType === "EXTEND") {
            extendMutation.mutate({ userId: selectedRequest.user?.id, additionalMonths: extendMonths });
        } else {
            revokeMutation.mutate({ requestId: selectedRequest.id });
        }
    };

    const getExpirationStatus = (expiresAt: Date | null) => {
        if (!expiresAt) return null;
        const expDate = new Date(expiresAt);
        const now = new Date();
        const isExpired = expDate < now;
        const daysLeft = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return {
            isExpired,
            daysLeft,
            formatted: format(expDate, "MMM d, yyyy"),
            relative: formatDistanceToNow(expDate, { addSuffix: true })
        };
    };

    const StatusBadge = ({ status }: { status: string }) => (
        <Badge variant="outline" className={`
            font-bold text-[10px] uppercase tracking-wider border w-fit
            ${status === "APPROVED" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                status === "REJECTED" ? "bg-red-50 text-red-700 border-red-200" :
                    "bg-amber-50 text-amber-700 border-amber-200"}
        `}>
            {status === "APPROVED" ? <Check className="w-3 h-3 mr-1" /> :
                status === "REJECTED" ? <ShieldX className="w-3 h-3 mr-1" /> :
                    <Clock className="w-3 h-3 mr-1" />}
            {status}
        </Badge>
    );

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-3 p-2 xs:p-3 sm:p-4 md:gap-8 md:p-8 h-screen overflow-hidden">
            <div className="flex items-center gap-2 xs:gap-3 sm:gap-4">
                <div className="p-1.5 xs:p-2 bg-indigo-100 rounded-lg">
                    <Sparkles className="h-5 w-5 xs:h-6 xs:w-6 text-indigo-600" />
                </div>
                <div>
                    <h1 className="font-semibold text-base xs:text-lg md:text-2xl">Pro Feature Requests</h1>
                    <p className="text-xs xs:text-sm text-slate-500">Manage subscriptions.</p>
                </div>
            </div>

            {/* Filter Tabs */}
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)} className="w-full">
                <TabsList className="grid w-full grid-cols-3 h-auto p-1">
                    <TabsTrigger value="PENDING" className="flex items-center gap-1 xs:gap-1.5 px-1.5 xs:px-2 py-1.5 text-[10px] xs:text-xs">
                        <Clock className="w-3 h-3 xs:w-4 xs:h-4 shrink-0" />
                        <span className="hidden xs:inline">New</span>
                        <Badge variant="secondary" className="h-4 xs:h-5 px-1 xs:px-1.5 text-[8px] xs:text-[10px]">
                            {requests?.filter(r => r.status === "PENDING").length || 0}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="APPROVED" className="flex items-center gap-1 xs:gap-1.5 px-1.5 xs:px-2 py-1.5 text-[10px] xs:text-xs">
                        <Check className="w-3 h-3 xs:w-4 xs:h-4 shrink-0" />
                        <span className="hidden xs:inline">OK</span>
                        <Badge variant="secondary" className="h-4 xs:h-5 px-1 xs:px-1.5 text-[8px] xs:text-[10px]">
                            {requests?.filter(r => r.status === "APPROVED").length || 0}
                        </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="REJECTED" className="flex items-center gap-1 xs:gap-1.5 px-1.5 xs:px-2 py-1.5 text-[10px] xs:text-xs">
                        <ShieldX className="w-3 h-3 xs:w-4 xs:h-4 shrink-0" />
                        <span className="hidden xs:inline">No</span>
                        <Badge variant="secondary" className="h-4 xs:h-5 px-1 xs:px-1.5 text-[8px] xs:text-[10px]">
                            {requests?.filter(r => r.status === "REJECTED").length || 0}
                        </Badge>
                    </TabsTrigger>
                </TabsList>
            </Tabs>

            {/* Mobile Card View */}
            <div className="md:hidden flex-1 overflow-y-auto space-y-2 xs:space-y-3 pb-4">
                {requests?.filter(r => r.status === statusFilter).length === 0 ? (
                    <Card className="p-4 xs:p-6 text-center text-muted-foreground text-xs xs:text-sm">
                        No {statusFilter.toLowerCase()} requests.
                    </Card>
                ) : (
                    requests?.filter(r => r.status === statusFilter).map((req) => {
                        const expStatus = req.user?.proExpiresAt ? getExpirationStatus(req.user.proExpiresAt) : null;

                        return (
                            <Card key={req.id} className="border-slate-200">
                                <CardContent className="p-2.5 xs:p-3 sm:p-4 space-y-2 xs:space-y-3">
                                    {/* Header: Name + Status */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5 xs:space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 xs:gap-2">
                                                <User className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-slate-400 shrink-0" />
                                                <span className="font-semibold text-slate-900 text-sm xs:text-base truncate">{req.user?.name || "Unknown"}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 xs:gap-2 text-[10px] xs:text-xs text-slate-500">
                                                <Mail className="w-2.5 h-2.5 xs:w-3 xs:h-3 shrink-0" />
                                                <span className="font-mono truncate">{req.user?.email}</span>
                                            </div>
                                        </div>
                                        <StatusBadge status={req.status} />
                                    </div>

                                    {/* Organization */}
                                    <div className="flex items-center gap-1.5 xs:gap-2 text-xs xs:text-sm">
                                        <Building2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-slate-400 shrink-0" />
                                        {req.organizationName ? (
                                            <Badge variant="secondary" className="font-medium text-slate-700 bg-slate-100 text-[10px] xs:text-xs">
                                                {req.organizationName}
                                            </Badge>
                                        ) : (
                                            <span className="text-slate-400 italic text-[10px] xs:text-xs">No Org</span>
                                        )}
                                    </div>

                                    {/* Timing */}
                                    <div className="flex flex-col gap-0.5 xs:gap-1 text-[10px] xs:text-xs text-slate-500 border-t pt-1.5 xs:pt-2">
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-2.5 h-2.5 xs:w-3 xs:h-3 shrink-0" />
                                            <span>{format(new Date(req.createdAt), "MMM d, yyyy")}</span>
                                        </div>
                                        {req.status !== "PENDING" && req.updatedAt && (
                                            <div className="flex items-center gap-1.5 text-slate-400">
                                                <Calendar className="w-2.5 h-2.5 xs:w-3 xs:h-3 shrink-0" />
                                                <span>Upd: {format(new Date(req.updatedAt), "MMM d")}</span>
                                            </div>
                                        )}
                                        {req.status === "APPROVED" && expStatus && (
                                            <div className={`flex items-center gap-1.5 font-medium ${expStatus.isExpired ? "text-red-600" : expStatus.daysLeft <= 7 ? "text-amber-600" : "text-emerald-600"}`}>
                                                <Sparkles className="w-2.5 h-2.5 xs:w-3 xs:h-3 shrink-0" />
                                                {expStatus.isExpired ? (
                                                    <span>Expired</span>
                                                ) : (
                                                    <span>Exp: {expStatus.formatted} ({expStatus.daysLeft}d)</span>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="border-t pt-2 xs:pt-3 mt-1.5 xs:mt-2">
                                        {req.status === "PENDING" && (
                                            <div className="flex items-center gap-1.5 xs:gap-2">
                                                <Select
                                                    value={String(selectedMonths[req.id] || 1)}
                                                    onValueChange={(v) => setSelectedMonths(prev => ({ ...prev, [req.id]: parseInt(v) }))}
                                                >
                                                    <SelectTrigger className="w-[60px] xs:w-[75px] h-7 xs:h-8 text-[10px] xs:text-xs">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {[1, 2, 3, 6, 12].map((m) => (
                                                            <SelectItem key={m} value={String(m)}>{m}mo</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button
                                                    size="sm"
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 h-7 xs:h-8 text-[10px] xs:text-xs"
                                                    onClick={() => handleApprove(req.id)}
                                                    disabled={actionId === req.id}
                                                >
                                                    {actionId === req.id ? <Loader2 className="w-3 h-3 xs:w-4 xs:h-4 animate-spin" /> : <Check className="w-3 h-3 xs:w-4 xs:h-4" />}
                                                    <span className="ml-1">OK</span>
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-7 xs:h-8 px-2 text-red-600 border-red-200 hover:bg-red-50"
                                                    onClick={() => confirmAction(req, "REJECT")}
                                                    disabled={actionId === req.id}
                                                >
                                                    <ShieldX className="w-3 h-3 xs:w-4 xs:h-4" />
                                                </Button>
                                            </div>
                                        )}
                                        {req.status === "APPROVED" && (
                                            <div className="flex items-center gap-1.5 xs:gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1 h-7 xs:h-8 text-[10px] xs:text-xs text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                                    onClick={() => confirmAction(req, "EXTEND")}
                                                    disabled={actionId === req.id}
                                                >
                                                    <Plus className="w-3 h-3 xs:w-4 xs:h-4 mr-0.5 xs:mr-1" />
                                                    Extend
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="flex-1 h-7 xs:h-8 text-[10px] xs:text-xs text-red-600 border-red-200 hover:bg-red-50"
                                                    onClick={() => confirmAction(req, "REVOKE")}
                                                    disabled={actionId === req.id}
                                                >
                                                    Revoke
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            {/* Desktop Table View */}
            <Card className="border-slate-200 shadow-sm hidden md:block">
                <CardHeader className="px-7 bg-slate-50/50 border-b">
                    <CardTitle>Request Log</CardTitle>
                    <CardDescription>
                        History of all Pro Pack requests. Select duration when approving.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-1 overflow-hidden">
                    <div className="h-full max-h-[calc(100vh-280px)] overflow-y-auto">
                        <Table>
                            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                                <TableRow className="hover:bg-transparent">
                                    <TableHead className="pl-6 w-[220px]">User Details</TableHead>
                                    <TableHead>Organization</TableHead>
                                    <TableHead>Status / Expiry</TableHead>
                                    <TableHead>Timing</TableHead>
                                    <TableHead className="text-right pr-6">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {requests?.filter(r => r.status === statusFilter).length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                                            No {statusFilter.toLowerCase()} requests.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    requests?.filter(r => r.status === statusFilter).map((req) => {
                                        const expStatus = req.user?.proExpiresAt ? getExpirationStatus(req.user.proExpiresAt) : null;

                                        return (
                                            <TableRow key={req.id} className="group">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-semibold text-slate-900">{req.user?.name || "Unknown"}</span>
                                                        <span className="text-xs text-slate-500 font-mono">{req.user?.email}</span>
                                                        <span className="text-[10px] text-slate-400 font-mono">ID: {req.user?.id.slice(0, 8)}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {req.organizationName ? (
                                                        <Badge variant="secondary" className="font-medium text-slate-700 bg-slate-100">
                                                            {req.organizationName}
                                                        </Badge>
                                                    ) : (
                                                        <span className="text-slate-400 text-sm italic">No Org</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        <StatusBadge status={req.status} />
                                                        {req.status === "APPROVED" && expStatus && (
                                                            <div className={`flex items-center gap-1 text-[10px] ${expStatus.isExpired ? "text-red-600" : expStatus.daysLeft <= 7 ? "text-amber-600" : "text-slate-500"}`}>
                                                                <Calendar className="w-3 h-3" />
                                                                {expStatus.isExpired ? (
                                                                    <span className="font-semibold">Expired {expStatus.relative}</span>
                                                                ) : (
                                                                    <span>Expires {expStatus.formatted} ({expStatus.daysLeft}d)</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-500">
                                                    <div className="flex flex-col gap-1">
                                                        <span>Req: {format(new Date(req.createdAt), "MMM d, h:mm a")}</span>
                                                        {req.status !== "PENDING" && req.updatedAt && (
                                                            <span className="text-slate-400">Upd: {format(new Date(req.updatedAt), "MMM d, h:mm a")}</span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    {req.status === "PENDING" && (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Select
                                                                value={String(selectedMonths[req.id] || 1)}
                                                                onValueChange={(v) => setSelectedMonths(prev => ({ ...prev, [req.id]: parseInt(v) }))}
                                                            >
                                                                <SelectTrigger className="w-[80px] h-8 text-xs">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {[1, 2, 3, 6, 12].map((m) => (
                                                                        <SelectItem key={m} value={String(m)}>{m} mo</SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                                onClick={() => confirmAction(req, "REJECT")}
                                                                disabled={actionId === req.id}
                                                                title="Reject Request"
                                                            >
                                                                <ShieldX className="w-4 h-4" />
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                className="bg-emerald-600 hover:bg-emerald-700 h-8 shadow-sm text-xs font-semibold"
                                                                onClick={() => handleApprove(req.id)}
                                                                disabled={actionId === req.id}
                                                            >
                                                                {actionId === req.id ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Check className="w-3 h-3 mr-1.5" />}
                                                                Approve
                                                            </Button>
                                                        </div>
                                                    )}
                                                    {req.status === "APPROVED" && (
                                                        <div className="flex items-center justify-end gap-2">
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                className="h-7 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 border-indigo-200"
                                                                onClick={() => confirmAction(req, "EXTEND")}
                                                                disabled={actionId === req.id}
                                                            >
                                                                <Plus className="w-3 h-3 mr-1" />
                                                                Extend
                                                            </Button>
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 text-slate-400 hover:text-red-700 hover:bg-red-50 text-xs"
                                                                onClick={() => confirmAction(req, "REVOKE")}
                                                                disabled={actionId === req.id}
                                                            >
                                                                Revoke
                                                            </Button>
                                                        </div>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className={actionType === "EXTEND" ? "text-indigo-600" : "text-red-600"}>
                            {actionType === "REVOKE" ? "Revoke Pro Access" :
                                actionType === "REJECT" ? "Reject Request" :
                                    "Extend Pro Subscription"}
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div>
                                {actionType === "EXTEND" ? (
                                    <div className="space-y-3">
                                        <p>Extend Pro subscription for <b>{selectedRequest?.user?.name}</b>.</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm">Add:</span>
                                            <Select value={String(extendMonths)} onValueChange={(v) => setExtendMonths(parseInt(v))}>
                                                <SelectTrigger className="w-[100px]">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {[1, 2, 3, 6, 12].map((m) => (
                                                        <SelectItem key={m} value={String(m)}>{m} month{m > 1 ? "s" : ""}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                ) : actionType === "REVOKE" ? (
                                    <>
                                        Are you sure you want to revoke Pro features for <b>{selectedRequest?.user?.name}</b>?
                                        This will immediately disable their access.
                                    </>
                                ) : (
                                    <>
                                        Reject this request from <b>{selectedRequest?.user?.name}</b>?
                                        They will not get Pro access.
                                    </>
                                )}
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleConfirmAction}
                            className={actionType === "EXTEND" ? "bg-indigo-600 hover:bg-indigo-700" : "bg-red-600 hover:bg-red-700"}
                        >
                            {(revokeMutation.isPending || extendMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                            {actionType === "REVOKE" ? "Confirm Revoke" :
                                actionType === "REJECT" ? "Reject Request" :
                                    `Extend ${extendMonths} Month${extendMonths > 1 ? "s" : ""}`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
