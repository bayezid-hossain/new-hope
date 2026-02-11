"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Check, CheckCircle2, Loader2, Plus, Search, Sparkles, Trash2, User } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface BulkCycleImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
}

const MOBILE_REGEX = /^(?:\+?88)?01[3-9]\d{8}$/;

interface ParsedItem {
    id: string; // Internal ID
    cleanName: string;
    doc: number;
    birdType: string | null;
    matchedFarmerId: string | null;
    matchedName: string | null;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    suggestions?: { id: string; name: string }[];
    isDuplicate?: boolean;
    location?: string | null;
    mobile?: string | null;

    // Derived or edited
    startDate?: Date | null;
}

export function BulkCycleImportModal({ open, onOpenChange, orgId }: BulkCycleImportModalProps) {
    const [step, setStep] = useState<"INPUT" | "REVIEW">("INPUT");
    const [inputText, setInputText] = useState("");
    const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
    const [orderDate, setOrderDate] = useState<Date | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingDocId, setEditingDocId] = useState<string | null>(null);
    const [showProGate, setShowProGate] = useState(false);
    const [loadingRowIds, setLoadingRowIds] = useState<Set<string>>(new Set());

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    // Fetch ALL farmers for matching
    const { data: farmersList } = useQuery({
        ...trpc.officer.farmers.listWithStock.queryOptions({
            orgId,
            page: 1,
            pageSize: 1000
        }),
        enabled: open
    });

    // Re-run matching when farmers list updates
    useEffect(() => {
        if (!farmersList?.items) return;

        setParsedData(prev => {
            const updated = prev.map(p => {
                if (p.matchedFarmerId) return p;

                const match = farmersList.items.find(f => f.name.toLowerCase().trim() === p.cleanName.toLowerCase().trim());

                if (match) {
                    return {
                        ...p,
                        matchedFarmerId: match.id,
                        matchedName: match.name,
                        confidence: "HIGH",
                    } as ParsedItem;
                }
                return p;
            });
            return calculateDuplicates(updated);
        });
    }, [farmersList]);

    const extractOrdersMutation = useMutation(trpc.ai.extractCycleOrders.mutationOptions({
        onError: (err) => toast.error(`AI Extraction Failed: ${err.message}`)
    }));

    const createBulkCyclesMutation = useMutation(trpc.officer.cycles.createBulk.mutationOptions({
        onSuccess: (data) => {
            if (data.created > 0) {
                toast.success(`Successfully started ${data.created} cycles.`);
                queryClient.invalidateQueries({ queryKey: [["officer", "cycles"]] });
                handleOpenChangeWrapper(false);
            }
            if (data.errors && data.errors.length > 0) {
                toast.error(`Failed to start ${data.errors.length} cycles. Check valid matches.`);
                console.error(data.errors);
            }
        },
        onError: (err) => toast.error(err.message)
    }));

    const createFarmerMutation = useMutation(trpc.officer.farmers.create.mutationOptions({
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: [["officer", "farmers"]] });
            // Update the matched row manually to reflect immediate change
            setParsedData(prev => {
                return prev.map(p => {
                    if (p.cleanName.toLowerCase() === data.name.toLowerCase()) {
                        return {
                            ...p,
                            matchedFarmerId: data.id,
                            matchedName: data.name,
                            confidence: "HIGH"
                        };
                    }
                    return p;
                });
            });
        }
    }));

    // --- Actions ---

    const parseText = async () => {
        if (!farmersList?.items || !inputText.trim()) return;

        try {
            const candidates = farmersList.items.map(f => ({ id: f.id, name: f.name }));

            const result = await extractOrdersMutation.mutateAsync({
                text: inputText,
                candidates: candidates
            });

            if (result.orderDate) {
                setOrderDate(new Date(result.orderDate));
            } else {
                setOrderDate(new Date()); // Default to today
            }

            // Map to local structure
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rows: ParsedItem[] = result.items.map((item: any, index: number) => {
                const matched = farmersList.items.find(f => f.id === item.matchedId);
                // Strict Name Match Override
                const exactMatch = farmersList.items.find(f => f.name.toLowerCase() === item.name.toLowerCase());

                const finalMatchedId = exactMatch ? exactMatch.id : (matched ? matched.id : null);
                const finalMatchedName = exactMatch ? exactMatch.name : (matched ? matched.name : null);

                return {
                    id: `row-${index}`,
                    cleanName: item.name,
                    doc: item.doc,
                    birdType: item.birdType,
                    matchedFarmerId: finalMatchedId,
                    matchedName: finalMatchedName,
                    confidence: finalMatchedId ? "HIGH" : "LOW",
                    suggestions: item.suggestions || [],
                    isDuplicate: false,
                    location: item.location,
                    mobile: item.mobile,
                    startDate: result.orderDate ? new Date(result.orderDate) : new Date()
                };
            });

            setParsedData(calculateDuplicates(rows));
            setStep("REVIEW");

        } catch (error) {
            console.error(error);
        }
    };

    const calculateDuplicates = (items: ParsedItem[]): ParsedItem[] => {
        // User requested NO duplication check
        return items.map(item => ({ ...item, isDuplicate: false }));
    };

    const handleSubmit = () => {
        const validItems = parsedData.filter(p => p.matchedFarmerId && !p.isDuplicate && p.doc > 0);

        if (validItems.length === 0) {
            toast.error("No valid cycles to import.");
            return;
        }

        const payload = validItems.map(p => {
            // Calculate Age?
            // If orderDate is set, sending startDate lets backend calculate.
            // If no orderDate, backend defaults to today/0 age.
            // Check implementation plan: backend accepts `startDate`.

            return {
                farmerId: p.matchedFarmerId!,
                doc: p.doc,
                birdType: p.birdType || undefined,
                startDate: orderDate || undefined, // Use global order date if parsed
                age: 0 // Default to 0, let startDate override or verify logic in implementation plan
            };
        });

        createBulkCyclesMutation.mutate({
            orgId,
            cycles: payload
        });
    };

    const handleCreateFarmer = async (item: ParsedItem) => {
        if (!item.cleanName) return;
        setLoadingRowIds(prev => new Set(prev).add(item.id));
        try {
            await createFarmerMutation.mutateAsync({
                name: item.cleanName,
                orgId,
                initialStock: 0,
                location: item.location,
                mobile: item.mobile
            });
            toast.success(`Created farmer: ${item.cleanName}`);
        } catch (e: any) {
            toast.error(e.message);
        } finally {
            setLoadingRowIds(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    };

    const handleCreateAllFarmers = async () => {
        const missing = parsedData.filter(
            (p) => !p.matchedFarmerId && p.cleanName
        );

        if (missing.length === 0) return;

        // Deduplicate by lowercase trimmed name
        const uniqueNames = Array.from(
            new Set(missing.map((p) => p.cleanName.trim().toLowerCase()))
        );

        toast.loading(`Creating ${uniqueNames.length} farmers...`, {
            id: "create-all",
        });

        // Add loading state for all missing rows
        setLoadingRowIds((prev) => {
            const next = new Set(prev);
            missing.forEach((m) => next.add(m.id));
            return next;
        });

        try {
            // Prepare all creation promises
            const createPromises = uniqueNames.map(async (nameKey) => {
                const prototype = missing.find(
                    (p) => p.cleanName.trim().toLowerCase() === nameKey
                );
                if (!prototype) return null;

                const newFarmer =
                    await createFarmerMutation.mutateAsync({
                        name: prototype.cleanName,
                        orgId,
                        initialStock: 0,
                        location: prototype.location,
                        mobile: prototype.mobile,
                    });

                return { nameKey, newFarmer };
            });

            // Run all in parallel
            const results = await Promise.all(createPromises);

            // Update parsedData in ONE state update
            setParsedData((prev) =>
                prev.map((p) => {
                    const key = p.cleanName?.trim().toLowerCase();
                    const match = results.find(
                        (r) => r && r.nameKey === key
                    );

                    if (match) {
                        return {
                            ...p,
                            matchedFarmerId: match.newFarmer.id,
                            matchedName: match.newFarmer.name,
                            confidence: "HIGH",
                        };
                    }

                    return p;
                })
            );

            toast.success(
                `Successfully created ${uniqueNames.length} farmers!`,
                { id: "create-all" }
            );
        } catch (e: any) {
            toast.error("Some farmers failed to create.", {
                id: "create-all",
            });
            console.error(e);
        } finally {
            setLoadingRowIds((prev) => {
                const next = new Set(prev);
                missing.forEach((m) => next.delete(m.id));
                return next;
            });
        }
    };

    const handleDismiss = (id: string) => {
        setParsedData(prev => calculateDuplicates(prev.filter(p => p.id !== id)));
    };

    // --- Pro Check logic (Copied from Stock Modal) ---
    const { data: requestStatus, refetch: refetchStatus, isPending: isLoadingStatus } = useQuery({
        ...trpc.officer.getMyRequestStatus.queryOptions({ feature: "PRO_PACK" }),
        enabled: open
    });
    const { data: session } = authClient.useSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session?.user as any;
    const isPro = user?.isPro || user?.globalRole === "ADMIN";

    const requestAccessMutation = useMutation(trpc.officer.requestAccess.mutationOptions({
        onSuccess: () => { toast.success("Request sent!"); refetchStatus(); },
        onError: (err) => toast.error(err.message)
    }));

    const handleRequestAccess = () => requestAccessMutation.mutate({ feature: "PRO_PACK" });
    const hasRequested = requestStatus?.status === "PENDING";
    const isApprovedInDb = (requestStatus?.status === "APPROVED") && isPro;

    const handleOpenChangeWrapper = (isOpen: boolean) => {
        if (!isOpen) {
            setStep("INPUT");
            setInputText("");
            setParsedData([]);
            setOrderDate(null);
            setShowProGate(false);
        }
        onOpenChange(isOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChangeWrapper}>
            <DialogContent className="w-[95vw] h-[90vh] sm:max-w-4xl sm:h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl">
                {showProGate ? (
                    /* PRO GATE UI (Simplified reuse) */
                    <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center space-y-4">
                        <Sparkles className="h-12 w-12 text-primary mb-4" />
                        <h3 className="text-xl font-bold">Pro Feature: AI Import</h3>
                        <p className="text-muted-foreground max-w-sm">
                            Import cycle orders directly from text messages.
                        </p>
                        <Button
                            onClick={handleRequestAccess}
                            disabled={requestAccessMutation.isPending || hasRequested}
                            className="w-full max-w-xs"
                        >
                            {isApprovedInDb ? "Approved! Refreshing..." : hasRequested ? "Access Requested" : "Request Access"}
                        </Button>
                        <Button variant="ghost" onClick={() => setShowProGate(false)}>Cancel</Button>
                    </div>
                ) : (
                    <>
                        <DialogHeader className="p-4 bg-muted/30 border-b flex flex-row items-center justify-between space-y-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <div>
                                    <DialogTitle>Bulk Start Cycles</DialogTitle>
                                    <DialogDescription className="text-xs">
                                        From text orders • {step === "REVIEW" ? `${orderDate ? format(orderDate, "dd MMM yyyy") : "No Date"}` : "AI Powered"}
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden relative bg-muted/10">
                            {step === "INPUT" ? (
                                <div className="h-full flex flex-col p-6 animate-in fade-in">
                                    <Textarea
                                        placeholder={`Paste orders here...\n\nExample:\nDate: 12 Feb 2026\n\nFarm 01\nHashem Ali\n2000 pcs\nRoss A\nLoc: Gazipur\nPh: 017...`}
                                        className="flex-1 resize-none font-mono text-sm leading-relaxed p-4"
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                    />
                                    <div className="flex justify-end mt-4">
                                        <Button
                                            onClick={() => {
                                                if (isPro) parseText();
                                                else setShowProGate(true);
                                            }}
                                            disabled={extractOrdersMutation.isPending || !inputText.trim()}
                                            className="bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                                        >
                                            {extractOrdersMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                            Analyze & Import
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <ScrollArea className="h-full p-4">
                                    <div className="space-y-3">
                                        {parsedData.map((row) => (
                                            <div key={row.id} className={`
                                            group relative p-3 rounded-xl border transition-all hover:shadow-md bg-card
                                            ${row.isDuplicate ? "border-destructive/30 bg-destructive/5" : ""}
                                            ${!row.matchedFarmerId ? "border-amber-500/30 bg-amber-500/5" : "border-border/50"}
                                         `}>
                                                <div className="flex items-start gap-3">
                                                    {/* Status Icon */}
                                                    <div className="mt-1">
                                                        {row.isDuplicate ? (
                                                            <div className="h-8 w-8 rounded-full bg-destructive/10 text-destructive flex items-center justify-center"><AlertTriangle className="h-4 w-4" /></div>
                                                        ) : row.matchedFarmerId ? (
                                                            <div className="h-8 w-8 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center relative">
                                                                <Check className="h-4 w-4" />
                                                                {row.confidence === "HIGH" && <div className="absolute -top-1 -right-1 bg-background rounded-full border p-0.5"><Sparkles className="h-2 w-2 text-amber-500" /></div>}
                                                            </div>
                                                        ) : (
                                                            <div className="h-8 w-8 rounded-full bg-amber-500/10 text-amber-600 flex items-center justify-center"><Search className="h-4 w-4" /></div>
                                                        )}
                                                    </div>

                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                            <div>
                                                                <h4 className="font-semibold text-foreground truncate">{row.cleanName}</h4>
                                                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mt-0.5">
                                                                    {row.matchedName && row.matchedName !== row.cleanName && (
                                                                        <span className="flex items-center text-emerald-600 font-medium">
                                                                            <User className="h-3 w-3 mr-1" />
                                                                            Matched: {row.matchedName}
                                                                        </span>
                                                                    )}
                                                                    {row.location && <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">{row.location}</Badge>}
                                                                    {row.mobile && <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal">{row.mobile}</Badge>}
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-2">
                                                                <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2 py-1">
                                                                    <Badge className="h-6 bg-primary text-primary-foreground hover:bg-primary">{row.doc} birds</Badge>
                                                                    {row.birdType && <span className="text-xs font-medium text-muted-foreground">{row.birdType}</span>}
                                                                </div>

                                                                {!row.matchedFarmerId && (
                                                                    <Button
                                                                        size="sm"
                                                                        className="h-7 text-xs"
                                                                        onClick={() => handleCreateFarmer(row)}
                                                                        disabled={loadingRowIds.has(row.id)}
                                                                    >
                                                                        {loadingRowIds.has(row.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                                                                        Create
                                                                    </Button>
                                                                )}

                                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDismiss(row.id)}>
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>

                        {step === "REVIEW" && (
                            <div className="p-4 border-t bg-muted/30 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3">
                                <Button variant="ghost" onClick={() => setStep("INPUT")} className="w-full sm:w-auto">Back to Input</Button>
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-sm font-medium">
                                            {parsedData.filter(p => p.matchedFarmerId && !p.isDuplicate).length} Ready
                                        </p>
                                        <span className="text-xs text-muted-foreground">
                                            {parsedData.filter(p => !p.matchedFarmerId || p.isDuplicate).length} Issues
                                        </span>
                                    </div>

                                    {parsedData.some(p => !p.matchedFarmerId) && (
                                        <Button
                                            variant="outline"
                                            onClick={handleCreateAllFarmers}
                                            disabled={loadingRowIds.size > 0}
                                            className="border-dashed w-full sm:w-auto"
                                        >
                                            {loadingRowIds.size > 0 && parsedData.some(p => !p.matchedFarmerId && loadingRowIds.has(p.id)) ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                                            Create All ({parsedData.filter(p => !p.matchedFarmerId).length})
                                        </Button>
                                    )}

                                    <Button
                                        onClick={handleSubmit}
                                        disabled={createBulkCyclesMutation.isPending || parsedData.filter(p => p.matchedFarmerId && !p.isDuplicate).length === 0}
                                        className="min-w-[140px] w-full sm:w-auto"
                                    >
                                        {createBulkCyclesMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                        Start Cycles
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
