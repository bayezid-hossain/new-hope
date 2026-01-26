"use client";

import ResponsiveDialog from "@/components/responsive-dialog"; // Your component
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
// We can keep AlertDialog for the final "Delete" confirmation as it's a standard pattern
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

interface EditOrgDialogProps {
  org: { id: string; name: string; slug: string };
}

export function EditOrgDialog({ org }: EditOrgDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const updateMutation = useMutation(
    trpc.admin.updateOrganization.mutationOptions({
      onSuccess: () => {
        toast.success("Updated!");
        queryClient.invalidateQueries(trpc.admin.getAllOrgs.queryOptions());
        setOpen(false);
      }
    })
  );

  const deleteMutation = useMutation(
    trpc.admin.deleteOrganization.mutationOptions({
      onSuccess: () => {
        toast.success("Organization deleted");
        queryClient.invalidateQueries(trpc.admin.getAllOrgs.queryOptions());
        setOpen(false);
      }
    })
  );

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setOpen(true)}>
        <Settings className="h-4 w-4" />
      </Button>

      <ResponsiveDialog
        open={open}
        onOpenChange={setOpen}
        title="Edit Organization"
        description={`Modify settings for ${org.name}`}
      >
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Slug</Label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2 pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" type="button" className="w-full text-white sm:w-auto">
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Org
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete {org.name} and ALL associated data. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-white"
                    onClick={() => deleteMutation.mutate({ id: org.id })}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              onClick={() => updateMutation.mutate({ id: org.id, name, slug })}
              className="w-full sm:w-auto"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Save Changes
            </Button>
          </div>
        </div>
      </ResponsiveDialog>
    </>
  );
}