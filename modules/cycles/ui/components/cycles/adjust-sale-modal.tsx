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
import { feedItemSchema } from "@/modules/shared/types/feed";
import type { SaleReport } from "@/modules/shared/types/sale";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Banknote, Bird, Box, FileText, ShoppingCart, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { FarmerInfoHeader, FeedFieldArray, SaleMetricsBar } from "./sale-form-sections";
import { ensureB1B2 } from "./sale-form-utils";

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

    const handleFeedAdjustment = (index: number, newBags: number) => {
        const currentType = (form.getValues(`feedConsumed.${index}.type`) || "").toUpperCase().trim();
        if (!currentType) return;

        // Baseline is either latestReport or saleEvent
        const baselineConsumedRaw = latestReport && latestReport.feedConsumed
            ? JSON.parse(latestReport.feedConsumed)
            : saleEvent.feedConsumed;

        const baselineStockRaw = latestReport && latestReport.feedStock
            ? JSON.parse(latestReport.feedStock)
            : saleEvent.feedStock;

        const baselineConsumed = ensureB1B2(baselineConsumedRaw || []);
        const baselineStock = ensureB1B2(baselineStockRaw || []);

        const baseline = baselineConsumed.find(b => (b.type || "").toUpperCase().trim() === currentType);
        const baselineBags = Number(baseline?.bags || 0);
        const consumedDelta = newBags - baselineBags;

        const currentStock = [...form.getValues("feedStock")];
        const stockIndex = currentStock.findIndex(s => (s.type || "").toUpperCase().trim() === currentType);

        if (stockIndex > -1) {
            const bStock = baselineStock.find(bs => (bs.type || "").toUpperCase().trim() === currentType);
            const baselineStockBags = Number(bStock?.bags || 0);
            const newStockBags = Math.max(0, baselineStockBags - consumedDelta);

            if (Number(currentStock[stockIndex].bags) !== newStockBags) {
                currentStock[stockIndex] = { ...currentStock[stockIndex], bags: newStockBags };
                form.setValue("feedStock", currentStock, { shouldValidate: true, shouldDirty: true });
            }
        }
    };

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
                        <FarmerInfoHeader
                            farmerName={farmerName}
                            farmerLocation={farmerLocation}
                            farmerMobile={farmerMobile}
                            cycleAge={cycleAge}
                            colorScheme="orange"
                        />

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
                        <SaleMetricsBar avgWeight={avgWeight} totalAmount={totalAmount} />

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

                            <FeedFieldArray
                                control={form.control}
                                fieldArray={feedConsumedArray}
                                namePrefix="feedConsumed"
                                label="Feed Types & Bags"
                                onBagsChange={handleFeedAdjustment}
                            />
                        </div>

                        {/* Feed Stock - Dynamic Array */}
                        <div className="space-y-2 pt-4 border-t">
                            <FeedFieldArray
                                control={form.control}
                                fieldArray={feedStockArray}
                                namePrefix="feedStock"
                                label="Remaining Feed Stock"
                                showRemoveOnSingle
                            />
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