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
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Loader2, Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
    targetFarmerId: z.string({ required_error: "Please select a target farmer." }),
    amount: z.coerce.number().positive("Amount must be positive"),
    note: z.string().optional(),
});

interface TransferStockModalProps {
    sourceFarmerId: string;
    sourceFarmerName: string;
    currentStock: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    officerId?: string;
}

export function TransferStockModal({
    sourceFarmerId,
    sourceFarmerName,
    currentStock,
    open,
    onOpenChange,
    officerId,
}: TransferStockModalProps) {
    const trpc = useTRPC();
    const { orgId } = useCurrentOrg();
    const queryClient = useQueryClient();
    const [comboboxOpen, setComboboxOpen] = useState(false);

    // Form Setup
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: 0,
            note: "",
        },
    });

    // Fetch Potential Targets (Farmers in same Org)
    const { data: farmersData, isLoading: isLoadingFarmers } = useQuery({
        ...trpc.officer.farmers.listWithStock.queryOptions({
            orgId: orgId!,
            pageSize: 100, // Fetch top 100 for now
            officerId: officerId,
        }),
        enabled: open && !!orgId,
    });

    // Filter out source farmer from list
    const targetOptions = farmersData?.items.filter(f => f.id !== sourceFarmerId) || [];

    // Mutation
    const transferMutation = useMutation(
        trpc.officer.stock.transferStock.mutationOptions({
            onSuccess: () => {
                toast.success("Stock transferred successfully");
                queryClient.invalidateQueries(trpc.officer.farmers.listWithStock.queryOptions({ orgId: orgId! }));
                queryClient.invalidateQueries(trpc.officer.stock.getHistory.queryOptions({ farmerId: sourceFarmerId }));
                queryClient.invalidateQueries(trpc.officer.farmers.getDetails.queryOptions({ farmerId: sourceFarmerId }));

                // management Query validations
                queryClient.invalidateQueries({ queryKey: [["management", "farmers"]] });
                onOpenChange(false);
                form.reset();
            },
            onSettled: (data, error, variables) => {
                if (variables?.targetFarmerId) {
                    queryClient.invalidateQueries(trpc.officer.stock.getHistory.queryOptions({ farmerId: variables.targetFarmerId }));
                    queryClient.invalidateQueries(trpc.officer.farmers.getDetails.queryOptions({ farmerId: variables.targetFarmerId }));
                }
            },
            onError: (err) => {
                toast.error(err.message || "Failed to transfer stock");
            },
        })
    );

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        if (values.amount > currentStock) {
            form.setError("amount", { message: `Insufficient stock. Max: ${currentStock}` });
            return;
        }

        transferMutation.mutate({
            sourceFarmerId,
            targetFarmerId: values.targetFarmerId,
            amount: values.amount,
            note: values.note,
        });
    };

    return (
        <ResponsiveDialog
            title="Transfer Stock"
            description={`Move feed from ${sourceFarmerName} to another farmer.`}
            open={open}
            onOpenChange={onOpenChange}
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

                    {/* Target Farmer Selection */}
                    <FormField
                        control={form.control}
                        name="targetFarmerId"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Transfer To</FormLabel>
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
                                                    ? targetOptions.find((f) => f.id === field.value)?.name
                                                    : "Select farmer..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 ">
                                        <Command>
                                            <CommandInput placeholder="Search farmer..." />
                                            <CommandList>
                                                {isLoadingFarmers ? (
                                                    <div className="p-4 text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Fetching farmer names...
                                                    </div>
                                                ) : (
                                                    <CommandEmpty>No farmer found.</CommandEmpty>
                                                )}
                                                <CommandGroup>
                                                    {targetOptions.map((farmer) => (
                                                        <CommandItem
                                                            value={farmer.name}
                                                            key={farmer.id}
                                                            onSelect={() => {
                                                                form.setValue("targetFarmerId", farmer.id);
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
                                                            {farmer.name}
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

                    {/* Amount Input */}
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Amount (Bags) - Max: {currentStock}</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {/* Note Input */}
                    <FormField
                        control={form.control}
                        name="note"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Note (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea placeholder="Reason for transfer..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={transferMutation.isPending}>
                            {transferMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {!transferMutation.isPending && <Send className="mr-2 h-4 w-4" />}
                            Transfer Stock
                        </Button>
                    </div>
                </form>
            </Form>
        </ResponsiveDialog >
    );
}
