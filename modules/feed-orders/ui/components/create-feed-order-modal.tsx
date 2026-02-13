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
import { CalendarIcon, Check, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface CreateFeedOrderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
    initialData?: {
        id: string;
        orderDate: Date;
        deliveryDate: Date;
        items: FeedItem[];
    };
}

interface FeedItem {
    id: string; // temp id or item id
    farmerId: string;
    farmerName: string;
    location?: string | null;
    mobile?: string | null;
    feeds: { type: string; quantity: number }[];
}

export function CreateFeedOrderModal({ open, onOpenChange, orgId, initialData }: CreateFeedOrderModalProps) {
    const [orderDate, setOrderDate] = useState<Date>(new Date());
    const [deliveryDate, setDeliveryDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() + 1)));

    const [selectedItems, setSelectedItems] = useState<FeedItem[]>([]);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    // Reset/Initialize state when modal opens or initialData changes
    useEffect(() => {
        if (open) {
            if (initialData) {
                setOrderDate(new Date(initialData.orderDate));
                setDeliveryDate(new Date(initialData.deliveryDate));
                setSelectedItems(initialData.items);
            } else {
                setOrderDate(new Date());
                setDeliveryDate(new Date(new Date().setDate(new Date().getDate() + 1)));
                setSelectedItems([]);
            }
        }
    }, [open, initialData]);

    const { data: farmers, isPending: isLoadingFarmers } = useQuery({
        ...trpc.officer.farmers.listWithStock.queryOptions({
            orgId,
            page: 1,
            pageSize: 50,
            search: searchQuery
        }),
        enabled: isSearchOpen
    });

    const generateCopyText = (items: FeedItem[], oDate: Date, dDate: Date) => {
        const orderDateStr = format(oDate, "dd/MM/yyyy");
        const deliveryDateStr = format(dDate, "dd/MM/yyyy");

        let text = `Dear sir,\nFeed order date: ${orderDateStr}\nFeed delivery  date: ${deliveryDateStr}\n\n`;

        let farmCounter = 1;
        const totalByType: Record<string, number> = {};
        let grandTotal = 0;

        items.forEach(item => {
            // Filter empty feeds and 0 quantity feeds
            const activeFeeds = item.feeds.filter(f => f.type.trim() !== "" && (f.quantity || 0) > 0);
            if (activeFeeds.length === 0) return;

            text += `Farm No ${farmCounter.toString().padStart(2, '0')}\n`;
            text += `${item.farmerName}\n`;
            if (item.location) text += `Location: ${item.location}\n`;
            if (item.mobile) text += `Phone: ${item.mobile}\n`;

            activeFeeds.forEach(feed => {
                const qty = feed.quantity || 0;
                text += `${feed.type}: ${qty} Bags\n`;

                // Totals
                totalByType[feed.type] = (totalByType[feed.type] || 0) + qty;
                grandTotal += qty;
            });

            text += `\n`;
            farmCounter++;
        });

        text += `Total:\n`;
        Object.entries(totalByType).forEach(([type, qty]) => {
            text += `${type}: ${qty} Bags\n`;
        });

        text += `\nGrand Total: ${grandTotal} Bags`;

        return text;
    };

    const createMutation = useMutation(
        trpc.officer.feedOrders.create.mutationOptions({
            onSuccess: (data, variables) => {
                const text = generateCopyText(selectedItems, variables.orderDate, variables.deliveryDate);
                copyToClipboard(text);

                toast.success("Order created and copied to clipboard!");
                queryClient.invalidateQueries(trpc.officer.feedOrders.list.pathFilter());
                onOpenChange(false);
            },
            onError: (err) => {
                toast.error(`Failed to create order: ${err.message}`);
            }
        })
    );

    const updateMutation = useMutation(
        trpc.officer.feedOrders.update.mutationOptions({
            onSuccess: (data, variables) => {
                const text = generateCopyText(selectedItems, variables.orderDate, variables.deliveryDate);
                copyToClipboard(text);

                toast.success("Order updated and copied to clipboard!");
                queryClient.invalidateQueries(trpc.officer.feedOrders.list.pathFilter());
                onOpenChange(false);
            },
            onError: (err) => {
                toast.error(`Failed to update order: ${err.message}`);
            }
        })
    );

    const handleToggleFarmer = (farmer: { id: string; name: string; location?: string | null; mobile?: string | null }) => {
        // If farmer already selected, remove them
        if (selectedItems.some(i => i.farmerId === farmer.id)) {
            setSelectedItems(prev => prev.filter(i => i.farmerId !== farmer.id));
            return;
        }

        // Add farmer to selected items
        setSelectedItems(prev => [
            ...prev,
            {
                id: generateId(),
                farmerId: farmer.id,
                farmerName: farmer.name,
                location: farmer.location,
                mobile: farmer.mobile,
                feeds: [{ type: "B1", quantity: 0 }, { type: "B2", quantity: 0 }]
            }
        ]);
    };

    const handleUpdateFeed = (itemId: string, index: number, field: 'type' | 'quantity', value: string | number) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            const newFeeds = [...item.feeds];
            newFeeds[index] = { ...newFeeds[index], [field]: value };
            return { ...item, feeds: newFeeds };
        }));
    };

    const handleAddFeedRow = (itemId: string) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                feeds: [...item.feeds, { type: "", quantity: 0 }]
            };
        }));
    };

    const handleRemoveFeedRow = (itemId: string, index: number) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            const newFeeds = item.feeds.filter((_, i) => i !== index);
            return { ...item, feeds: newFeeds };
        }));
    };

    const handleRemoveFarmer = (itemId: string) => {
        setSelectedItems(prev => prev.filter(i => i.id !== itemId));
    };

    const handleSubmit = () => {
        // Include all feeds with a type (even if quantity is 0)
        const cleanItems = selectedItems.map(item => ({
            farmerId: item.farmerId,
            feeds: item.feeds.filter(f => f.type.trim() !== "")
        })).filter(item => item.feeds.length > 0);

        if (cleanItems.length === 0) {
            toast.error("Please add at least one farmer with feed types.");
            return;
        }

        if (initialData) {
            updateMutation.mutate({
                id: initialData.id,
                orderDate,
                deliveryDate,
                items: cleanItems
            });
        } else {
            createMutation.mutate({
                orgId,
                orderDate,
                deliveryDate,
                items: cleanItems
            });
        }
    };

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title={initialData ? "Edit Feed Order" : "New Feed Order"}
            description={initialData ? "Update your feed order details." : "Create a feed order list to share with dealers."}
            className="max-w-3xl h-[85vh]"
        >
            <div className="flex-1 overflow-y-auto p-2 space-y-6">
                {/* Dates */}
                <div className="flex gap-4">
                    <div className="flex flex-col gap-2 flex-1">
                        <span className="text-sm font-medium">Order Date</span>
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
                    <div className="flex flex-col gap-2 flex-1">
                        <span className="text-sm font-medium">Delivery Date</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !deliveryDate && "text-muted-foreground")}>
                                    {deliveryDate ? format(deliveryDate, "dd/MM/yyyy") : <span>Pick a date</span>}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar mode="single" selected={deliveryDate} onSelect={(d) => d && setDeliveryDate(d)} initialFocus />
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* Farmer Selection Dropdown */}
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

                {/* Selected List */}
                <div className="space-y-4">
                    {selectedItems.map((item) => (
                        <div key={item.id} className="p-4 border rounded-lg bg-card shadow-sm space-y-3">
                            <div className="flex items-center justify-between border-b pb-2">
                                <h4 className="font-semibold">{item.farmerName}</h4>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveFarmer(item.id)} tabIndex={-1}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {item.feeds.map((feed, idx) => (
                                    <div key={idx} className="flex gap-2 items-center">
                                        <Input
                                            placeholder="Type (e.g. B1)"
                                            className="w-24 h-8"
                                            value={feed.type}
                                            onChange={(e) => handleUpdateFeed(item.id, idx, 'type', e.target.value)}
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Qty"
                                            className="w-24 h-8"
                                            value={feed.quantity || ""}
                                            onChange={(e) => {
                                                const val = e.target.value === "" ? 0 : parseInt(e.target.value);
                                                handleUpdateFeed(item.id, idx, 'quantity', val || 0);
                                            }}
                                        />
                                        <span className="text-sm text-muted-foreground mr-auto">Bags</span>

                                        {idx >= 2 && (
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFeedRow(item.id, idx)} tabIndex={-1}>
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleAddFeedRow(item.id)} tabIndex={-1}>
                                    <Plus className="h-3 w-3 mr-1" /> Add Row
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex items-center justify-end gap-2 p-4 border-t bg-muted/20">
                <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending || selectedItems.length === 0}>
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : (initialData ? "Update Order" : "Create Order")}
                </Button>
            </div>
        </ResponsiveDialog>
    );
}
