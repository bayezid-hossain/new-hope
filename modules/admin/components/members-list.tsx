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
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Power, Trash2, Users, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export function MembersList({ orgId }: { orgId: string }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const currentUserId = session.data?.user.id;

  // Track which member is being deleted for loading states
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: members, isPending } = useQuery(
    trpc.management.members.list.queryOptions({ orgId })
  );

  const approveMutation = useMutation(
    trpc.management.members.approve.mutationOptions({
      onSuccess: () => {
        toast.success("Member approved");
        queryClient.invalidateQueries(trpc.management.members.list.queryOptions({ orgId }));
      }
    })
  );

  const roleMutation = useMutation(
    trpc.management.members.updateRole.mutationOptions({
      onSuccess: () => {
        toast.success("Role updated");
        queryClient.invalidateQueries(trpc.management.members.list.queryOptions({ orgId }));
      }
    })
  );

  const statusMutation = useMutation(
    trpc.management.members.updateStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Status updated");
        queryClient.invalidateQueries(trpc.management.members.list.queryOptions({ orgId }));
      },
      onError: (err) => toast.error(err.message)
    })
  );

  const removeMutation = useMutation(
    trpc.management.members.remove.mutationOptions({
      onMutate: (vars) => setDeletingId(vars.memberId),
      onSuccess: () => {
        toast.success("Member removed from organization");
        queryClient.invalidateQueries(trpc.management.members.list.queryOptions({ orgId }));
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
      <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10 shadow-sm border-b border-border">
                <TableRow className="border-border/50">
                  <TableHead className="font-semibold text-foreground/70">User</TableHead>
                  <TableHead className="font-semibold text-foreground/70">Status</TableHead>
                  <TableHead className="font-semibold text-foreground/70">Role</TableHead>
                  <TableHead className="text-right font-semibold text-foreground/70">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((member) => (
                  <TableRow key={member.id} className="hover:bg-muted/30 transition-colors border-border/50">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-semibold text-foreground text-sm">{member.name}</span>
                        <span className="text-[11px] text-muted-foreground truncate">{member.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.status === "ACTIVE" ? "default" : "secondary"}
                        className={
                          member.status === "ACTIVE"
                            ? "bg-primary/10 text-primary hover:bg-primary/20 border-none font-semibold text-[10px]"
                            : member.status === "INACTIVE"
                              ? "bg-muted text-muted-foreground hover:bg-muted/80 border-none font-semibold text-[10px]"
                              : "bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 border-none font-semibold text-[10px]"
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
                          role: val as "MANAGER" | "OFFICER",
                          orgId
                        })}
                        disabled={member.role === "OWNER" || member.userId === currentUserId}
                      >
                        <SelectTrigger className="w-[110px] h-7 text-[11px] bg-muted/50 border-none shadow-none focus:ring-1 focus:ring-primary/20">
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
                        {/* Approve/Reject Buttons */}
                        {member.status === "PENDING" && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-primary border-primary/20 hover:text-primary hover:bg-primary/10 h-7 w-7 p-0 flex-shrink-0"
                              onClick={() => approveMutation.mutate({ memberId: member.id, orgId })}
                              title="Approve Member"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-destructive border-destructive/20 hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0 flex-shrink-0"
                              onClick={() => removeMutation.mutate({ memberId: member.id, orgId })}
                              title="Reject Request"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}

                        {/* Toggle Status Button (Active/Inactive) */}
                        {(member.status === "ACTIVE" || member.status === "INACTIVE") && member.role !== "OWNER" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className={`${member.status === "ACTIVE"
                              ? "text-muted-foreground/50 hover:text-amber-500 hover:bg-amber-500/10"
                              : "text-amber-500 hover:text-primary hover:bg-primary/10"
                              } h-7 w-7 p-0 flex-shrink-0 transition-all`}
                            title={member.userId === currentUserId ? "You cannot deactivate yourself" : (member.status === "ACTIVE" ? "Deactivate Member" : "Activate Member")}
                            onClick={() => statusMutation.mutate({
                              memberId: member.id,
                              status: member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                              orgId
                            })}
                            disabled={statusMutation.isPending || member.userId === currentUserId}
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
                              className="text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0 flex-shrink-0 transition-all"
                              disabled={member.role === "OWNER" || deletingId === member.id || member.userId === currentUserId}
                              title={member.userId === currentUserId ? "You cannot remove yourself" : ""}
                            >
                              {deletingId === member.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="w-[95vw] max-w-md rounded-2xl bg-card border-border shadow-xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2 text-xl text-foreground">
                                <div className="p-2 rounded-full bg-destructive/10 text-destructive">
                                  <Trash2 className="h-5 w-5" />
                                </div>
                                Remove Member?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground pt-2 text-sm leading-relaxed">
                                Are you sure you want to remove <span className="font-bold text-foreground">{member.name}</span>?
                                <br /><br />
                                They will lose all access to organization data and production monitoring tools immediately.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="pt-4">
                              <AlertDialogCancel className="rounded-xl bg-muted text-foreground border-none hover:bg-muted/80">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => removeMutation.mutate({ memberId: member.id, orgId })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
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
        </div>
        {/* Mobile Card View */}
        <div className="sm:hidden divide-y divide-border/50">
          {members?.map((member) => (
            <div key={member.id} className="p-4 space-y-4 bg-card">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <span className="font-bold text-foreground">{member.name}</span>
                  <span className="text-[11px] text-muted-foreground">{member.email}</span>
                </div>
                <Badge
                  variant={member.status === "ACTIVE" ? "default" : "secondary"}
                  className={
                    member.status === "ACTIVE"
                      ? "bg-primary/10 text-primary border-none font-bold text-[9px]"
                      : member.status === "INACTIVE"
                        ? "bg-muted text-muted-foreground border-none font-bold text-[9px]"
                        : "bg-amber-500/10 text-amber-600 border-none font-bold text-[9px]"
                  }
                >
                  {member.status}
                </Badge>
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex gap-2">
                  <span className=" items-center flex text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1 block">Role</span>
                  <Select
                    defaultValue={member.role}
                    onValueChange={(val) => roleMutation.mutate({
                      memberId: member.id,
                      role: val as "MANAGER" | "OFFICER",
                      orgId
                    })}
                    disabled={member.role === "OWNER" || member.userId === currentUserId}
                  >
                    <SelectTrigger className="w-full h-8 text-xs bg-muted/50 border-none shadow-none focus:ring-1 focus:ring-primary/20">
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
                      className="text-primary border-primary/20 h-8 w-8 p-0 hover:bg-primary/10"
                      onClick={() => approveMutation.mutate({ memberId: member.id, orgId })}
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
                        ? "text-muted-foreground/40 border-border"
                        : "text-amber-600 border-amber-500/20 bg-amber-500/10"
                        } h-8 w-8 p-0`}
                      onClick={() => statusMutation.mutate({
                        memberId: member.id,
                        status: member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                        orgId
                      })}
                      disabled={statusMutation.isPending || member.userId === currentUserId}
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
                        className="text-destructive border-destructive/20 hover:bg-destructive/10 h-8 w-8 p-0"
                        disabled={member.role === "OWNER" || deletingId === member.id || member.userId === currentUserId}
                      >
                        {deletingId === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="w-[95vw] max-w-md rounded-2xl bg-card border-border shadow-xl">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-foreground text-lg">Remove Member?</AlertDialogTitle>
                        <AlertDialogDescription className="text-muted-foreground">
                          Are you sure you want to remove <span className="font-bold text-foreground">{member.name}</span>?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel className="bg-muted text-foreground border-none hover:bg-muted/80 rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => removeMutation.mutate({ memberId: member.id, orgId })}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
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
            <div className="p-8 text-center text-muted-foreground italic text-sm">
              <Users className="h-8 w-8 mb-2 mx-auto opacity-20" />
              No members found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
