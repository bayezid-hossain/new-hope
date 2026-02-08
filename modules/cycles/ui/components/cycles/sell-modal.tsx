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
import { useCurrentOrg } from "@/hooks/use-current-org";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Banknote, Bird, Box, Calendar, MapPin, Phone, Plus, ShoppingCart, Truck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const feedItemSchema = z.object({
    type: z.string().min(1, "Required"),
    bags: z.number().min(0, "Must be 0 or greater"),
});

const formSchema = z.object({
    saleDate: z.string().min(1, "Sale date is required"),
    location: z.string().min(1, "Location is required"),
    farmerMobile: z.string().optional(),
    birdsSold: z.number().int().positive("Must sell at least 1 bird"),
    mortalityChange: z.number().int(), // REMOVED min(0)
    totalWeight: z.number().positive("Weight must be greater than 0"),
    pricePerKg: z.number().positive("Price must be greater than 0"),
    cashReceived: z.number().min(0),
    depositReceived: z.number().min(0),
    feedConsumed: z.array(feedItemSchema).min(1, "At least one feed entry required"),
    feedStock: z.array(feedItemSchema),
    medicineCost: z.number().min(0),
});

// ... (rest of the file until the render function)



type FormValues = z.infer<typeof formSchema>;

interface SellModalProps {
    cycleId: string;
    cycleName: string;
    farmerName: string;
    farmerLocation?: string | null;
    farmerMobile?: string | null;
    cycleAge: number;
    doc: number;
    mortality: number;
    birdsSold: number;
    intake: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const SellModal = ({
    cycleId,
    cycleName,
    farmerName,
    farmerLocation,
    farmerMobile,
    cycleAge,
    doc,
    mortality,
    birdsSold,
    intake,
    open,
    onOpenChange,
}: SellModalProps) => {
    const trpc = useTRPC();
    const router = useRouter();
    const queryClient = useQueryClient();
    const { orgId } = useCurrentOrg();
    // Initial remaining birds for default value calculation
    const initialRemainingBirds = doc - mortality - birdsSold;

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            saleDate: format(new Date(), "yyyy-MM-dd"),
            location: farmerLocation || "",
            farmerMobile: farmerMobile || "",
            birdsSold: initialRemainingBirds, // Use initial calculation for default
            mortalityChange: 0,
            totalWeight: 0,
            pricePerKg: 0,
            cashReceived: 0,
            depositReceived: 0,
            feedConsumed: [{ type: "B1", bags: intake || 0 }],
            feedStock: [{ type: "B1", bags: 0 }],
            medicineCost: 0,
        },
    });

    // Reset form with new defaults when modal opens or key props change
    useEffect(() => {
        if (open) {
            const currentRemainingBirds = doc - mortality - birdsSold;
            form.reset({
                saleDate: format(new Date(), "yyyy-MM-dd"),
                location: farmerLocation || "",
                farmerMobile: farmerMobile || "",
                birdsSold: currentRemainingBirds,
                mortalityChange: 0,
                totalWeight: 0,
                pricePerKg: 0,
                cashReceived: 0,
                depositReceived: 0,
                feedConsumed: [{ type: "B1", bags: intake || 0 }],
                feedStock: [{ type: "B1", bags: 0 }],
                medicineCost: 0,
            });
        }
    }, [open, doc, mortality, birdsSold, intake, farmerLocation, farmerMobile, form]);

    const feedConsumedArray = useFieldArray({
        control: form.control,
        name: "feedConsumed",
    });

    const feedStockArray = useFieldArray({
        control: form.control,
        name: "feedStock",
    });

    const mutation = useMutation(
        trpc.officer.sales.createSaleEvent.mutationOptions({
            onSuccess: (data) => {
                if (data.cycleEnded) {
                    toast.success("Sale recorded & cycle ended!", { description: "All birds sold. Cycle has been archived." });
                    // router.push("/cycles");
                } else {
                    toast.success("Sale recorded successfully");
                }

                const baseOptions = { orgId: orgId! };
                queryClient.invalidateQueries(trpc.officer.cycles.listActive.pathFilter());
                queryClient.invalidateQueries(trpc.officer.cycles.listPast.pathFilter());
                queryClient.invalidateQueries(trpc.management.cycles.listActive.pathFilter());
                queryClient.invalidateQueries(trpc.management.cycles.listPast.pathFilter());
                queryClient.invalidateQueries(trpc.admin.cycles.listActive.pathFilter());
                queryClient.invalidateQueries(trpc.admin.cycles.listPast.pathFilter());
                queryClient.invalidateQueries(trpc.officer.cycles.getDetails.pathFilter());
                queryClient.invalidateQueries(trpc.officer.farmers.getDetails.pathFilter());
                queryClient.invalidateQueries(trpc.officer.stock.getHistory.pathFilter());
                queryClient.invalidateQueries(trpc.officer.sales.getSaleEvents.pathFilter());
                queryClient.invalidateQueries(trpc.officer.sales.getRecentSales.pathFilter());
                queryClient.invalidateQueries(trpc.management.reports.getSalesSummary.pathFilter());
                queryClient.invalidateQueries(trpc.management.reports.getSalesLedger.pathFilter());
                queryClient.invalidateQueries(trpc.admin.organizations.getSales.pathFilter());

                onOpenChange(false);
                form.reset();
            },
            onError: (error) => toast.error(error.message),
        })
    );

    const onSubmit = (values: FormValues) => {
        mutation.mutate({
            cycleId,
            location: values.location,
            houseBirds: doc, // This `doc` is the initial number of birds
            birdsSold: values.birdsSold,
            mortalityChange: values.mortalityChange,
            totalMortality: mortality + values.mortalityChange,
            totalWeight: values.totalWeight,
            pricePerKg: values.pricePerKg,
            cashReceived: values.cashReceived,
            depositReceived: values.depositReceived,
            feedConsumed: values.feedConsumed,
            feedStock: values.feedStock,
            medicineCost: values.medicineCost,
        });
    };

    const mortalityChange = form.watch("mortalityChange") || 0;
    const watchBirdsSold = form.watch("birdsSold") || 0;
    const watchWeight = form.watch("totalWeight") || 0;
    const watchPrice = form.watch("pricePerKg") || 0;

    // Birds currently in the house before this transaction
    const birdsInHouse = doc - mortality - birdsSold;

    // Auto-correction logic: bird sold + mortality cannot exceed total birds in house
    useEffect(() => {
        if (watchBirdsSold + mortalityChange > birdsInHouse) {
            form.setValue("birdsSold", Math.max(0, birdsInHouse - mortalityChange));
        }
    }, [watchBirdsSold, mortalityChange, birdsInHouse, form]);

    // SYNC CASH: Automatically update Cash Received when Total Amount changes
    useEffect(() => {
        const total = watchWeight * watchPrice;
        if (total > 0) {
            form.setValue("cashReceived", total);
        }
    }, [watchWeight, watchPrice, form]);

    // Birds remaining AFTER this transaction (subtracting mortality change and current sale)
    const remainingBirdsAfterTransaction = Math.max(0, birdsInHouse - mortalityChange - watchBirdsSold);

    const avgWeight = watchBirdsSold > 0 ? (watchWeight / watchBirdsSold).toFixed(2) : "0.00";
    const totalAmount = (watchWeight * watchPrice).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    return (
        <ResponsiveDialog
            title="Record Sale"
            description={`Sell birds from (${farmerName})`}
            open={open}
            onOpenChange={onOpenChange}
        >
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-h-[50vh] sm:max-h-[70vh] md:max-h-[80vh] overflow-y-auto pr-1">
                    {/* SECTION 1: FARMER INFO & BASIC DETAILS */}
                    <div className="space-y-4">
                        {/* Farmer Header */}
                        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                            <div className="text-center space-y-1">
                                <div className="text-lg font-bold text-blue-900 dark:text-blue-100">{farmerName}</div>
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
                                    <Calendar className="h-3 w-3 text-muted-foreground" />
                                    <span className="font-medium">Age: {cycleAge} days</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                            <Truck className="h-4 w-4" /> Sale Details
                        </div>

                        {/* Date and Mobile Row */}
                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="saleDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Sale Date</FormLabel>
                                        <FormControl>
                                            <Input type="date" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="farmerMobile"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mobile (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. 01XXXXXXXXX" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Location Input */}
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
                                                max={birdsInHouse - mortalityChange}
                                                value={field.value}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
                                                onBlur={field.onBlur}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="mortalityChange"
                                render={({ field }) => {
                                    const currentTotal = mortality + (field.value || 0);
                                    return (
                                        <FormItem>
                                            <FormLabel>Total Mortality To Date</FormLabel>
                                            <FormControl>
                                                <div className="space-y-1">
                                                    <Input
                                                        type="number"
                                                        min={0} // Allow going down to 0
                                                        // max={birdsInHouse + mortality} // Technically, we can't exceed DOC. But let's leave it open or max={doc}
                                                        placeholder={`Current: ${mortality}`}
                                                        value={currentTotal}
                                                        onChange={(e) => {
                                                            const newTotal = e.target.valueAsNumber;
                                                            if (isNaN(newTotal)) return;
                                                            // Allow negative delta
                                                            const delta = newTotal - mortality;
                                                            field.onChange(delta);
                                                        }}
                                                        onBlur={field.onBlur}
                                                    />
                                                    {field.value !== 0 && (
                                                        <p className={`text-[11px] font-medium flex items-center gap-1 ${field.value > 0 ? "text-muted-foreground" : "text-amber-600"}`}>
                                                            {field.value > 0 ? (
                                                                <>
                                                                    <span className="text-red-500 font-bold">+{field.value}</span> new deaths added
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="font-bold">{field.value}</span> correction (restoring birds)
                                                                </>
                                                            )}
                                                        </p>
                                                    )}
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />
                        </div>

                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm flex items-center gap-3">
                            <Bird className="h-5 w-5 text-blue-500" />
                            <div>
                                <div className="font-semibold text-blue-700 dark:text-blue-300">Remaining Birds</div>
                                <div className="text-xs text-blue-600/80 dark:text-blue-400">After this sale: {remainingBirdsAfterTransaction}</div>
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
                                                value={field.value}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
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
                                                value={field.value}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
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
                        <div className="grid grid-cols-2 gap-3">
                            <FormField
                                control={form.control}
                                name="depositReceived"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Deposit (৳)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                value={field.value}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
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
                                                value={field.value}
                                                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
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
                                {remainingBirdsAfterTransaction === 0 ? (
                                    <span className="text-red-500 font-bold animate-pulse">
                                        FINAL Total Cycle Consumption (Last Sale)
                                    </span>
                                ) : (
                                    "Feed Consumed"
                                )}
                            </div>

                            {remainingBirdsAfterTransaction === 0 && (
                                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-md border border-red-100 dark:border-red-800 mb-2">
                                    <strong>Cycle Closing Warning:</strong> This is the last sale. Please enter the
                                    <strong> TOTAL feed consumed for the ENTIRE cycle</strong> below.
                                    This exact amount will be deducted from your stock, overriding previous calculations.
                                </div>

                            )}

                            <FormLabel>Feed Types & Bags</FormLabel>
                            <div className="text-xs text-muted-foreground mb-2">
                                Document remaining sacks returned from the shed.
                            </div>
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
                                                        value={field.value}
                                                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
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
                            <div className="text-xs text-muted-foreground mb-2">
                                Inventory left in main stock for this cycle.
                            </div>
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
                                                        value={field.value}
                                                        onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
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

                    {/* Submit */}
                    <div className="pt-2">
                        <Button type="submit" className="w-full" size="lg" disabled={mutation.isPending}>
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            {mutation.isPending ? "Recording Sale..." : "Record Sale"}
                        </Button>
                    </div>
                </form>
            </Form>
        </ResponsiveDialog>
    );
};
