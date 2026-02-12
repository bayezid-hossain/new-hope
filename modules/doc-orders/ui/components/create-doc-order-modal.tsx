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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn, copyToClipboard, generateId } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Check, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface DocBatch {
    id: string; // for key
    birdType: string;
    docCount: number;
}

interface DocItem {
    id: string; // unique ID for UI
    farmerId: string;
    farmerName: string;
    location?: string | null;
    mobile?: string | null;
    batches: DocBatch[];
}

interface CreateDocOrderModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
    initialData?: {
        id: string;
        orderDate: Date | string;
        branchName?: string | null;
        items: Array<{
            id: string;
            farmerId: string;
            docCount: number;
            birdType: string;
            farmer: {
                id: string;
                name: string;
                location: string | null;
                mobile: string | null;
            };
        }>;
    };
}

export function CreateDocOrderModal({ open, onOpenChange, orgId, initialData }: CreateDocOrderModalProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    // Form State
    const [orderDate, setOrderDate] = useState<Date>(new Date());
    const [branchName, setBranchName] = useState("");
    const [selectedItems, setSelectedItems] = useState<DocItem[]>([]);

    // Search State
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);

    // Bird Type Creation State
    const [newItemBirdType, setNewItemBirdType] = useState("");
    const [isCreatingBirdType, setIsCreatingBirdType] = useState(false);
    const [pendingBirdTypePath, setPendingBirdTypePath] = useState<{ itemId: string; batchIndex: number } | null>(null);

    // Farmers Query
    const { data: farmers, isLoading: isLoadingFarmers } = useQuery({
        ...trpc.officer.farmers.listWithStock.queryOptions({
            orgId,
            page: 1,
            pageSize: 50,
            search: searchQuery
        }),
        enabled: isSearchOpen
    });

    // Bird Types Query
    const { data: birdTypes, isLoading: isLoadingBirdTypes } = useQuery(
        trpc.officer.docOrders.getBirdTypes.queryOptions()
    );

    // Reset/Initialize state when modal opens or initialData changes
    useEffect(() => {
        if (open) {
            if (initialData) {
                setOrderDate(new Date(initialData.orderDate));
                setBranchName(initialData.branchName || "");

                // Group by farmer
                const grouped = initialData.items.reduce((acc, item) => {
                    const existing = acc.find(i => i.farmerId === item.farmerId);
                    if (existing) {
                        existing.batches.push({
                            id: item.id || generateId(),
                            birdType: item.birdType,
                            docCount: item.docCount,
                        });
                    } else {
                        acc.push({
                            id: generateId(),
                            farmerId: item.farmerId,
                            farmerName: item.farmer.name,
                            location: item.farmer.location,
                            mobile: item.farmer.mobile,
                            batches: [{
                                id: item.id || generateId(),
                                birdType: item.birdType,
                                docCount: item.docCount,
                            }]
                        });
                    }
                    return acc;
                }, [] as DocItem[]);

                setSelectedItems(grouped);
            } else {
                setOrderDate(new Date());
                setBranchName("");
                setSelectedItems([]);
            }
        }
    }, [open, initialData]);

    const createMutation = useMutation(
        trpc.officer.docOrders.create.mutationOptions({
            onSuccess: (data) => {
                toast.success("DOC Order created!");
                queryClient.invalidateQueries(trpc.officer.docOrders.list.pathFilter());
                onOpenChange(false);
                const text = generateCopyText(selectedItems, orderDate, branchName);
                copyToClipboard(text);
                toast.success("Order details copied to clipboard");
            },
            onError: (err) => toast.error(`Failed to create: ${err.message}`)
        })
    );

    const updateMutation = useMutation(
        trpc.officer.docOrders.update.mutationOptions({
            onSuccess: () => {
                toast.success("DOC Order updated!");
                queryClient.invalidateQueries(trpc.officer.docOrders.list.pathFilter());
                onOpenChange(false);
                const text = generateCopyText(selectedItems, orderDate, branchName);
                copyToClipboard(text);
                toast.success("Order details copied to clipboard");
            },
            onError: (err) => toast.error(`Failed to update: ${err.message}`)
        })
    );

    const createBirdTypeMutation = useMutation(
        trpc.officer.docOrders.createBirdType.mutationOptions({
            onSuccess: (newType) => {
                toast.success("Bird type created");
                queryClient.invalidateQueries(trpc.officer.docOrders.getBirdTypes.pathFilter());

                // Auto-select for the item that opened the modal
                if (pendingBirdTypePath) {
                    handleUpdateBatch(pendingBirdTypePath.itemId, pendingBirdTypePath.batchIndex, 'birdType', newType.name);
                }

                setIsCreatingBirdType(false);
                setNewItemBirdType("");
                setPendingBirdTypePath(null);
            },
            onError: (err) => toast.error(`Failed to create bird type: ${err.message}`)
        })
    );

    const handleToggleFarmer = (farmer: {
        id: string;
        name: string;
        location?: string | null;
        mobile?: string | null;
    }) => {
        const exists = selectedItems.find(i => i.farmerId === farmer.id);
        const defaultBirdType = birdTypes?.[birdTypes.length - 1]?.name || "Ross A";

        if (exists) {
            // Remove entirely if toggled off
            setSelectedItems(prev => prev.filter(i => i.farmerId !== farmer.id));
        } else {
            // Add new farmer with one default batch
            setSelectedItems(prev => [
                ...prev,
                {
                    id: generateId(),
                    farmerId: farmer.id,
                    farmerName: farmer.name,
                    location: farmer.location,
                    mobile: farmer.mobile,
                    batches: [{
                        id: generateId(),
                        birdType: defaultBirdType,
                        docCount: 0,
                    }]
                }
            ]);
        }
    };

    const handleUpdateBatch = (itemId: string, batchIndex: number, field: keyof DocBatch, value: any) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            const newBatches = [...item.batches];
            newBatches[batchIndex] = { ...newBatches[batchIndex], [field]: value };
            return { ...item, batches: newBatches };
        }));
    };

    const handleAddBatch = (itemId: string) => {
        const defaultBirdType = birdTypes?.[birdTypes.length - 1]?.name || "Ross A";
        setSelectedItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            return {
                ...item,
                batches: [...item.batches, {
                    id: generateId(),
                    birdType: defaultBirdType,
                    docCount: 0,
                }]
            };
        }));
    };

    const handleRemoveBatch = (itemId: string, batchIndex: number) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.id !== itemId) return item;
            const newBatches = item.batches.filter((_, i) => i !== batchIndex);

            // If removing last batch, remove item entirely? 
            // Feed Order keeps empty items? No, "filter(item => item.feeds.length > 0)" in submit
            // But let's allow removing all batches and then remove item or keep it empty. 
            // Feed Order: "Include all feeds with a type (even if quantity is 0)"
            // But Feed Order UI allows removing rows.
            // If batches become empty, maybe remove item? Let's keep it simple.

            return { ...item, batches: newBatches };
        }));
    };

    const handleRemoveItem = (itemId: string) => {
        setSelectedItems(prev => prev.filter(i => i.id !== itemId));
    };

    const handleSubmit = () => {
        const payloadItems: Array<{
            farmerId: string;
            birdType: string;
            docCount: number;
        }> = [];

        selectedItems.forEach(item => {
            item.batches.forEach(batch => {
                // Filter out invalid batches? 
                // Original: birdType required, docCount > 0 (via Zod).
                // Let's validate here manually.
                if (!batch.birdType || batch.docCount <= 0) return;

                payloadItems.push({
                    farmerId: item.farmerId,
                    birdType: batch.birdType,
                    docCount: batch.docCount
                });
            });
        });

        if (payloadItems.length === 0) {
            toast.error("Please add at least one valid item (quantity > 0)");
            return;
        }

        if (initialData) {
            updateMutation.mutate({
                id: initialData.id,
                orderDate,
                branchName: branchName || undefined,
                items: payloadItems
            });
        } else {
            createMutation.mutate({
                orgId,
                orderDate,
                branchName: branchName || undefined,
                items: payloadItems
            });
        }
    };

    const generateCopyText = (items: DocItem[], date: Date, branch: string) => {
        const orderDateStr = format(date, "dd MMMM yy");
        let text = `Dear sir/ Boss, \n`;
        if (branch && branch.trim() !== "") {
            text += `Doc order under ${branch} branch\n `;
        }
        text += `Date: ${orderDateStr}\n\n`;

        let farmCounter = 1;
        const totalByType: Record<string, number> = {};
        let grandTotal = 0;

        items.forEach(item => {
            item.batches.forEach(batch => {
                if (!batch.birdType || batch.docCount <= 0) return;

                text += `Farm no: ${farmCounter.toString().padStart(2, '0')}\n`;
                text += `${item.farmerName || 'Unknown Farmer'}\n`;
                if (item.location) text += `Location: ${item.location}\n`;
                if (item.mobile) text += `Mobile: ${item.mobile}\n`;

                text += `Quantity: ${batch.docCount || 0} pcs\n`;
                text += `${batch.birdType || 'Unknown Type'}\n\n`;

                totalByType[batch.birdType] = (totalByType[batch.birdType] || 0) + (batch.docCount || 0);
                grandTotal += (batch.docCount || 0);
                farmCounter++;
            });
        });

        text += `Total:\n`;
        Object.entries(totalByType).forEach(([type, qty]) => {
            text += `${qty} pcs (${type})\n`;
        });

        return text;
    };

    return (
        <ResponsiveDialog
            open={open}
            onOpenChange={onOpenChange}
            title={initialData ? "Edit DOC Order" : "New DOC Order"}
            description="Create a new order for Day Old Chicks. Select farmers and specify quantities."
            className="max-w-3xl h-[85vh]"
        >
            <div className="flex-1 overflow-y-auto p-2 space-y-6">
                {/* Header Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Order Date</span>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !orderDate && "text-muted-foreground"
                                    )}
                                >
                                    {orderDate ? (
                                        format(orderDate, "P")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={orderDate}
                                    onSelect={(d) => d && setOrderDate(d)}
                                    disabled={(date) =>
                                        date > new Date("2100-01-01")
                                    }
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Branch Name (Optional)</span>
                        <Input
                            placeholder="e.g. Netrokona Branch"
                            value={branchName}
                            onChange={(e) => setBranchName(e.target.value)}
                        />
                    </div>
                </div>

                {/* Farmer Search */}
                <div className="flex flex-col gap-2 relative">
                    <span className="text-sm font-medium">Select Farmers</span>
                    <Popover open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={isSearchOpen}
                                className="w-full justify-between"
                            >
                                <span className="flex items-center gap-2">
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                    {selectedItems.length > 0
                                        ? `${selectedItems.length} farmer${selectedItems.length > 1 ? 's' : ''} selected`
                                        : "Search and add farmers..."}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search farmers..." value={searchQuery} onValueChange={setSearchQuery} />
                                <CommandList>
                                    <div className="max-h-[200px] overflow-y-auto">
                                        {isLoadingFarmers && (
                                            <div className="p-4 text-sm text-center text-muted-foreground flex items-center justify-center gap-2">
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Loading...
                                            </div>
                                        )}
                                        <CommandGroup>
                                            {farmers?.items?.map((farmer) => {
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
                                    </div>
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

                {/* Selected Items List */}
                <div className="space-y-4">
                    {selectedItems.map((item) => (
                        <div key={item.id} className="p-4 border rounded-xl bg-card space-y-4 relative group">
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleRemoveItem(item.id)}
                            >
                                <X className="h-4 w-4" />
                            </Button>

                            <div className="flex flex-col gap-1 pr-6">
                                <span className="font-semibold">{item.farmerName}</span>
                                <span className="text-xs text-muted-foreground">
                                    {item.location && `${item.location} • `}
                                    {item.mobile}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {item.batches.map((batch, batchIndex) => (
                                    <div key={batch.id} className="flex flex-col sm:flex-row gap-3 items-end p-2 rounded-lg bg-muted/30">
                                        <div className="flex-1 w-full sm:w-auto">
                                            <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1 block">Bird Type</span>
                                            <Select
                                                value={batch.birdType}
                                                onValueChange={(val) => {
                                                    if (val === "create_new") {
                                                        setPendingBirdTypePath({ itemId: item.id, batchIndex });
                                                        setIsCreatingBirdType(true);
                                                    } else {
                                                        handleUpdateBatch(item.id, batchIndex, 'birdType', val);
                                                    }
                                                }}
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue placeholder="Select type" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {birdTypes?.map((bt) => (
                                                        <SelectItem key={bt.id} value={bt.name} className="text-xs">
                                                            {bt.name}
                                                        </SelectItem>
                                                    ))}
                                                    <SelectItem value="create_new" className="font-medium text-primary text-xs">
                                                        + Create New Type
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="w-full sm:w-32">
                                            <span className="text-[10px] uppercase text-muted-foreground font-semibold mb-1 block">Qty (pcs)</span>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                className="h-8 text-xs"
                                                value={batch.docCount || ""}
                                                onChange={(e) => handleUpdateBatch(item.id, batchIndex, 'docCount', parseInt(e.target.value) || 0)}
                                            />
                                        </div>

                                        {item.batches.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                                                onClick={() => handleRemoveBatch(item.id, batchIndex)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs w-full sm:w-auto"
                                    onClick={() => handleAddBatch(item.id)}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> Add Another Batch
                                </Button>
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
                <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {initialData ? "Save Changes" : "Create Order"}
                </Button>
            </div>

            {/* Create Bird Type Dialog */}
            <Dialog open={isCreatingBirdType} onOpenChange={setIsCreatingBirdType}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Add Bird Type</DialogTitle>
                        <DialogDescription>
                            Create a new bird type/strain (e.g., "Ross 308", "Cobb 500").
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <span className="text-right text-sm font-medium">
                                Name
                            </span>
                            <Input
                                id="name"
                                value={newItemBirdType}
                                onChange={(e) => setNewItemBirdType(e.target.value)}
                                className="col-span-3"
                                placeholder="e.g. Cobb 500"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => {
                            setIsCreatingBirdType(false);
                            setPendingBirdTypePath(null);
                        }}>Cancel</Button>
                        <Button
                            type="button"
                            disabled={!newItemBirdType || createBirdTypeMutation.isPending}
                            onClick={() => createBirdTypeMutation.mutate({ name: newItemBirdType })}
                        >
                            {createBirdTypeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Create Type
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </ResponsiveDialog>
    );
}
