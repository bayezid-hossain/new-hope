"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
    effectiveFrom: z.string().min(1, "Effective date is required"),
    feedPricePerBag: z.coerce
        .number({ invalid_type_error: "Must be a number" })
        .positive("Must be a positive number"),
    docPricePerBird: z.coerce
        .number({ invalid_type_error: "Must be a number" })
        .positive("Must be a positive number"),
    baseSellPrice: z.coerce
        .number({ invalid_type_error: "Must be a number" })
        .positive("Must be a positive number"),
});

type FormValues = z.infer<typeof formSchema>;

export type PricePolicyFormValues = {
    id?: string;
    effectiveFrom: Date | string;
    feedPricePerBag: string | number;
    docPricePerBird: string | number;
    baseSellPrice: string | number;
};

interface PricePolicyFormProps {
    orgId: string;
    initialValues?: PricePolicyFormValues;
    onSuccess: () => void;
    onCancel: () => void;
}

function toDateInputValue(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    // Format as YYYY-MM-DDTHH:mm for datetime-local input
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function isPastDate(date: Date | string): boolean {
    const d = typeof date === "string" ? new Date(date) : date;
    return d < new Date();
}

export function PricePolicyForm({
    orgId,
    initialValues,
    onSuccess,
    onCancel,
}: PricePolicyFormProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const isEditing = !!initialValues?.id;
    const isEditingPast =
        isEditing &&
        initialValues?.effectiveFrom != null &&
        isPastDate(initialValues.effectiveFrom);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            effectiveFrom: initialValues?.effectiveFrom
                ? toDateInputValue(initialValues.effectiveFrom)
                : "",
            feedPricePerBag: initialValues?.feedPricePerBag
                ? Number(initialValues.feedPricePerBag)
                : undefined,
            docPricePerBird: initialValues?.docPricePerBird
                ? Number(initialValues.docPricePerBird)
                : undefined,
            baseSellPrice: initialValues?.baseSellPrice
                ? Number(initialValues.baseSellPrice)
                : undefined,
        },
    });

    const invalidateList = () =>
        queryClient.invalidateQueries(
            trpc.management.pricePolicies.list.queryOptions({ orgId })
        );

    const createMutation = useMutation(
        trpc.management.pricePolicies.create.mutationOptions({
            onSuccess: async () => {
                toast.success("Price policy created successfully");
                await invalidateList();
                onSuccess();
            },
            onError: (error) => toast.error(error.message),
        })
    );

    const updateMutation = useMutation(
        trpc.management.pricePolicies.update.mutationOptions({
            onSuccess: async () => {
                toast.success("Price policy updated successfully");
                await invalidateList();
                onSuccess();
            },
            onError: (error) => toast.error(error.message),
        })
    );

    const isPending = createMutation.isPending || updateMutation.isPending;

    const onSubmit = (values: FormValues) => {
        // Convert datetime-local string to ISO 8601
        const effectiveFrom = new Date(values.effectiveFrom).toISOString();

        if (isEditing && initialValues?.id) {
            updateMutation.mutate({
                orgId,
                id: initialValues.id,
                effectiveFrom,
                feedPricePerBag: values.feedPricePerBag,
                docPricePerBird: values.docPricePerBird,
                baseSellPrice: values.baseSellPrice,
            });
        } else {
            createMutation.mutate({
                orgId,
                effectiveFrom,
                feedPricePerBag: values.feedPricePerBag,
                docPricePerBird: values.docPricePerBird,
                baseSellPrice: values.baseSellPrice,
            });
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
                {isEditingPast && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Historical Policy Warning</AlertTitle>
                        <AlertDescription>
                            Editing a historical policy will affect profit calculations for
                            cycles that ended during this period.
                        </AlertDescription>
                    </Alert>
                )}

                <FormField
                    control={form.control}
                    name="effectiveFrom"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Effective From</FormLabel>
                            <FormControl>
                                <Input type="datetime-local" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="feedPricePerBag"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Feed Price / Bag (৳)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 1800"
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
                    name="docPricePerBird"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>DOC Price / Bird (৳)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 45"
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
                    name="baseSellPrice"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Base Sell Price (৳)</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 150"
                                    {...field}
                                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-2 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onCancel}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Save Changes" : "Create Policy"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
