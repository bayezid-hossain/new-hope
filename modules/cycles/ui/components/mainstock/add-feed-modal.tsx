"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
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
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// Schema: Amount + Optional Note
const addStockSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  note: z.string().optional(),
});

interface AddFeedModalProps {
  id: string; // This must be the FARMER ID
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddFeedModal = ({ id, open, onOpenChange }: AddFeedModalProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient(); // <--- Standard Query Client
  const orgId = useCurrentOrg(); // <--- Get Current Org ID
  const form = useForm<z.infer<typeof addStockSchema>>({
    resolver: zodResolver(addStockSchema),
    defaultValues: {
      amount: 0,
      note: ""
    },
  });

  const addStockMutation = useMutation(
    trpc.mainstock.addStock.mutationOptions({
      onSuccess: async () => {
        toast.success("Main stock updated successfully");

        // Manual Invalidation without useUtils
        // We invalidate the specific procedures. 
        // Passing an empty filter object often matches the query key structure loosely enough for invalidation.
        await Promise.all([queryClient.invalidateQueries(trpc.mainstock.getDashboard.queryOptions({ orgId: orgId!.toString() })),
        queryClient.invalidateQueries(trpc.cycles.getActiveCycles.queryOptions({ orgId: orgId!.toString() })),
        ]);

        onOpenChange(false);
        form.reset();
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const onSubmit = (values: z.infer<typeof addStockSchema>) => {
    addStockMutation.mutate({
      farmerId: id,
      amount: values.amount,
      note: values.note || undefined // clean up empty strings
    });
  };

  return (
    <ResponsiveDialog
      title="Restock Warehouse"
      description="Add feed to the farmer's main stock pile."
      open={open}
      onOpenChange={onOpenChange}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount (Bags)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...field}
                    // Handle value changes safely for number inputs
                    onChange={(e) => field.onChange(e.target.value === "" ? 0 : parseFloat(e.target.value))}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Note (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Delivery Chalan #123" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={addStockMutation.isPending}>
            {addStockMutation.isPending ? "Updating Stock..." : "Add Stock"}
          </Button>
        </form>
      </Form>
    </ResponsiveDialog>
  );
};