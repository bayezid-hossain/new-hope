"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
}

export const CreateCycleModal = ({ open, onOpenChange }: CreateCycleModalProps) => {
  const { orgId } = useCurrentOrg();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // State to track if the dropdown should be visible
  const [showSuggestions, setShowSuggestions] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(createCycleSchema),
    defaultValues: {
      farmerId: "",
      farmerName: "",
      doc: 0,
      age: 1,
    },
  });

  // 1. Watch the name input to trigger search/filtering
  const watchName = form.watch("farmerName");

  // 2. Fetch Farmers (Optimized to only run when modal is open)
  // Adjust 'trpc.farmers.getMany' to whatever your search endpoint is
  const { data: farmersData, isFetching } = useQuery(
    trpc.farmers.getMany.queryOptions(
      {
        orgId: orgId!,
        search: watchName, // Pass search term to backend if supported
        pageSize: 10,      // Limit results
        status: "active"   // Ensure we only get valid farmers
      },
      { enabled: open && !!orgId }
    )
  );

  // 3. Filter/Memoize Suggestions
  // If your backend handles search, you can just use `farmersData.items` directly.
  // If backend returns all, filter here:
  const suggestions = useMemo(() => {
    if (!farmersData?.items) return [];
    // If backend search is used, return items. Otherwise filter locally:
    return farmersData.items;
  }, [farmersData]);

  // 4. Handle Selection
  const handleSelectFarmer = (farmer: FarmerSuggestion) => {
    form.setValue("farmerId", farmer.id);
    form.setValue("farmerName", farmer.name);
    setShowSuggestions(false);

    // Optional: Reset other fields if needed
    // form.setValue("doc", 0);
  };

  // 5. Mutation
  const createMutation = useMutation(
    trpc.cycles.create.mutationOptions({
      onSuccess: async () => {
        toast.success("Cycle started successfully");
        await queryClient.invalidateQueries(trpc.cycles.getActiveCycles.queryOptions({ orgId: orgId?.toString()! }));
        // Also invalidate mainstock as feed might be deducted
        await queryClient.invalidateQueries(trpc.mainstock.getDashboard.queryOptions({ orgId: orgId?.toString()! }));

        form.reset();
        onOpenChange(false);
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
          <FormField
            control={form.control}
            name="farmerName"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel>Farmer</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder="Search farmer name..."
                      {...field}
                      autoComplete="off"
                      onFocus={() => setShowSuggestions(true)}
                      onChange={(e) => {
                        field.onChange(e);
                        setShowSuggestions(true);
                        // Clear ID if user types something new
                        if (form.getValues("farmerId")) {
                          form.setValue("farmerId", "");
                        }
                      }}
                    />
                    {isFetching && (
                      <div className="absolute right-3 top-2.5">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </FormControl>

                {/* Suggestions Dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto mt-1">
                    {suggestions.map((f: any) => (
                      <button
                        key={f.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-accent text-sm flex justify-between items-center group"
                        onClick={() => handleSelectFarmer(f)}
                      >
                        <div>
                          <div className="font-medium">{f.name}</div>
                          <div className="text-xs text-muted-foreground">{f.phoneNumber}</div>
                        </div>
                        {/* Show available stock in suggestion */}
                        <div className="text-xs text-muted-foreground group-hover:text-foreground">
                          Stock: {f.mainStock}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {showSuggestions && suggestions.length === 0 && watchName.length > 1 && !isFetching && (
                  <div className="absolute z-50 w-full bg-popover border rounded-md shadow-md p-3 text-sm text-muted-foreground text-center mt-1">
                    No farmers found.
                  </div>
                )}
                <FormMessage />
                {/* Hidden ID field error message */}
                {form.formState.errors.farmerId && (
                  <p className="text-[0.8rem] font-medium text-destructive mt-1">
                    {form.formState.errors.farmerId.message}
                  </p>
                )}
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