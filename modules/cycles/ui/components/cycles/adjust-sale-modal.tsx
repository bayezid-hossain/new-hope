"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const adjustSaleSchema = z.object({
    birdsSold: z.coerce.number().int().positive("Must be at least 1 bird"),
    totalMortality: z.coerce.number().int().min(0, "Cannot be negative"),
    totalWeight: z.coerce.number().positive("Weight must be positive"),
    pricePerKg: z.coerce.number().positive("Price must be positive"),

    cashReceived: z.coerce.number().min(0, "Cannot be negative"),
    depositReceived: z.coerce.number().min(0, "Cannot be negative"),
    medicineCost: z.coerce.number().min(0, "Cannot be negative"),

    adjustmentNote: z.string().optional(),
});

interface AdjustSaleModalProps {
    isOpen: boolean;
    onClose: () => void;
    saleEvent: {
        id: string;
        birdsSold: number;
        totalMortality: number;
        houseBirds: number;
        totalWeight: string; // Decimal string from DB
        pricePerKg: string; // Decimal string from DB
        cashReceived?: string | null;
        depositReceived?: string | null;
        medicineCost?: string | null;
    };
    latestReport?: {
        birdsSold: number;
        totalMortality?: number | null;
        totalWeight: string;
        pricePerKg: string;
        cashReceived?: string | null;
        depositReceived?: string | null;
        medicineCost?: string | null;
    };
}

export const AdjustSaleModal = ({ isOpen, onClose, saleEvent, latestReport }: AdjustSaleModalProps) => {
    const trpc = useTRPC();
    const queryClient = useQueryClient();
    const [calculatedTotal, setCalculatedTotal] = useState<number>(0);

    const defaultValues = {
        birdsSold: latestReport ? latestReport.birdsSold : saleEvent.birdsSold,
        totalMortality: latestReport
            ? (latestReport.totalMortality ?? saleEvent.totalMortality ?? 0)
            : (saleEvent.totalMortality ?? 0),
        totalWeight: parseFloat(latestReport ? latestReport.totalWeight : saleEvent.totalWeight),
        pricePerKg: parseFloat(latestReport ? latestReport.pricePerKg : saleEvent.pricePerKg),

        cashReceived: parseFloat(latestReport?.cashReceived ?? saleEvent.cashReceived ?? "0"),
        depositReceived: parseFloat(latestReport?.depositReceived ?? saleEvent.depositReceived ?? "0"),
        medicineCost: parseFloat(latestReport?.medicineCost ?? saleEvent.medicineCost ?? "0"),

        adjustmentNote: "",
    };

    const form = useForm<z.infer<typeof adjustSaleSchema>>({
        resolver: zodResolver(adjustSaleSchema),
        defaultValues,
    });

    const { watch } = form;
    const wWeight = watch("totalWeight");
    const wPrice = watch("pricePerKg");

    useEffect(() => {
        if (wWeight && wPrice) {
            setCalculatedTotal(wWeight * wPrice);
        } else {
            setCalculatedTotal(0);
        }
    }, [wWeight, wPrice]);

    // Auto-correction logic: bird sold + mortality cannot exceed total birds
    const wBirdsSold = watch("birdsSold");
    const wMortality = watch("totalMortality");

    // SYNC CASH: Automatically update Cash Received when Total Amount changes
    useEffect(() => {
        const total = wWeight * wPrice;
        if (total > 0) {
            form.setValue("cashReceived", total);
        }
    }, [wWeight, wPrice, form]);

    useEffect(() => {
        if (wBirdsSold + wMortality > saleEvent.houseBirds) {
            form.setValue("birdsSold", Math.max(0, saleEvent.houseBirds - wMortality));
        }
    }, [wBirdsSold, wMortality, saleEvent.houseBirds, form]);

    // Reset form when modal opens with new data
    useEffect(() => {
        if (isOpen) {
            form.reset({
                birdsSold: latestReport ? latestReport.birdsSold : saleEvent.birdsSold,
                totalMortality: latestReport
                    ? (latestReport.totalMortality ?? saleEvent.totalMortality ?? 0)
                    : (saleEvent.totalMortality ?? 0),
                totalWeight: parseFloat(latestReport ? latestReport.totalWeight : saleEvent.totalWeight),
                pricePerKg: parseFloat(latestReport ? latestReport.pricePerKg : saleEvent.pricePerKg),

                cashReceived: parseFloat(latestReport?.cashReceived ?? saleEvent.cashReceived ?? "0"),
                depositReceived: parseFloat(latestReport?.depositReceived ?? saleEvent.depositReceived ?? "0"),
                medicineCost: parseFloat(latestReport?.medicineCost ?? saleEvent.medicineCost ?? "0"),

                adjustmentNote: "",
            });
        }
    }, [isOpen, saleEvent, latestReport, form]);

    const generateReport = useMutation(trpc.officer.sales.generateReport.mutationOptions({
        onSuccess: () => {
            toast.success("Adjustment created successfully");
            Promise.all([
                queryClient.invalidateQueries(trpc.officer.sales.getSaleEvents.pathFilter()),
                queryClient.invalidateQueries(trpc.officer.cycles.listActive.pathFilter()),
                queryClient.invalidateQueries(trpc.officer.cycles.listPast.pathFilter()),
                queryClient.invalidateQueries(trpc.officer.farmers.getDetails.pathFilter()),
                queryClient.invalidateQueries(trpc.officer.stock.getHistory.pathFilter()),
            ]);
            onClose();
        },
        onError: (err) => {
            toast.error(err.message || "Failed to create adjustment");
        },
    }));

    const onSubmit = (values: z.infer<typeof adjustSaleSchema>) => {
        generateReport.mutate({
            saleEventId: saleEvent.id,
            birdsSold: values.birdsSold,
            totalMortality: values.totalMortality,
            totalWeight: values.totalWeight,
            pricePerKg: values.pricePerKg,

            cashReceived: values.cashReceived,
            depositReceived: values.depositReceived,
            medicineCost: values.medicineCost,

            adjustmentNote: values.adjustmentNote,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Adjust Sales Report</DialogTitle>
                    <DialogDescription>
                        Create a new version of this bill. Financials and Mortality will be updated accordingly.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Section 1: Bill Info */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <FileText className="h-4 w-4" /> Bill Info
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="birdsSold"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Birds Sold</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    max={saleEvent.houseBirds}
                                                    {...field}
                                                    onChange={(e) => {
                                                        const val = e.target.valueAsNumber || 0;
                                                        field.onChange(val > saleEvent.houseBirds ? saleEvent.houseBirds : val);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="totalMortality"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Mortality</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    max={saleEvent.houseBirds}
                                                    {...field}
                                                    onChange={(e) => {
                                                        const val = e.target.valueAsNumber || 0;
                                                        field.onChange(val > saleEvent.houseBirds ? saleEvent.houseBirds : val);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="totalWeight"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Total Weight (kg)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="pricePerKg"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Price / Kg</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="p-3 bg-muted/50 rounded-lg flex justify-between items-center border border-border/50">
                                <span className="text-sm font-medium text-muted-foreground">Calculated Total:</span>
                                <span className="text-lg font-bold text-primary">৳{calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>

                        <Separator />

                        {/* Section 2: Payments */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <Banknote className="h-4 w-4" /> Payments & Costs
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="depositReceived"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Deposit (৳)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="cashReceived"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Cash (৳)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="medicineCost"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Medicine Cost (৳)</FormLabel>
                                        <FormControl>
                                            <Input type="number" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Separator />

                        {/* Section 3: Reason */}
                        <FormField
                            control={form.control}
                            name="adjustmentNote"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adjustment Reason</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g. Buyer disputed weight" className="resize-none" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
                            <Button type="submit" disabled={generateReport.isPending}>
                                {generateReport.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save New Version
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
};