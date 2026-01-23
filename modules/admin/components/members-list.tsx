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
import { Check, Loader2, ShieldAlert, Trash2 } from "lucide-react";
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
    <div className="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Role</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {members?.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">{member.name}</span>
                  <span className="text-xs text-muted-foreground">{member.email}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant={member.status === "ACTIVE" ? "default" : "secondary"}>
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
                    <SelectTrigger className="w-[110px] h-8">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="MANAGER">Manager</SelectItem>
                        <SelectItem value="OFFICER">Officer</SelectItem>
                    </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right space-x-1">
                {/* Approve Button */}
                {member.status === "PENDING" && (
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="text-green-600 hover:text-green-700 hover:bg-green-50 h-8 w-8 p-0"
                        onClick={() => approveMutation.mutate({ memberId: member.id })}
                    >
                        <Check className="h-4 w-4" />
                    </Button>
                )}
                
                {/* Kick Button with Dialog */}
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button 
                            size="sm" 
                            variant="ghost" 
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-8 w-8 p-0"
                            disabled={member.role === "OWNER" || deletingId === member.id}
                        >
                            {deletingId === member.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Trash2 className="h-4 w-4" />
                            )}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <ShieldAlert className="h-5 w-5 text-destructive" />
                                Kick Member?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                Are you sure you want to remove <span className="font-semibold text-foreground">{member.name}</span> from the organization? 
                                <br /><br />
                                They will lose access to all dashboard data immediately.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={() => removeMutation.mutate({ memberId: member.id })}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white"
                            >
                                Kick User
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

              </TableCell>
            </TableRow>
          ))}
          {members?.length === 0 && (
            <TableRow>
                <TableCell colSpan={4} className="text-center h-24 text-muted-foreground">
                    No members found in this organization.
                </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}