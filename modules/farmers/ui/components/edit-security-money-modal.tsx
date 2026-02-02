
"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
    amount: z.coerce.number().min(0, "Amount must be positive"),
    reason: z.string().optional()
});

interface EditSecurityMoneyModalProps {
    farmerId: string;
    currentAmount: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variant?: "officer" | "management";
    orgId?: string;
}

export function EditSecurityMoneyModal({
    farmerId,
    currentAmount,
    open,
    onOpenChange,
    variant = "officer",
    orgId
}: EditSecurityMoneyModalProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: currentAmount,
            reason: ""
        }
    });

    useEffect(() => {
        if (open) {
            form.reset({ amount: currentAmount, reason: "" });
        }
    }, [open, currentAmount, form]);

    // Officer Mutations
    const officerMutation = useMutation(trpc.officer.farmers.updateSecurityMoney.mutationOptions({
        onSuccess: () => {
            toast.success("Security money updated");
            queryClient.invalidateQueries(trpc.officer.farmers.getDetails.queryOptions({ farmerId }));
            queryClient.invalidateQueries(trpc.officer.farmers.getSecurityMoneyHistory.queryOptions({ farmerId }));
            onOpenChange(false);
        },
        onError: (err) => toast.error(`Failed to update: ${err.message}`)
    }));

    // Management Mutations
    const managementMutation = useMutation(trpc.management.farmers.updateSecurityMoney.mutationOptions({
        onSuccess: () => {
            toast.success("Security money updated");
            queryClient.invalidateQueries({ queryKey: [["management", "farmers"]] });
            onOpenChange(false);
        },
        onError: (err) => toast.error(`Failed to update: ${err.message}`)
    }));

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        if (variant === "officer") {
            officerMutation.mutate({
                id: farmerId,
                amount: values.amount,
                reason: values.reason
            });
        } else {
            if (!orgId) {
                toast.error("Configuration error: Missing Organization ID");
                return;
            }
            managementMutation.mutate({
                orgId: orgId,
                id: farmerId,
                amount: values.amount,
                reason: values.reason
            });
        }
    };

    const isPending = officerMutation.isPending || managementMutation.isPending;

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title="Update Security Money"
            description="Change the security deposit amount for this farmer."
            className="w-full sm:max-w-lg"
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Security Amount</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reason for Change (Optional)</FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="e.g. Updated agreement, Correction..."
                                        className="resize-none"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Update Amount
                        </Button>
                    </div>
                </form>
            </Form>
        </ResponsiveDialog>
    );
}
