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
import { Banknote, Box, FileText, Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const feedItemSchema = z.object({
    type: z.string().min(1, "Required"),
    bags: z.number().min(0, "Must be 0 or greater"),
});

const adjustSaleSchema = z.object({
    birdsSold: z.coerce.number().int().positive("Must be at least 1 bird"),
    totalMortality: z.coerce.number().int().min(0, "Cannot be negative"),
    totalWeight: z.coerce.number().positive("Weight must be positive"),
    pricePerKg: z.coerce.number().positive("Price must be positive"),

    cashReceived: z.coerce.number().min(0, "Cannot be negative"),
    depositReceived: z.coerce.number().min(0, "Cannot be negative"),
    medicineCost: z.coerce.number().min(0, "Cannot be negative"),

    feedConsumed: z.array(feedItemSchema).min(1, "At least one feed entry required"),
    feedStock: z.array(feedItemSchema),

    location: z.string().min(1, "Location is required"),
    party: z.string().optional(),
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
        location: string;
        party?: string | null;
        totalWeight: string;
        pricePerKg: string;
        cashReceived?: string | null;
        depositReceived?: string | null;
        medicineCost?: string | null;
        feedConsumed: { type: string; bags: number }[];
        feedStock: { type: string; bags: number }[];
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

// Helper to ensure B1 and B2 are present and at the top
const ensureB1B2 = (items: { type: string; bags: number }[] = []) => {
    const result = [...items];
    if (!result.find(i => i.type.toUpperCase() === "B1")) {
        result.push({ type: "B1", bags: 0 });
    }
    if (!result.find(i => i.type.toUpperCase() === "B2")) {
        result.push({ type: "B2", bags: 0 });
    }
    // Sort to keep B1 and B2 at top
    return result.sort((a, b) => {
        const typeA = a.type.toUpperCase();
        const typeB = b.type.toUpperCase();
        if (typeA === "B1") return -1;
        if (typeB === "B1") return 1;
        if (typeA === "B2") return -1;
        if (typeB === "B2") return 1;
        return 0;
    });
};

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

        feedConsumed: ensureB1B2(saleEvent.feedConsumed),
        feedStock: ensureB1B2(saleEvent.feedStock),

        location: saleEvent.location,
        party: saleEvent.party || "",
        adjustmentNote: "",
    };

    const form = useForm<z.infer<typeof adjustSaleSchema>>({
        resolver: zodResolver(adjustSaleSchema),
        defaultValues,
    });

    const feedConsumedArray = useFieldArray({
        control: form.control,
        name: "feedConsumed",
    });

    const feedStockArray = useFieldArray({
        control: form.control,
        name: "feedStock",
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

                feedConsumed: ensureB1B2(saleEvent.feedConsumed),
                feedStock: ensureB1B2(saleEvent.feedStock),

                location: saleEvent.location,
                party: saleEvent.party || "",
                adjustmentNote: "",
            });
        }
    }, [isOpen, saleEvent, latestReport, form]);

    const generateReport = useMutation(trpc.officer.sales.generateReport.mutationOptions({
        onSuccess: () => {
            toast.success("Adjustment created successfully");
            Promise.all([
                queryClient.invalidateQueries(trpc.officer.sales.getSaleEvents.pathFilter()),
                queryClient.invalidateQueries(trpc.officer.sales.getRecentSales.pathFilter()),
                queryClient.invalidateQueries(trpc.management.reports.getSalesSummary.pathFilter()),
                queryClient.invalidateQueries(trpc.management.reports.getSalesLedger.pathFilter()),
                queryClient.invalidateQueries(trpc.admin.organizations.getSales.pathFilter()),
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

            feedConsumed: values.feedConsumed,
            feedStock: values.feedStock,

            location: values.location,
            party: values.party,
            adjustmentNote: values.adjustmentNote,
        });
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Adjust Sales Report</DialogTitle>
                    <DialogDescription>
                        Create a new version of this bill. Financials and Mortality will be updated accordingly.
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        {/* Section 0: Location & Party */}
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Location</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="party"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Party Name</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Separator />

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
                                                    value={field.value || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? 0 : e.target.valueAsNumber;
                                                        field.onChange(val > saleEvent.houseBirds ? saleEvent.houseBirds : (val || 0));
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
                                                    value={field.value || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? 0 : e.target.valueAsNumber;
                                                        field.onChange(val > saleEvent.houseBirds ? saleEvent.houseBirds : (val || 0));
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="totalWeight"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Total Weight (kg)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={field.value || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? 0 : e.target.valueAsNumber;
                                                        field.onChange(val || 0);
                                                    }}
                                                />
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
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    value={field.value || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? 0 : e.target.valueAsNumber;
                                                        field.onChange(val || 0);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                                <div>
                                    <div className="text-xs text-muted-foreground">Avg Weight</div>
                                    <div className="font-mono font-bold text-lg">{wBirdsSold > 0 ? (wWeight / wBirdsSold).toFixed(2) : "0.00"} kg</div>
                                </div>
                                <div>
                                    <div className="text-xs text-muted-foreground">Total Amount</div>
                                    <div className="font-mono font-bold text-lg text-emerald-600 dark:text-emerald-400">৳{calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                                </div>
                            </div>
                        </div>

                        <Separator />

                        {/* Section 2: Payments */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <Banknote className="h-4 w-4" /> Payments & Costs
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <FormField
                                    control={form.control}
                                    name="depositReceived"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Deposit (৳)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    value={field.value || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? 0 : e.target.valueAsNumber;
                                                        field.onChange(val || 0);
                                                    }}
                                                />
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
                                                <Input
                                                    type="number"
                                                    value={field.value || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? 0 : e.target.valueAsNumber;
                                                        field.onChange(val || 0);
                                                    }}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                            </div>
                        </div>

                        <Separator />

                        {/* Section 3: Inventory */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <Box className="h-4 w-4" /> Inventory
                            </div>

                            {/* Feed Consumed */}
                            <div className="space-y-2">
                                <FormLabel>Feed Consumed</FormLabel>
                                {feedConsumedArray.fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-end">
                                        <FormField
                                            control={form.control}
                                            name={`feedConsumed.${index}.type` as const}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input placeholder="Type (B1, B2...)" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`feedConsumed.${index}.bags` as const}
                                            render={({ field }) => (
                                                <FormItem className="w-20">
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            placeholder="Bags"
                                                            value={field.value || ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value === "" ? 0 : e.target.valueAsNumber;
                                                                field.onChange(val || 0);
                                                            }}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        {feedConsumedArray.fields.length > 1 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-10 w-10 text-destructive hover:text-destructive"
                                                onClick={() => feedConsumedArray.remove(index)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => feedConsumedArray.append({ type: "", bags: 0 })}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add Feed Type
                                </Button>
                            </div>

                            {/* Feed Stock */}
                            <div className="space-y-2 pt-2 border-t">
                                <FormLabel>Remaining Feed Stock</FormLabel>
                                {feedStockArray.fields.map((field, index) => (
                                    <div key={field.id} className="flex gap-2 items-end">
                                        <FormField
                                            control={form.control}
                                            name={`feedStock.${index}.type` as const}
                                            render={({ field }) => (
                                                <FormItem className="flex-1">
                                                    <FormControl>
                                                        <Input placeholder="Type (B1, B2...)" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name={`feedStock.${index}.bags` as const}
                                            render={({ field }) => (
                                                <FormItem className="w-20">
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            placeholder="Bags"
                                                            value={field.value || ""}
                                                            onChange={(e) => {
                                                                const val = e.target.value === "" ? 0 : e.target.valueAsNumber;
                                                                field.onChange(val || 0);
                                                            }}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="h-10 w-10 text-destructive hover:text-destructive"
                                            onClick={() => feedStockArray.remove(index)}
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => feedStockArray.append({ type: "", bags: 0 })}
                                    className="w-full"
                                >
                                    <Plus className="h-4 w-4 mr-2" /> Add Stock Type
                                </Button>
                            </div>
                        </div>

                        <Separator />

                        {/* Section 4: Reason */}
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