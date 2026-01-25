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

// Local schema just for the form input (amount only)
const formSchema = z.object({
  amount: z.number().min(1, "Must be at least 1"),
});

interface AddMortalityModalProps {
  cycleId: string;
  farmerName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const AddMortalityModal = ({
  cycleId,
  farmerName,
  open,
  onOpenChange,
}: AddMortalityModalProps) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { orgId } = useCurrentOrg();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { amount: 0 },
  });

  const mutation = useMutation(
    trpc.officer.cycles.addMortality.mutationOptions({
      onSuccess: () => {
        toast.success("Mortality recorded");
        queryClient.invalidateQueries(trpc.officer.cycles.listActive.queryOptions({ orgId: orgId! }));
        onOpenChange(false);
        form.reset();
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate({ id: cycleId, amount: values.amount });
  };

  return (
    <ResponsiveDialog
      title="Add Mortality"
      description={`Record new mortality count for ${farmerName}.`}
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
                <FormLabel>Number of Birds</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="0"
                    {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" variant="destructive" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Recording..." : "Record Mortality"}
          </Button>
        </form>
      </Form>
    </ResponsiveDialog>
  );
};