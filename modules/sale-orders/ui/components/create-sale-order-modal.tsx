"use client";

import ResponsiveDialog from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn, copyToClipboard, generateId } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Check, Loader2, Search, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SaleItem {
    id: string;
    farmerId: string;
    farmerName: string;
    location?: string | null;
    mobile?: string | null;
    totalWeight: number;
    totalDoc: number;
    avgWeight: string;
    age: number;
}

interface CreateSaleOrderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
}

export function CreateSaleOrderModal({ open, onOpenChange, orgId }: CreateSaleOrderModalProps) {
    const [orderDate, setOrderDate] = useState<Date>(new Date());
    const [branchName, setBranchName] = useState("");
    const [selectedItems, setSelectedItems] = useState<SaleItem[]>([]);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const { data: farmers, isPending: isLoadingFarmers } = useQuery({
        ...trpc.officer.farmers.listWithStock.queryOptions({
            orgId,
            page: 1,
            pageSize: 50,
            search: searchQuery
        }),
        enabled: isSearchOpen
    });

    const createMutation = useMutation(
        trpc.officer.saleOrders.create.mutationOptions({
            onSuccess: () => {
                const text = generateCopyText();
                copyToClipboard(text);
                toast.success("Sale order saved and copied to clipboard!");
                queryClient.invalidateQueries(trpc.officer.saleOrders.list.pathFilter());
                onOpenChange(false);
            },
            onError: (err) => {
                toast.error(`Failed to save: ${err.message}`);
            }
        })
    );

    const handleToggleFarmer = (farmer: { id: string; name: string; location?: string | null; mobile?: string | null }) => {
        if (selectedItems.some(i => i.farmerId === farmer.id)) {
            setSelectedItems(prev => prev.filter(i => i.farmerId !== farmer.id));
            return;
        }

        setSelectedItems(prev => [
            ...prev,
            {
                id: generateId(),
                farmerId: farmer.id,
                farmerName: farmer.name,
                location: farmer.location,
                mobile: farmer.mobile,
                totalWeight: 0,
                totalDoc: 0,
                avgWeight: "",
                age: 0,
            }
        ]);
    };

    const handleUpdateItem = (itemId: string, field: keyof SaleItem, value: string | number) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;

            const updated = { ...item, [field]: value };

            const doc = Number(updated.totalDoc) || 0;
            const weight = Number(updated.totalWeight) || 0;
            const avg = Number(updated.avgWeight) || 0;

            if (field === 'avgWeight') {
                if (doc > 0 && String(value) !== '') {
                    updated.totalWeight = Number((Number(value) * doc).toFixed(2));
                }
            } else if (field === 'totalWeight') {
                if (doc > 0 && Number(value) > 0) {
                    updated.avgWeight = (Number(value) / doc).toFixed(3).replace(/\.?0+$/, '');
                }
            } else if (field === 'totalDoc') {
                if (Number(value) > 0) {
                    if (String(updated.avgWeight) !== '' && avg > 0) {
                        updated.totalWeight = Number((avg * Number(value)).toFixed(2));
                    } else if (weight > 0) {
                        updated.avgWeight = (weight / Number(value)).toFixed(3).replace(/\.?0+$/, '');
                    }
                }
            }

            return updated;
        }));
    };

    const handleRemoveItem = (itemId: string) => {
        setSelectedItems(prev => prev.filter(i => i.id !== itemId));
    };

    const generateCopyText = () => {
        const dateStr = format(orderDate, "dd.MM.yy");
        let text = `Date:  ${dateStr}\n`;
        text += `Broiler Sale Plan for ${branchName || "___"} Branch\n\n`;

        let farmCounter = 1;
        let grandTotalWeight = 0;
        let grandTotalDoc = 0;

        selectedItems.forEach(item => {
            if (item.totalDoc <= 0 && item.totalWeight <= 0) return;

            text += `${farmCounter}. ${item.farmerName} \n`;
            if (item.location) text += `Location: ${item.location} \n`;
            text += `Total: ${item.totalWeight} kg.\n`;
            text += `Total: ${item.totalDoc} PCs \n`;
            if (item.avgWeight) text += `Avg: ${item.avgWeight}kg \n`;
            if (item.age > 0) text += `Age: ${item.age} days\n`;
            if (item.mobile) {
                // Format mobile: if starts with 0, prefix +880 and remove leading 0
                let formattedMobile = item.mobile;
                if (formattedMobile.startsWith("0")) {
                    formattedMobile = "+880 " + formattedMobile.substring(1);
                }
                text += `Mobile:  ${formattedMobile}\n`;
            }
            text += `\n`;

            grandTotalWeight += item.totalWeight;
            grandTotalDoc += item.totalDoc;
            farmCounter++;
        });

        text += `\nTotal: ${grandTotalWeight} kg  \n`;
        text += `Total Kg : ${grandTotalDoc} PCs \n`;
        text += `\nThanks`;

        return text;
    };

    const handleSubmit = () => {
        const validItems = selectedItems.filter(i => i.totalDoc > 0 || i.totalWeight > 0);
        if (validItems.length === 0) {
            toast.error("Please add at least one farmer with weight or DOC.");
            return;
        }

        createMutation.mutate({
            orgId,
            orderDate,
            branchName: branchName || undefined,
            items: validItems.map(item => ({
                farmerId: item.farmerId,
                totalWeight: item.totalWeight,
                totalDoc: item.totalDoc,
                avgWeight: item.avgWeight || undefined,
                age: item.age,
            }))
        });
    };

    return (
        <ResponsiveDialog
            open={open}
            persistent={true}
            onOpenChange={onOpenChange}
            title="New Sale Order"
            description="Create a broiler sale plan to share with dealers."
            className="max-w-3xl h-[85vh]"
        >
            <div className="flex-1 overflow-y-auto p-2 space-y-6">
                {/* Header Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Sale Date</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !orderDate && "text-muted-foreground")}>
                                    {orderDate ? format(orderDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={orderDate} onSelect={(d) => d && setOrderDate(d)} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Branch Name</span>
                        <Input
                            placeholder="e.g. Tangail"
                            value={branchName}
                            onChange={(e) => setBranchName(e.target.value)}
                        />
                    </div>
                </div>

                {/* Farmer Selection */}
                <div className="flex flex-col gap-2 relative">
                    <span className="text-sm font-medium">Select Farmers</span>
                    <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isSearchOpen}
                                className="justify-between"
                            >
                                <span className="flex items-center gap-2">
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                    {selectedItems.length > 0
                                        ? `${selectedItems.length} farmer${selectedItems.length > 1 ? 's' : ''} selected`
                                        : "Search and select farmers..."}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            className="w-[--radix-popover-trigger-width] p-0"
                            onOpenAutoFocus={(e) => e.preventDefault()}
                        >
                            <Command>
                                <CommandInput placeholder="Search name..." value={searchQuery} onValueChange={setSearchQuery} />
                                <CommandList>
                                    {isLoadingFarmers && (
                                        <div className="p-4 text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading farmers...
                                        </div>
                                    )}
                                    <CommandGroup>
                                        {farmers?.items.map((farmer) => {
                                            const isSelected = selectedItems.some(i => i.farmerId === farmer.id);
                                            return (
                                                <CommandItem
                                                    key={farmer.id}
                                                    value={farmer.name}
                                                    onSelect={() => handleToggleFarmer(farmer)}
                                                    className="cursor-pointer"
                                                >
                                                    <div className={cn(
                                                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                                                        isSelected ? "bg-primary text-primary-foreground" : "opacity-50"
                                                    )}>
                                                        {isSelected && <Check className="h-3 w-3" />}
                                                    </div>
                                                    {farmer.name}
                                                </CommandItem>
                                            );
                                        })}
                                    </CommandGroup>
                                </CommandList>
                            </Command>
                            <div className="p-2 border-t mt-auto">
                                <Button className="w-full" size="sm" onClick={() => setIsSearchOpen(false)}>
                                    Done
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Selected Items */}
                <div className="space-y-4">
                    {selectedItems.map((item) => (
                        <div key={item.id} className="p-4 border rounded-xl bg-card space-y-3 relative group">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveItem(item.id)}
                            >
                                <X className="h-4 w-4" />
                            </Button>

                            <div className="flex flex-col gap-0.5 pr-8">
                                <span className="font-semibold">{item.farmerName}</span>
                                <span className="text-xs text-muted-foreground">
                                    {item.location && `${item.location}`}
                                    {item.location && item.mobile && " • "}
                                    {item.mobile}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1 block">Total Weight (kg)</span>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        className="h-8 text-xs"
                                        value={item.totalWeight || ""}
                                        onChange={(e) => handleUpdateItem(item.id, 'totalWeight', parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1 block">Total DOC (PCs)</span>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        className="h-8 text-xs"
                                        value={item.totalDoc || ""}
                                        onChange={(e) => handleUpdateItem(item.id, 'totalDoc', parseInt(e.target.value) || 0)}
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1 block">Avg Weight (kg)</span>
                                    <Input
                                        type="text"
                                        placeholder="e.g. 1.70-1.80"
                                        className="h-8 text-xs"
                                        value={item.avgWeight}
                                        onChange={(e) => handleUpdateItem(item.id, 'avgWeight', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1 block">Age (days)</span>
                                    <Input
                                        type="number"
                                        placeholder="0"
                                        className="h-8 text-xs"
                                        value={item.age || ""}
                                        onChange={(e) => handleUpdateItem(item.id, 'age', parseInt(e.target.value) || 0)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}
                    {selectedItems.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-xl">
                            No farmers selected. Search to add farmers.
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t bg-muted/20">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={selectedItems.length === 0 || createMutation.isPending}>
                    {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save & Copy
                </Button>
            </div>
        </ResponsiveDialog>
    );
}
