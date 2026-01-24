"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { SubmitHandler, useForm } from "react-hook-form"; // 1. Import SubmitHandler
import { toast } from "sonner";
import { z } from "zod";

// --- Schema Definition ---
const createFarmerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  initialStock: z.coerce.number().min(0).default(0).optional(),
});

// 2. Explicitly define the type
type CreateFarmerFormValues = z.infer<typeof createFarmerSchema>;

interface CreateFarmerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const CreateFarmerModal = ({ open, onOpenChange }: CreateFarmerModalProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrg();

  // 3. Pass the type to useForm generically
  const form = useForm<CreateFarmerFormValues>({
    resolver: zodResolver(createFarmerSchema),
    defaultValues: {
      name: "",
      initialStock: 0,
    },
  });

  const createMutation = useMutation(
    trpc.mainstock.createFarmer.mutationOptions({
      onSuccess: async () => {
        toast.success("Farmer registered successfully");
        await queryClient.invalidateQueries({
          queryKey: [["mainstock", "getDashboard"]],
        });
        onOpenChange(false);
        form.reset();
      },
      onError: (error) => toast.error(error.message || "Failed to create farmer"),
    })
  );

  // 4. Use SubmitHandler<Type> to strictly match what handleSubmit expects
  const onSubmit: SubmitHandler<CreateFarmerFormValues> = (values) => {
    if (!orgId) {
      toast.error("Organization ID is missing");
      return;
    }

    createMutation.mutate({
      name: values.name,
      initialStock: values.initialStock??0,
      orgId: orgId,
    });
  };

  return (
    <ResponsiveDialog
      title="Register New Farmer"
      description="Create a farmer profile and assign initial stock."
      open={open}
      onOpenChange={onOpenChange}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Name Field */}
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g. John Doe" 
                    {...field} 
                    autoComplete="off" 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Initial Stock Field */}
          <FormField
            control={form.control}
            name="initialStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Initial Feed Stock (Bags)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="0"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Assign initial bags to the warehouse.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? "Registering..." : "Register Farmer"}
          </Button>
        </form>
      </Form>
    </ResponsiveDialog>
  );
};