"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Check, Plus, Search, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CreateFeedOrderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
}

interface FeedItem {
    id: string; // temp id
    farmerId: string;
    farmerName: string;
    feeds: { type: string; quantity: number }[];
}

export function CreateFeedOrderModal({ open, onOpenChange, orgId }: CreateFeedOrderModalProps) {
    const [orderDate, setOrderDate] = useState<Date>(new Date());
    const [deliveryDate, setDeliveryDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() + 1)));

    const [selectedItems, setSelectedItems] = useState<FeedItem[]>([]);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const { data: farmers } = useQuery({
        ...trpc.officer.farmers.listWithStock.queryOptions({
            orgId,
            page: 1,
            pageSize: 50,
            search: searchQuery
        }),
        enabled: isSearchOpen
    });

    const createMutation = useMutation(
        trpc.officer.feedOrders.create.mutationOptions({
            onSuccess: () => {
                toast.success("Feed order created successfully!");
                queryClient.invalidateQueries(trpc.officer.feedOrders.list.pathFilter());
                onOpenChange(false);
                // Reset
                setSelectedItems([]);
                setOrderDate(new Date());
            },
            onError: (err) => {
                toast.error(`Failed to create order: ${err.message}`);
            }
        })
    );

    const handleAddFarmer = (farmer: { id: string; name: string }) => {
        if (selectedItems.some(i => i.farmerId === farmer.id)) {
            toast.warning("Farmer already added");
            return;
        }

        setSelectedItems(prev => [
            {
                id: crypto.randomUUID(),
                farmerId: farmer.id,
                farmerName: farmer.name,
                feeds: [{ type: "B1", quantity: 0 }, { type: "B2", quantity: 0 }] // Default as per user request
            },
            ...prev
        ]);
        setIsSearchOpen(false);
        setSearchQuery("");
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
        // Filter out empty feeds
        const cleanItems = selectedItems.map(item => ({
            farmerId: item.farmerId,
            feeds: item.feeds.filter(f => f.type && f.quantity > 0)
        })).filter(item => item.feeds.length > 0);

        if (cleanItems.length === 0) {
            toast.error("Please add at least one farmer with feed quantities.");
            return;
        }

        createMutation.mutate({
            orgId,
            orderDate,
            deliveryDate,
            items: cleanItems
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl h-[85vh] flex flex-col p-0 gap-0">
                <DialogHeader className="p-6 pb-2 border-b">
                    <DialogTitle>New Feed Order</DialogTitle>
                    <DialogDescription>Create a feed order list to share with dealers.</DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Dates */}
                    <div className="flex gap-4">
                        <div className="flex flex-col gap-2 flex-1">
                            <span className="text-sm font-medium">Order Date</span>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant={"outline"} className={cn("pl-3 text-left font-normal", !orderDate && "text-muted-foreground")}>
                                        {orderDate ? format(orderDate, "PPP") : <span>Pick a date</span>}
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
                                        {deliveryDate ? format(deliveryDate, "PPP") : <span>Pick a date</span>}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar mode="single" selected={deliveryDate} onSelect={(d) => d && setDeliveryDate(d)} initialFocus />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>

                    {/* Farmer Search */}
                    <div className="flex flex-col gap-2 relative">
                        <span className="text-sm font-medium">Add Farmer</span>
                        <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={isSearchOpen}
                                    className="justify-between"
                                >
                                    <span className="flex items-center gap-2 text-muted-foreground">
                                        <Search className="h-4 w-4" />
                                        Search farmers...
                                    </span>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[400px] p-0" align="start">
                                <Command shouldFilter={false}>
                                    <CommandInput placeholder="Search name..." value={searchQuery} onValueChange={setSearchQuery} />
                                    <CommandList>
                                        <CommandEmpty>No farmers found.</CommandEmpty>
                                        <CommandGroup>
                                            {farmers?.items.map((farmer) => (
                                                <CommandItem
                                                    key={farmer.id}
                                                    value={farmer.name}
                                                    onSelect={() => handleAddFarmer(farmer)}
                                                >
                                                    <Check className={cn("mr-2 h-4 w-4", selectedItems.some(i => i.farmerId === farmer.id) ? "opacity-100" : "opacity-0")} />
                                                    {farmer.name}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                    </div>

                    {/* Selected List */}
                    <div className="space-y-4">
                        {selectedItems.map((item) => (
                            <div key={item.id} className="p-4 border rounded-lg bg-card shadow-sm space-y-3">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <h4 className="font-semibold">{item.farmerName}</h4>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveFarmer(item.id)}>
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
                                                onChange={(e) => handleUpdateFeed(item.id, idx, 'quantity', parseInt(e.target.value) || 0)}
                                            />
                                            <span className="text-sm text-muted-foreground mr-auto">Bags</span>

                                            {idx >= 2 && (
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFeedRow(item.id, idx)}>
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => handleAddFeedRow(item.id)}>
                                        <Plus className="h-3 w-3 mr-1" /> Add Row
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <DialogFooter className="p-4 border-t bg-muted/20">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={createMutation.isPending || selectedItems.length === 0}>
                        {createMutation.isPending ? "Creating..." : "Create Order"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
