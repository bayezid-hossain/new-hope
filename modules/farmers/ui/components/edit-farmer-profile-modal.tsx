"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(100),
    location: z.string().max(200).optional().nullable(),
    // Validate BD Mobile: Starts with 01, followed by 3-9, then 8 digits (Total 11)
    // Validate BD Mobile: Optional +88 or 88 prefix, followed by 01, 3-9, then 8 digits
    mobile: z.string().regex(/^(?:\+?88)?01[3-9]\d{8}$/, "Invalid mobile number (must be 11 digits starting with 01, optionally with +88/88 prefix)").optional().nullable()
});

interface EditFarmerProfileModalProps {
    farmerId: string;
    currentName: string;
    currentLocation?: string | null;
    currentMobile?: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function EditFarmerProfileModal({
    farmerId,
    currentName,
    currentLocation,
    currentMobile,
    open,
    onOpenChange,
}: EditFarmerProfileModalProps) {
    const trpc = useTRPC();
    const { orgId } = useCurrentOrg();
    const queryClient = useQueryClient();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: currentName,
            location: currentLocation || "",
            mobile: currentMobile || ""
        }
    });

    useEffect(() => {
        if (open) {
            form.reset({
                name: currentName,
                location: currentLocation || "",
                mobile: currentMobile || ""
            });
        }
    }, [open, currentName, currentLocation, currentMobile, form]);

    const updateMutation = useMutation(
        trpc.officer.farmers.updateProfile.mutationOptions({
            onSuccess: () => {
                toast.success("Farmer profile updated successfully");
                // Invalidate all farmer-related queries to ensure fresh data
                queryClient.invalidateQueries({ queryKey: [["officer", "farmers"]] });
                queryClient.invalidateQueries({ queryKey: [["management", "farmers"]] });
                queryClient.invalidateQueries({ queryKey: [["officer", "cycles"]] });
                queryClient.invalidateQueries({ queryKey: [["admin", "cycles"]] });
                onOpenChange(false);
            },
            onError: (error) => toast.error(error.message),
        })
    );

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        updateMutation.mutate({
            id: farmerId,
            name: values.name.trim(),
            orgId: orgId!,
            location: values.location?.trim() || null,
            mobile: values.mobile?.trim() || null
        });
    };

    return (
        <ResponsiveDialog
            title="Edit Farmer Profile"
            description="Update the farmer's name, location, and contact information."
            open={open}
            onOpenChange={onOpenChange}
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Farmer Name *</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        placeholder="Enter farmer name"
                                        className="uppercase"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="location"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Location</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        value={field.value ?? ""}
                                        placeholder="e.g. Village, District"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="mobile"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Mobile Number</FormLabel>
                                <FormControl>
                                    <Input
                                        {...field}
                                        value={field.value ?? ""}
                                        type="tel"
                                        placeholder="e.g. 01712345678"
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
                            onClick={() => onOpenChange(false)}
                            disabled={updateMutation.isPending}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={updateMutation.isPending || !form.watch("name").trim()}
                        >
                            {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                        </Button>
                    </div>
                </form>
            </Form>
        </ResponsiveDialog>
    );
}
