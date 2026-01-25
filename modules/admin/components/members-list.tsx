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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Power, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function MembersList({ orgId }: { orgId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Track which member is being deleted for loading states
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: members, isPending } = useQuery(
    trpc.organization.getMembers.queryOptions({ orgId })
  );

  const approveMutation = useMutation(
    trpc.organization.approveMember.mutationOptions({
      onSuccess: () => {
        toast.success("Member approved");
        queryClient.invalidateQueries(trpc.organization.getMembers.queryOptions({ orgId }));
      }
    })
  );

  const roleMutation = useMutation(
    trpc.organization.updateMemberRole.mutationOptions({
      onSuccess: () => {
        toast.success("Role updated");
        queryClient.invalidateQueries(trpc.organization.getMembers.queryOptions({ orgId }));
      }
    })
  );

  const statusMutation = useMutation(
    trpc.organization.updateMemberStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Status updated");
        queryClient.invalidateQueries(trpc.organization.getMembers.queryOptions({ orgId }));
      },
      onError: (err) => toast.error(err.message)
    })
  );

  const removeMutation = useMutation(
    trpc.organization.removeMember.mutationOptions({
      onMutate: (vars) => setDeletingId(vars.memberId),
      onSuccess: () => {
        toast.success("Member removed from organization");
        queryClient.invalidateQueries(trpc.organization.getMembers.queryOptions({ orgId }));
        setDeletingId(null);
      },
      onError: (err) => {
        toast.error(err.message);
        setDeletingId(null);
      }
    })
  );

  if (isPending) return <div className="p-8 text-center text-muted-foreground"><Loader2 className="animate-spin h-6 w-6 mx-auto mb-2" />Loading members...</div>;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/50">
              <TableRow>
                <TableHead className="font-semibold text-slate-700">User</TableHead>
                <TableHead className="font-semibold text-slate-700">Status</TableHead>
                <TableHead className="font-semibold text-slate-700">Role</TableHead>
                <TableHead className="text-right font-semibold text-slate-700">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members?.map((member) => (
                <TableRow key={member.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 text-sm">{member.name}</span>
                      <span className="text-[11px] text-slate-500 truncate">{member.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={member.status === "ACTIVE" ? "default" : "secondary"}
                      className={
                        member.status === "ACTIVE"
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none font-semibold text-[10px]"
                          : member.status === "INACTIVE"
                            ? "bg-slate-100 text-slate-600 hover:bg-slate-100 border-none font-semibold text-[10px]"
                            : "bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-semibold text-[10px]"
                      }
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Select
                      defaultValue={member.role}
                      onValueChange={(val) => roleMutation.mutate({
                        memberId: member.id,
                        role: val as "MANAGER" | "OFFICER"
                      })}
                      disabled={member.role === "OWNER"}
                    >
                      <SelectTrigger className="w-[110px] h-7 text-[11px] bg-slate-50 border-slate-200">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="OFFICER">Officer</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {/* Approve Button */}
                      {member.status === "PENDING" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-emerald-600 border-emerald-200 hover:text-emerald-700 hover:bg-emerald-50 h-7 w-7 p-0 flex-shrink-0"
                          onClick={() => approveMutation.mutate({ memberId: member.id })}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}

                      {/* Toggle Status Button (Active/Inactive) */}
                      {(member.status === "ACTIVE" || member.status === "INACTIVE") && member.role !== "OWNER" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className={`${member.status === "ACTIVE"
                            ? "text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                            : "text-amber-600 hover:text-emerald-600 hover:bg-emerald-50"
                            } h-7 w-7 p-0 flex-shrink-0`}
                          title={member.status === "ACTIVE" ? "Deactivate Member" : "Activate Member"}
                          onClick={() => statusMutation.mutate({
                            memberId: member.id,
                            status: member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                          })}
                          disabled={statusMutation.isPending}
                        >
                          {statusMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Power className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}

                      {/* Kick Button with Dialog */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-slate-400 hover:text-destructive hover:bg-destructive/5 h-7 w-7 p-0 flex-shrink-0"
                            disabled={member.role === "OWNER" || deletingId === member.id}
                          >
                            {deletingId === member.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[95vw] max-w-md rounded-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-xl">
                              <div className="p-2 rounded-full bg-red-100 text-red-600">
                                <Trash2 className="h-5 w-5" />
                              </div>
                              Remove Member?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-slate-600 pt-2 text-sm leading-relaxed">
                              Are you sure you want to remove <span className="font-bold text-slate-900">{member.name}</span>?
                              <br /><br />
                              They will lose all access to organization data and production monitoring tools immediately.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="pt-4">
                            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeMutation.mutate({ memberId: member.id })}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white rounded-xl"
                            >
                              Remove Member
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-slate-100">
          {members?.map((member) => (
            <div key={member.id} className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="font-bold text-slate-900">{member.name}</span>
                  <span className="text-[11px] text-slate-500">{member.email}</span>
                </div>
                <Badge
                  variant={member.status === "ACTIVE" ? "default" : "secondary"}
                  className={
                    member.status === "ACTIVE"
                      ? "bg-emerald-100 text-emerald-700 border-none font-bold text-[9px]"
                      : member.status === "INACTIVE"
                        ? "bg-slate-100 text-slate-600 border-none font-bold text-[9px]"
                        : "bg-amber-100 text-amber-700 border-none font-bold text-[9px]"
                  }
                >
                  {member.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex gap-2">
                  <span className=" items-center flex text-[10px] text-slate-400 uppercase font-bold tracking-wider mb-1 block">Role</span>
                  <Select
                    defaultValue={member.role}
                    onValueChange={(val) => roleMutation.mutate({
                      memberId: member.id,
                      role: val as "MANAGER" | "OFFICER"
                    })}
                    disabled={member.role === "OWNER"}
                  >
                    <SelectTrigger className="w-full h-8 text-xs bg-slate-50 border-slate-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MANAGER">Manager</SelectItem>
                      <SelectItem value="OFFICER">Officer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-row gap-1 items-center justify-center">
                  {/* Approve Button */}
                  {member.status === "PENDING" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-emerald-600 border-emerald-200 h-8 w-8 p-0"
                      onClick={() => approveMutation.mutate({ memberId: member.id })}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}

                  {/* Toggle Status Button */}
                  {(member.status === "ACTIVE" || member.status === "INACTIVE") && member.role !== "OWNER" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className={`${member.status === "ACTIVE"
                        ? "text-slate-400 border-slate-200"
                        : "text-amber-600 border-amber-200 bg-amber-50"
                        } h-8 w-8 p-0`}
                      onClick={() => statusMutation.mutate({
                        memberId: member.id,
                        status: member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
                      })}
                      disabled={statusMutation.isPending}
                    >
                      {statusMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Power className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {/* Kick Button */}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive border-red-100 hover:bg-red-50 h-8 w-8 p-0"
                        disabled={member.role === "OWNER" || deletingId === member.id}
                      >
                        {deletingId === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[95vw] max-w-md rounded-2xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Member?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove {member.name}?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeMutation.mutate({ memberId: member.id })}
                          className="bg-destructive text-white"
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))}

          {/* Empty State */}
          {members?.length === 0 && (
            <div className="p-8 text-center text-slate-400 italic text-sm">
              <Users className="h-8 w-8 mb-2 mx-auto opacity-20" />
              No members found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
