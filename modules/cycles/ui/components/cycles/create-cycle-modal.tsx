"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
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
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

// --- Schema ---
const createCycleSchema = z.object({
  farmerId: z.string().min(1, "You must select a farmer from the list"),
  farmerName: z.string().min(1, "Farmer name is required"), // Display only
  doc: z.coerce.number().min(1, "Must have at least 1 bird"),
  age: z.coerce.number().min(0).default(1).optional(),
});

type FormValues = z.infer<typeof createCycleSchema>;

// Define a type for the farmer suggestion (adjust based on your actual API return)
type FarmerSuggestion = {
  id: string;
  name: string;
  phoneNumber?: string;
  mainStock: number;
};

interface CreateCycleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onlyMine?: boolean;
}

export const CreateCycleModal = ({ open, onOpenChange, onlyMine }: CreateCycleModalProps) => {
  const { orgId } = useCurrentOrg();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [comboboxOpen, setComboboxOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: {
      farmerId: "",
      farmerName: "",
      doc: 0,
      age: 1,
    },
  });

  // 2. Fetch Active Farmers for Dropdown
  const { data: farmersData, isFetching } = useQuery(
    trpc.farmers.getMany.queryOptions(
      {
        orgId: orgId!,
        pageSize: 100, // Fetch more for the dropdown list
        status: "active",
        onlyMine
      },
      { enabled: open && !!orgId }
    )
  );

  const farmers = useMemo(() => {
    return farmersData?.items || [];
  }, [farmersData]);

  // 4. Handle Selection
  const handleSelectFarmer = (farmer: FarmerSuggestion) => {
    form.setValue("farmerId", farmer.id);
    form.setValue("farmerName", farmer.name);
    setComboboxOpen(false);

    // Optional: Reset other fields if needed
    // form.setValue("doc", 0);
  };

  // 5. Mutation
  const createMutation = useMutation(
    trpc.officer.cycles.create.mutationOptions({
      onSuccess: async () => {
        toast.success("Cycle started successfully");

        const baseOptions = { orgId: orgId! };

        // Invalidate Active listings across all potential routers
        await Promise.all([
          queryClient.invalidateQueries(trpc.officer.cycles.listActive.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.management.cycles.listActive.queryOptions(baseOptions)),
          queryClient.invalidateQueries(trpc.admin.cycles.listActive.queryOptions(baseOptions)),

          // Invalidate Organization/Farmer summary lists
          queryClient.invalidateQueries(trpc.management.getOrgFarmers.queryOptions(baseOptions)),

          // Also invalidate mainstock as feed might be deducted
          queryClient.invalidateQueries(trpc.mainstock.getDashboard.queryOptions({ orgId: orgId?.toString()! })),
        ]);

        onOpenChange(false);
        form.reset();
      },
      onError: (error) => toast.error(error.message),
    })
  );

  const onSubmit = (values: FormValues) => {
    if (!orgId) return;

    createMutation.mutate({
      orgId: orgId.toString()!,
      farmerId: values.farmerId,
      doc: values.doc,
      age: values.age, name: values.farmerName
    });
  };

  return (
    <ResponsiveDialog
      title="Start New Cycle"
      description="Select a farmer and assign birds (DOC) to start a new cycle."
      open={open}
      onOpenChange={onOpenChange}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">

          {/* --- 1. Farmer Autocomplete --- */}
          {/* --- 1. Farmer Selection (Combobox) --- */}
          <FormField
            control={form.control}
            name="farmerId"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Farmer</FormLabel>
                <Popover open={comboboxOpen} onOpenChange={setComboboxOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={comboboxOpen}
                        className={cn(
                          "w-full justify-between",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {field.value
                          ? farmers.find((f) => f.id === field.value)?.name
                          : "Select farmer..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                      <CommandInput placeholder="Search farmer..." />
                      <CommandList>
                        {isFetching ? (
                          <div className="p-4 text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Fetching farmer names...
                          </div>
                        ) : (
                          <CommandEmpty>No farmer found.</CommandEmpty>
                        )}
                        <CommandGroup>
                          {farmers.map((farmer) => (
                            <CommandItem
                              value={farmer.name} // Search by name
                              key={farmer.id}
                              onSelect={() => {
                                form.setValue("farmerId", farmer.id);
                                form.setValue("farmerName", farmer.name);
                                setComboboxOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  farmer.id === field.value
                                    ? "opacity-100"
                                    : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{farmer.name}</span>
                                <span className="text-xs text-muted-foreground">Stock: {farmer.mainStock}</span>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* --- 2. DOC & Age (Side by Side) --- */}
          <div className="flex gap-4">
            <FormField
              control={form.control}
              name="doc"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Input DOC</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="Number of birds"
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="age"
              render={({ field }) => (
                <FormItem className="w-24">
                  <FormLabel>Start Age</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) => field.onChange(e.target.valueAsNumber)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* --- 3. Input Feed --- */}


          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting Cycle...
              </>
            ) : (
              "Start Cycle"
            )}
          </Button>
        </form>
      </Form>
    </ResponsiveDialog>
  );
};