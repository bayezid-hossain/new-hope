"use client";

import { useLoading } from "@/components/providers/loading-provider";
import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import { feedItemSchema } from "@/modules/shared/types/feed";
import { useTRPC } from "@/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Banknote, Bird, Box, Calendar as CalendarIcon, Plus, ShoppingCart, Truck } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { AddFeedModal } from "../mainstock/add-feed-modal";
import { FarmerInfoHeader, FeedFieldArray, SaleMetricsBar } from "./sale-form-sections";

const formSchema = z.object({
    saleDate: z.string().min(1, "Sale date is required"),
    location: z.string().min(1, "Location is required"),
    party: z.string().optional(),
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

type FormValues = z.infer<typeof formSchema>;

interface SellModalProps {
    cycleId: string;
    farmerId: string;
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
    startDate: Date;
}

export const SellModal = ({
    cycleId,
    farmerId,
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
    startDate
}: SellModalProps) => {
    const { showLoading } = useLoading();
    const trpc = useTRPC();
    const router = useRouter();
    const pathname = usePathname();
    const queryClient = useQueryClient();
    const { orgId, canEdit } = useCurrentOrg();
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
            feedConsumed: [
                { type: "B1", bags: intake || 0 },
                { type: "B2", bags: 0 }
            ],
            feedStock: [
                { type: "B1", bags: 0 },
                { type: "B2", bags: 0 }
            ],
            medicineCost: 0,
        },
    });

    const { data: previousSales } = useQuery({
        ...trpc.officer.sales.getSaleEvents.queryOptions({ cycleId }),
        enabled: open
    });

    const lastSale = previousSales?.[0];

    // Reset form with new defaults when modal opens or key props change
    useEffect(() => {
        if (open) {
            const currentRemainingBirds = doc - mortality - birdsSold;

            // Auto-fill feed from previous sale if available, otherwise use default
            const defaultFeedConsumed = lastSale?.feedConsumed || [
                { type: "B1", bags: intake || 0 },
                { type: "B2", bags: 0 }
            ];

            // Auto-fill feed from previous sale if available, otherwise use default
            const defaultFeedStock = lastSale?.feedStock || [
                { type: "B1", bags: 0 },
                { type: "B2", bags: 0 }
            ];

            form.reset({
                saleDate: format(new Date(), "yyyy-MM-dd"),
                location: farmerLocation || "",
                party: "",
                farmerMobile: farmerMobile || "",
                birdsSold: currentRemainingBirds,
                mortalityChange: 0,
                totalWeight: 0,
                pricePerKg: 0,
                cashReceived: 0,
                depositReceived: 0,
                feedConsumed: defaultFeedConsumed,
                feedStock: defaultFeedStock,
                medicineCost: 0,
            });
        }
    }, [open, doc, mortality, birdsSold, intake, farmerLocation, farmerMobile, form, lastSale]);

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
                    if (data.historyId) {
                        // Only redirect if NOT on the farmer details page
                        if (!pathname?.includes('/farmers/')) {
                            showLoading("Loading cycle history...")
                            router.push(`/cycles/${data.historyId}`);
                        }
                    }
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
        const now = new Date();
        const saleDateWithTime = new Date(values.saleDate);
        saleDateWithTime.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());

        mutation.mutate({
            cycleId,
            saleDate: saleDateWithTime,
            location: values.location,
            party: values.party,
            houseBirds: doc,
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
            farmerMobile: values.farmerMobile ?? "",
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

    // Fetch Farmer Details for Stock Check
    const { data: farmer } = useQuery(
        trpc.officer.farmers.getDetails.queryOptions({ farmerId: farmerId }, { enabled: open })
    );

    const mainStock = farmer?.mainStock || 0;

    const handleFeedAdjustment = (index: number, newBags: number) => {
        if (!lastSale) return;

        const currentType = (form.getValues(`feedConsumed.${index}.type`) || "").toUpperCase().trim();
        if (!currentType) return;

        const baselineConsumed = (lastSale.feedConsumed || []) as { type: string; bags: number }[];
        const baselineStock = (lastSale.feedStock || []) as { type: string; bags: number }[];

        // Find baseline consumption for this type
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

    // Calculate total bags needed: Sum of feed consumed + Sum of remaining feed stock
    const totalBagsNeeded = form.watch("feedConsumed").reduce((acc, item) => acc + (item.bags || 0), 0) +
        form.watch("feedStock").reduce((acc, item) => acc + (item.bags || 0), 0);

    const isStockInsufficient = totalBagsNeeded > mainStock;
    const [showRestockModal, setShowRestockModal] = useState(false);

    return (
        <>
            <ResponsiveDialog
                title="Record Sale"
                description={`Sell birds from (${farmerName})`}
                open={open}
                onOpenChange={onOpenChange}
                persistent={true}
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
                                colorScheme="blue"
                            />

                            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                                <Truck className="h-4 w-4" /> Sale Details
                            </div>

                            {/* Date and Mobile Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <FormField
                                    control={form.control}
                                    name="saleDate"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Sale Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant={"outline"}
                                                            className={cn(
                                                                "w-full pl-3 text-left font-normal",
                                                                !field.value && "text-muted-foreground"
                                                            )}
                                                        >
                                                            {field.value ? (
                                                                format(new Date(field.value), "dd/MM/yyyy")
                                                            ) : (
                                                                <span>Pick a date</span>
                                                            )}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="single"
                                                        selected={field.value ? new Date(field.value) : undefined}
                                                        onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                                        disabled={(date) => {
                                                            const s = startDate ? new Date(startDate) : null;
                                                            if (s) {
                                                                s.setHours(0, 0, 0, 0);
                                                                return date < s || date > new Date();
                                                            }
                                                            return date > new Date();
                                                        }}
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
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
                                                    max={birdsInHouse - mortalityChange}
                                                    value={field.value || ""}
                                                    onChange={(e) => {
                                                        const val = e.target.value === "" ? 0 : e.target.valueAsNumber;
                                                        field.onChange(val || 0);
                                                    }}
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
                                                            value={currentTotal || ""}
                                                            onChange={(e) => {
                                                                const newTotal = e.target.value === "" ? mortality : e.target.valueAsNumber;
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

                                <FeedFieldArray
                                    control={form.control}
                                    fieldArray={feedConsumedArray}
                                    namePrefix="feedConsumed"
                                    label="Feed Types & Bags"
                                    description="Document remaining sacks returned from the shed."
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
                                    description="Inventory left in main stock for this cycle."
                                    showRemoveOnSingle
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <div className="pt-2 space-y-3">
                            {isStockInsufficient && (
                                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg space-y-2">
                                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-semibold">
                                        <AlertTriangle className="h-4 w-4" />
                                        Insufficient Stock
                                    </div>
                                    <p className="text-xs text-amber-600 dark:text-amber-500">
                                        You are trying to use {totalBagsNeeded} bags, but the main stock only has {mainStock} bags.
                                    </p>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="w-full text-amber-700 border-amber-200 hover:bg-amber-100 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900/40"
                                        onClick={() => setShowRestockModal(true)}
                                    >
                                        <Plus className="h-3 w-3 mr-1" /> Restock Now
                                    </Button>
                                </div>
                            )}

                            <Button type="submit" className="w-full" size="lg" disabled={mutation.isPending || !canEdit || isStockInsufficient}>
                                <ShoppingCart className="h-4 w-4 mr-2" />
                                {mutation.isPending ? "Recording Sale..." : "Record Sale"}
                            </Button>
                            {!canEdit && (
                                <p className="text-xs text-destructive text-center pt-2 font-medium bg-destructive/10 p-2 rounded-lg">
                                    View Only: You cannot record sales.
                                </p>
                            )}
                        </div>
                    </form>
                </Form>
            </ResponsiveDialog>

            <AddFeedModal
                id={farmerId}
                open={showRestockModal}
                onOpenChange={setShowRestockModal}
            />
        </>
    );
};
