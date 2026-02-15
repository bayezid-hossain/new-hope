"use client";

import { Button } from "@/components/ui/button";
import {
    FormControl,
    FormField,
    FormItem,
    FormLabel
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { CalendarIcon, MapPin, Phone, Plus, X } from "lucide-react";
import { Control, UseFieldArrayReturn } from "react-hook-form";

// --- Farmer Info Header ---

interface FarmerInfoHeaderProps {
    farmerName: string;
    farmerLocation?: string | null;
    farmerMobile?: string | null;
    cycleAge: number;
    colorScheme?: "blue" | "orange";
}

export const FarmerInfoHeader = ({
    farmerName,
    farmerLocation,
    farmerMobile,
    cycleAge,
    colorScheme = "blue",
}: FarmerInfoHeaderProps) => {
    const colors = colorScheme === "blue"
        ? {
            bg: "from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20",
            border: "border-blue-100 dark:border-blue-800",
            name: "text-blue-900 dark:text-blue-100",
        }
        : {
            bg: "from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20",
            border: "border-orange-100 dark:border-orange-800",
            name: "text-orange-900 dark:text-orange-100",
        };

    return (
        <div className={`p-4 bg-gradient-to-r ${colors.bg} rounded-lg border ${colors.border}`}>
            <div className="text-center space-y-1">
                <div className={`text-lg font-bold ${colors.name}`}>{farmerName}</div>
                <div className="flex flex-col items-center justify-center gap-1 text-sm text-muted-foreground mt-1">
                    {farmerLocation && (
                        <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {farmerLocation}
                        </span>
                    )}
                    {farmerMobile && (
                        <span className="flex items-center gap-1 text-xs">
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
    );
};


// --- Feed Field Array ---

interface FeedFieldArrayProps {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: Control<any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fieldArray: UseFieldArrayReturn<any, any, any>;
    namePrefix: "feedConsumed" | "feedStock";
    label: string;
    description?: string;
    onBagsChange?: (index: number, bags: number) => void;
    showRemoveOnSingle?: boolean;
}

export const FeedFieldArray = ({
    control,
    fieldArray,
    namePrefix,
    label,
    description,
    onBagsChange,
    showRemoveOnSingle = false,
}: FeedFieldArrayProps) => {
    const canRemove = showRemoveOnSingle || fieldArray.fields.length > 1;

    return (
        <div className="space-y-2">
            <FormLabel>{label}</FormLabel>
            {description && (
                <div className="text-xs text-muted-foreground mb-2">{description}</div>
            )}
            {fieldArray.fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-end">
                    <FormField
                        control={control}
                        name={`${namePrefix}.${index}.type` as const}
                        render={({ field }) => (
                            <FormItem className="flex-1">
                                <FormControl>
                                    <Input placeholder="Type (B1, B2...)" {...field} />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={control}
                        name={`${namePrefix}.${index}.bags` as const}
                        render={({ field }) => (
                            <FormItem className="w-24">
                                <FormControl>
                                    <Input
                                        type="number"
                                        placeholder="Bags"
                                        value={field.value || ""}
                                        onChange={(e) => {
                                            const val = e.target.value === "" ? 0 : e.target.valueAsNumber;
                                            const bags = val || 0;
                                            field.onChange(bags);
                                            onBagsChange?.(index, bags);
                                        }}
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
                    {canRemove && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 text-destructive hover:text-destructive"
                            onClick={() => fieldArray.remove(index)}
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
                onClick={() => fieldArray.append({ type: "", bags: 0 })}
                className="w-full"
            >
                <Plus className="h-4 w-4 mr-2" /> Add {namePrefix === "feedConsumed" ? "Feed Type" : "Stock Type"}
            </Button>
        </div>
    );
};


// --- Sale Metrics Bar ---

interface SaleMetricsBarProps {
    avgWeight: string;
    totalAmount: string;
}

export const SaleMetricsBar = ({ avgWeight, totalAmount }: SaleMetricsBarProps) => (
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
);
