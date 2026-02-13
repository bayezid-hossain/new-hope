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
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Bird, Box, Calendar as CalendarIcon, FileText, MapPin, Phone, Plus, ShoppingCart, Truck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { type SaleReport } from "./sales-history-card";

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
    farmerMobile: z.string().optional(),
    adjustmentNote: z.string().min(0, "Please provide a more detailed reason for this adjustment"),
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
        farmerMobile?: string | null;
        totalWeight: string;
        pricePerKg: string;
        cashReceived?: string | null;
        depositReceived?: string | null;
        medicineCost?: string | null;
        feedConsumed: { type: string; bags: number }[];
        feedStock: { type: string; bags: number }[];

        farmerName?: string;
        isLatestInCycle?: boolean;
        cycleContext?: {
            doc: number;
            mortality: number;
            age: number;
            totalWeight?: number;
            cumulativeBirdsSold?: number;
        };
    };
    latestReport?: SaleReport | null;
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

        feedConsumed: ensureB1B2(
            latestReport && latestReport.feedConsumed
                ? JSON.parse(latestReport.feedConsumed)
                : saleEvent.feedConsumed
        ),
        feedStock: ensureB1B2(
            latestReport && latestReport.feedStock
                ? JSON.parse(latestReport.feedStock)
                : saleEvent.feedStock
        ),

        location: saleEvent.location,
        party: saleEvent.party || "",
        farmerMobile: saleEvent.farmerMobile || "",
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

                feedConsumed: ensureB1B2(
                    latestReport && latestReport.feedConsumed
                        ? JSON.parse(latestReport.feedConsumed)
                        : saleEvent.feedConsumed
                ),
                feedStock: ensureB1B2(
                    latestReport && latestReport.feedStock
                        ? JSON.parse(latestReport.feedStock)
                        : saleEvent.feedStock
                ),

                location: saleEvent.location,
                party: saleEvent.party || "",
                farmerMobile: saleEvent.farmerMobile || "",
                adjustmentNote: "",
            });
        }
    }, [isOpen, saleEvent, latestReport, form]);

    const birdsInHouse = saleEvent.houseBirds;
    const isLatest = saleEvent.isLatestInCycle || false;
    const cumulativeWeight = saleEvent.cycleContext?.totalWeight || 0;
    const cumulativeBirdsSold = saleEvent.cycleContext?.cumulativeBirdsSold || 0;

    const remainingBirdsAfterAdjustment = Math.max(0, birdsInHouse - wMortality - wBirdsSold);
    const avgWeight = (isLatest && cumulativeWeight > 0 && cumulativeBirdsSold > 0)
        ? (cumulativeWeight / cumulativeBirdsSold).toFixed(2)
        : (wBirdsSold > 0 ? (wWeight / wBirdsSold).toFixed(2) : "0.00");

    const totalAmount = calculatedTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

    const farmerName = saleEvent.farmerName || "Farmer";
    const farmerLocation = saleEvent.location;
    const farmerMobile = form.watch("farmerMobile");
    const cycleAge = saleEvent.cycleContext?.age || 0;

    return (
        <ResponsiveDialog
            title="Adjust Sales Report"
            description="Create a new version of this bill. Financials and Mortality will be updated accordingly."
            open={isOpen}
            onOpenChange={(open) => !open && onClose()}
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 h-[80vh] overflow-y-auto pr-1">
                    {/* SECTION 1: FARMER INFO & BASIC DETAILS */}
                    <div className="space-y-4">
                        {/* Farmer Header */}
                        <div className="p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-lg border border-orange-100 dark:border-orange-800">
                            <div className="text-center space-y-1">
                                <div className="text-lg font-bold text-orange-900 dark:text-orange-100">{farmerName}</div>
                                <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
                                    {farmerLocation && (
                                        <span className="flex items-center gap-1">
                                            <MapPin className="h-3 w-3" /> {farmerLocation}
                                        </span>
                                    )}
                                    {farmerMobile && (
                                        <span className="flex items-center gap-1">
                                            <Phone className="h-3 w-3" /> {farmerMobile}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="mt-3 flex items-center justify-center gap-4 text-sm">
                                <div className="flex items-center gap-1 px-3 py-1 bg-white/50 dark:bg-black/20 rounded-full">
                                    <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium">Age: {cycleAge} days</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <Truck className="h-4 w-4" /> Sale Details
                        </div>

                        {/* Location and Party Input */}
                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="location"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Sale Location</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Bhaluka" {...field} />
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
                                            <Input placeholder="e.g. Habib Party" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Sale Details */}
                        <div className="grid grid-cols-3 gap-3">
                            <div className="text-sm p-2 bg-muted rounded-md flex flex-col justify-center">
                                <div className="text-muted-foreground text-xs">House Birds</div>
                                <div className="font-mono font-bold text-lg">{birdsInHouse.toLocaleString()}</div>
                            </div>
                            <FormField
                                control={form.control}
                                name="birdsSold"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Birds Sold</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                max={birdsInHouse}
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
                                name="totalMortality"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Total Mortality</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min={0}
                                                max={birdsInHouse}
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

                        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg text-sm flex items-center gap-3">
                            <Bird className="h-5 w-5 text-orange-500" />
                            <div>
                                <div className="font-semibold text-orange-700 dark:text-orange-300">Remaining Birds</div>
                                <div className="text-xs text-orange-600/80 dark:text-orange-400">After this adjustment: {remainingBirdsAfterAdjustment}</div>
                            </div>
                        </div>
                    </div>

                    <Separator />

                    {/* SECTION 2: FINANCIALS */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <Banknote className="h-4 w-4" /> Finance
                        </div>

                        {/* Weight & Price */}
                        <div className="grid grid-cols-2 gap-3">
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
                                        <FormLabel>Price/kg (৳)</FormLabel>
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

                        {/* Calculated Values */}
                        <div className="grid grid-cols-2 gap-3 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-200 dark:border-emerald-800">
                            <div>
                                <div className="text-xs text-muted-foreground">Avg Weight</div>
                                <div className="font-mono font-bold text-lg">{avgWeight} kg</div>
                            </div>
                            <div>
                                <div className="text-xs text-muted-foreground">Total Amount</div>
                                <div className="font-mono font-bold text-lg text-emerald-600 dark:text-emerald-400">৳{totalAmount}</div>
                            </div>
                        </div>

                        {/* Payment */}
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
                            <FormField
                                control={form.control}
                                name="medicineCost"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Medicine (৳)</FormLabel>
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

                    {/* SECTION 3: INVENTORY */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <Box className="h-4 w-4" /> Inventory
                        </div>

                        {/* Feed Consumed - Dynamic Array */}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <Box className="h-4 w-4" />
                                {remainingBirdsAfterAdjustment === 0 ? (
                                    <span className="text-red-500 font-bold animate-pulse">
                                        FINAL Total Cycle Consumption (Last Sale)
                                    </span>
                                ) : (
                                    "Feed Consumed"
                                )}
                            </div>

                            {remainingBirdsAfterAdjustment === 0 && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md border border-red-100 dark:border-red-800 mb-2">
                                    <strong>Cycle Closing Warning:</strong> This is the last sale. Please enter the
                                    <strong> TOTAL feed consumed for the ENTIRE cycle</strong> below.
                                </div>
                            )}

                            <FormLabel>Feed Types & Bags</FormLabel>
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
                                            <FormItem className="w-24">
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

                        {/* Feed Stock - Dynamic Array */}
                        <div className="space-y-2 pt-4 border-t">
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
                                            <FormItem className="w-24">
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

                    {/* SECTION 4: REASON */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <FileText className="h-4 w-4" /> Adjustment Details
                        </div>
                        <FormField
                            control={form.control}
                            name="adjustmentNote"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Adjustment Reason</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="e.g. Buyer disputed weight, correcting mortality count, etc."
                                            className="resize-none h-24"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>

                    <div className="pt-2 sticky bottom-0 bg-background/80 backdrop-blur-sm pb-2">
                        <Button type="submit" className="w-full" size="lg" disabled={generateReport.isPending}>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            {generateReport.isPending ? "Saving Version..." : "Save New Version"}
                        </Button>
                    </div>
                </form>
            </Form>
        </ResponsiveDialog>
    );
};