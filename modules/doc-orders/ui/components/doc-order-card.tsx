"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, copyToClipboard } from "@/lib/utils";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, CheckCircle, ChevronDown, ChevronUp, Copy, MoreHorizontal, Pencil, Trash2, Truck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface DocOrderCardProps {
    order: {
        id: string;
        orderDate: Date | string;
        status: "PENDING" | "CONFIRMED";
        branchName?: string | null;
        items: {
            id: string;
            farmerId: string;
            birdType: string;
            docCount: number;
            farmer: {
                name: string;
                location: string | null;
                mobile: string | null;
            };
        }[];
    };
    onEdit?: (order: any) => void;
}

export function DocOrderCard({ order, onEdit }: DocOrderCardProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

    // State for confirmation dialog
    const [cycleDates, setCycleDates] = useState<Record<string, Date>>({});

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const deleteMutation = useMutation(
        trpc.officer.docOrders.delete.mutationOptions({
            onSuccess: () => {
                toast.success("DOC order deleted");
                queryClient.invalidateQueries(trpc.officer.docOrders.list.pathFilter());
            },
            onError: (err) => {
                toast.error(`Failed to delete: ${err.message}`);
            }
        })
    );

    const confirmMutation = useMutation(
        trpc.officer.docOrders.confirm.mutationOptions({
            onSuccess: (data) => {
                toast.success(`Confirmed! ${data.createdCycles} cycles created.`);
                queryClient.invalidateQueries(trpc.officer.docOrders.list.pathFilter());
                // Invalidate cycles & farmers too
                queryClient.invalidateQueries(trpc.officer.cycles.listActive.pathFilter());
                queryClient.invalidateQueries(trpc.officer.farmers.listWithStock.pathFilter());
            },
            onError: (err) => {
                toast.error(`Confirmation failed: ${err.message}`);
            }
        })
    );

    const generateCopyText = () => {
        const orderDateStr = format(new Date(order.orderDate), "dd MMMM yy");

        // Header
        let text = `Dear sir/ Boss, \n`;
        if (order.branchName) {
            text += `Doc order under ${order.branchName} branch\n`;
        }
        text += `Date: ${orderDateStr}\n\n`;

        let farmCounter = 1;
        const totalByType: Record<string, number> = {};
        let grandTotal = 0;

        order.items.forEach(item => {
            text += `Farm no: ${farmCounter.toString().padStart(2, '0')}\n`;
            // "Contact farm doc" - hardcoded in user example? No, usually title. 
            // User example: "Contact farm doc" then "Quantity...". 
            // Or "Farm name: ...". 
            // Let's stick to the requested format:
            /*
             Farm no: 01
             [Farmer Name]
             Location: [Location]
             Mobile: [Mobile]
             Quantity: [Qty] pcs
             [Bird Type]
            */

            text += `${item.farmer.name}\n`;
            if (item.farmer.location) text += `Location: ${item.farmer.location}\n`;
            if (item.farmer.mobile) text += `Mobile: ${item.farmer.mobile}\n`;

            text += `Quantity: ${item.docCount} pcs\n`;
            text += `Bird Type: ${item.birdType}\n\n`;

            // Totals
            totalByType[item.birdType] = (totalByType[item.birdType] || 0) + item.docCount;
            grandTotal += item.docCount;
            farmCounter++;
        });

        text += `Total:\n`;
        Object.entries(totalByType).forEach(([type, qty]) => {
            text += `${qty} pcs (${type})\n`;
        });

        // If multiple types, maybe allow grand total? User example shows breakdown.
        // If there's only one type, the breakdown effectively shows the total.

        return text;
    };

    const handleCopy = () => {
        const text = generateCopyText();
        copyToClipboard(text);
        toast.success("Order copied to clipboard!");
    };

    const totalDocs = order.items.reduce((sum, item) => sum + item.docCount, 0);
    const isConfirmed = order.status === "CONFIRMED";

    const handleConfirm = () => {
        // Date Validation
        const today = new Date();
        today.setHours(23, 59, 59, 999);

        const fortyDaysAgo = new Date();
        fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);
        fortyDaysAgo.setHours(0, 0, 0, 0);

        // Convert dates to ISO strings for mutation
        const payloadDates: Record<string, string> = {};
        for (const item of order.items) {
            const date = cycleDates[item.id] || new Date(order.orderDate);

            if (date > today) {
                toast.error(`Future date for farmer ${item.farmer.name} is not allowed`);
                return;
            }

            if (date < fortyDaysAgo) {
                toast.error(`Date for farmer ${item.farmer.name} is older than 40 days`);
                return;
            }

            payloadDates[item.id] = date.toISOString();
        }

        confirmMutation.mutate({
            id: order.id,
            cycleDates: payloadDates
        });
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <Card className={`w-full overflow-hidden border transition-all duration-300 ${isConfirmed
                ? "border-emerald-500/20 bg-emerald-500/5 shadow-lg shadow-emerald-500/5"
                : "border-border/50 bg-card/50 hover:bg-card/80 shadow-md"
                }`}>
                <CardHeader className="p-4 sm:p-5">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex gap-3">
                            <div className={`mt-1 p-2.5 rounded-xl shrink-0 transition-colors ${isConfirmed
                                ? "bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20"
                                : "bg-primary/10 text-primary"
                                }`}>
                                {isConfirmed ? <CheckCircle className="h-5 w-5" /> : <Truck className="h-5 w-5" />}
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Order Date</span>
                                    <Badge variant="secondary" className={`h-5 px-1.5 text-[10px] font-bold border-none transition-colors ${isConfirmed ? "bg-emerald-500/10 text-emerald-700" : "bg-primary/20 text-primary"
                                        }`}>
                                        {totalDocs} Birds
                                    </Badge>
                                    <Badge
                                        variant={isConfirmed ? "default" : "secondary"}
                                        className={`h-5 px-1.5 text-[10px] font-bold border-none ${isConfirmed
                                            ? "bg-emerald-600 text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-700"
                                            : "bg-orange-500/10 text-orange-600 hover:bg-orange-500/20"
                                            }`}
                                    >
                                        {isConfirmed ? "Confirmed" : "Pending"}
                                    </Badge>
                                </div>
                                <CardTitle className={`text-xl font-black tracking-tight leading-none transition-colors ${isConfirmed ? "text-emerald-950 dark:text-emerald-50" : "text-foreground"
                                    }`}>
                                    {format(new Date(order.orderDate), "dd MMM, yyyy")}
                                </CardTitle>
                                {order.branchName && (
                                    <div className="text-xs text-muted-foreground font-medium">
                                        Branch: {order.branchName}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 w-full sm:w-auto">
                            <div className={`grid ${isConfirmed ? "grid-cols-1" : "grid-cols-2"} sm:flex sm:items-center gap-2 w-full`}>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCopy}
                                    className="h-9 rounded-lg px-3 bg-primary text-primary-foreground hover:bg-primary/10 border-none shadow-sm transition-all active:scale-95 text-xs sm:text-sm font-medium w-full sm:w-auto"
                                >
                                    <Copy className="h-3.5 w-3.5 mr-2" />
                                    Copy
                                </Button>

                                {order.status === "PENDING" && (
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                className="h-9 rounded-lg px-3 bg-emerald-600 text-white hover:bg-emerald-700 border-none shadow-sm transition-all active:scale-95 text-xs sm:text-sm font-medium w-full sm:w-auto"
                                            >
                                                <CheckCircle className="h-3.5 w-3.5 mr-2" />
                                                Confirm
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-2xl border-none shadow-2xl max-w-2xl">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-bold">Confirm Cycles</AlertDialogTitle>
                                                <AlertDialogDescription asChild>
                                                    <div className="text-sm space-y-4">
                                                        <div className="text-muted-foreground">
                                                            This will create {order.items.length} new cycle(s). Please verify the start date for each cycle.
                                                        </div>

                                                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                                            {order.items.map((item, idx) => (
                                                                <div key={item.id} className="p-3 rounded-xl bg-muted/50 border border-muted-foreground/10 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                                                                    <div>
                                                                        <div className="font-bold">{item.farmer.name}</div>
                                                                        <div className="text-xs text-muted-foreground">
                                                                            {item.docCount} {item.birdType}
                                                                        </div>
                                                                    </div>

                                                                    <div className="flex flex-col gap-1">
                                                                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Cycle Start Date</span>
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button
                                                                                    variant={"outline"}
                                                                                    size="sm"
                                                                                    className={cn(
                                                                                        "w-[180px] justify-start text-left font-normal bg-background",
                                                                                        !cycleDates[item.id] && !order.orderDate && "text-muted-foreground"
                                                                                    )}
                                                                                >
                                                                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                                                                    {cycleDates[item.id] ? format(cycleDates[item.id], "PPP") : format(new Date(order.orderDate), "PPP")}
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-auto p-0" align="end">
                                                                                <Calendar
                                                                                    mode="single"
                                                                                    selected={cycleDates[item.id] || new Date(order.orderDate)}
                                                                                    onSelect={(date) => {
                                                                                        if (date) {
                                                                                            setCycleDates(prev => ({ ...prev, [item.id]: date }));
                                                                                        }
                                                                                    }}
                                                                                    initialFocus
                                                                                />
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="gap-2">
                                                <AlertDialogCancel className="rounded-xl border-muted">Cancel</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={handleConfirm}
                                                    className="bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl px-6"
                                                >
                                                    {confirmMutation.isPending ? "Confirming..." : "Confirm & Create Cycles"}
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                )}

                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-lg hover:bg-muted font-bold hidden sm:flex">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32 rounded-xl p-1 border-muted">
                                        {order.status === "PENDING" && (
                                            <>
                                                <DropdownMenuItem
                                                    onClick={() => onEdit?.(order)}
                                                    className="rounded-lg gap-2 cursor-pointer font-medium text-xs py-2"
                                                >
                                                    <Pencil className="h-3.5 w-3.5 text-blue-500" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-muted opacity-50" />
                                            </>
                                        )}
                                        <DropdownMenuItem
                                            onSelect={() => setIsDeleteDialogOpen(true)}
                                            className="rounded-lg gap-2 cursor-pointer font-medium text-xs py-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Mobile Menu Trigger */}
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-9 rounded-lg hover:bg-muted font-bold sm:hidden flex items-center justify-center gap-2 border border-input col-span-2">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-[90vw] rounded-xl p-1 border-muted">
                                        {order.status === "PENDING" && (
                                            <>
                                                <DropdownMenuItem
                                                    onClick={() => onEdit?.(order)}
                                                    className="rounded-lg gap-2 cursor-pointer font-medium text-xs py-3"
                                                >
                                                    <Pencil className="h-3.5 w-3.5 text-blue-500" />
                                                    Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator className="bg-muted opacity-50" />
                                            </>
                                        )}
                                        <DropdownMenuItem
                                            onSelect={() => setIsDeleteDialogOpen(true)}
                                            className="rounded-lg gap-2 cursor-pointer font-medium text-xs py-3 text-destructive focus:text-destructive focus:bg-destructive/10"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                    <AlertDialogContent className="rounded-2xl border-none shadow-2xl">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-xl font-bold">Delete DOC Order?</AlertDialogTitle>
                                            <AlertDialogDescription className="text-sm">
                                                This will permanently delete this order. This action cannot be undone.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter className="gap-2">
                                            <AlertDialogCancel className="rounded-xl border-muted">Cancel</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={() => deleteMutation.mutate({ id: order.id })}
                                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl px-6"
                                            >
                                                {deleteMutation.isPending ? "Deleting..." : "Delete"}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                            <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:text-primary transition-colors group mt-1">
                                    {isOpen ? "Hide Draft" : "View Draft"}
                                    {isOpen ? <ChevronUp className="h-3 w-3 ml-1.5 opacity-50 group-hover:opacity-100" /> : <ChevronDown className="h-3 w-3 ml-1.5 opacity-50 group-hover:opacity-100" />}
                                </Button>
                            </CollapsibleTrigger>
                        </div>
                    </div>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent className="px-4 pb-4 pt-0">
                        <div className="p-4 bg-muted/40 rounded-xl text-xs font-mono whitespace-pre-wrap border border-dashed border-muted-foreground/20 leading-relaxed text-muted-foreground/90">
                            {generateCopyText()}
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
}
