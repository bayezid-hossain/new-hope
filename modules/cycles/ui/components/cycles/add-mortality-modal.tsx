"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// Local schema
const formSchema = z.object({
  amount: z.number().min(1, "Must be at least 1"),
  date: z.date({
    required_error: "A date of death is required.",
  }),
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
    defaultValues: {
      amount: 0,
      date: new Date() // Default to today
    },
  });

  const mutation = useMutation(
    trpc.officer.cycles.addMortality.mutationOptions({
      onSuccess: () => {
        toast.success("Mortality recorded");

        // Invalidate Active listings across all potential routers
        const baseOptions = { orgId: orgId! };
        queryClient.invalidateQueries(trpc.officer.cycles.listActive.pathFilter());
        queryClient.invalidateQueries(trpc.management.cycles.listActive.pathFilter());
        queryClient.invalidateQueries(trpc.admin.cycles.listActive.pathFilter());

        // Invalidate detailed farmer views
        queryClient.invalidateQueries(trpc.management.farmers.getManagementHub.pathFilter());
        queryClient.invalidateQueries(trpc.officer.cycles.getDetails.pathFilter());
        queryClient.invalidateQueries(trpc.officer.farmers.listWithStock.pathFilter());
        queryClient.invalidateQueries(trpc.officer.stock.getHistory.pathFilter());
        queryClient.invalidateQueries(trpc.officer.farmers.getDetails.pathFilter());

        onOpenChange(false);
        form.reset({
          amount: 0,
          date: new Date()
        });
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    mutation.mutate({
      id: cycleId,
      amount: values.amount,
      date: values.date
    });
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
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date of Death</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value ? (
                          format(field.value, "dd/MM/yyyy")
                        ) : (
                          <span>Pick a date</span>
                        )}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={field.onChange}
                      disabled={(date) =>
                        date > new Date() || date < new Date("1900-01-01")
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

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
          <Button type="submit" variant="destructive" className="w-full text-white" disabled={mutation.isPending}>
            {mutation.isPending ? "Recording..." : "Record Mortality"}
          </Button>
        </form>
      </Form>
    </ResponsiveDialog>
  );
};