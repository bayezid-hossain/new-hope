"use client";

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
import { AlertTriangle, Check, CheckCircle2, Loader2, Plus, Search, Sparkles, Trash2 } from "lucide-react";
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

                const normalize = (n: string) => n.trim().toLowerCase().replace(/\s+/g, ' ');

                const match = farmersList.items.find(f => normalize(f.name) === normalize(p.cleanName));

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

    const handleSelectSuggestion = (item: ParsedItem, suggestion: { id: string; name: string }) => {
        setParsedData(prev => {
            const updated = prev.map(p => {
                if (p.id === item.id) {
                    return {
                        ...p,
                        matchedFarmerId: suggestion.id,
                        matchedName: suggestion.name,
                        confidence: "HIGH",
                        suggestions: [] // Clear suggestions after selection
                    } as ParsedItem;
                }
                return p;
            });
            return calculateDuplicates(updated);
        });
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
                                            <div
                                                key={row.id}
                                                className={`
    group relative overflow-hidden rounded-3xl
    border border-white/5
    bg-gradient-to-br from-[#1c1d1f] via-[#18191b] to-[#121212]
    shadow-[0_10px_40px_-15px_rgba(0,0,0,0.7)]
    transition-all duration-500
    active:scale-[0.99]
    ${row.isDuplicate ? "border-destructive/30 bg-gradient-to-br from-destructive/10 to-[#121212]" : ""}
    ${!row.matchedFarmerId && !row.isDuplicate ? "border-amber-500/30" : ""}
  `}
                                            >
                                                {/* Subtle Glow */}
                                                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-r from-transparent via-white/5 to-transparent pointer-events-none" />

                                                <div className="relative p-2.5 sm:p-4 space-y-2.5 sm:space-y-4">

                                                    {/* Top Section */}
                                                    <div className="flex items-start gap-2.5 sm:gap-4">

                                                        {/* Status Icon */}
                                                        <div className={`
        h-9 w-9 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0
        shadow-inner border
        ${row.isDuplicate
                                                                ? "bg-destructive/15 text-destructive border-destructive/30"
                                                                : row.matchedFarmerId
                                                                    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                                                    : "bg-amber-500/15 text-amber-400 border-amber-500/30"
                                                            }
      `}>
                                                            {row.isDuplicate ? <AlertTriangle className="h-3.5 w-3.5 sm:h-5 sm:w-5" /> :
                                                                row.matchedFarmerId ? <Check className="h-3.5 w-3.5 sm:h-5 sm:w-5" /> :
                                                                    <Search className="h-3.5 w-3.5 sm:h-5 sm:w-5" />}
                                                        </div>

                                                        {/* Name + Match */}
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="text-xs sm:text-base font-bold text-white truncate leading-tight">
                                                                {row.cleanName}
                                                            </h4>

                                                            {row.matchedName && row.matchedName !== row.cleanName && (
                                                                <div className="mt-0.5 sm:mt-1 text-[10px] sm:text-[11px] text-emerald-400 font-semibold truncate">
                                                                    MATCH → {row.matchedName}
                                                                </div>
                                                            )}

                                                            {/* Location */}
                                                            <div className="mt-0.5 sm:mt-2 text-[10px] sm:text-xs text-gray-400 truncate">
                                                                {row.location || "No location"}
                                                            </div>

                                                            {/* Mobile */}
                                                            {row.mobile && (
                                                                <div className="text-[10px] sm:text-xs font-mono text-gray-500 mt-0.5 sm:mt-1 truncate">
                                                                    {row.mobile}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Suggestions */}
                                                    {!row.matchedFarmerId && row.suggestions && row.suggestions.length > 0 && (
                                                        <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                                                            <span className="text-[9px] sm:text-[10px] text-muted-foreground self-center mr-1">Did you mean?</span>
                                                            {row.suggestions.map(s => (
                                                                <button
                                                                    key={s.id}
                                                                    onClick={() => handleSelectSuggestion(row, s)}
                                                                    className="px-2 py-0.5 sm:py-1 rounded-md bg-primary/10 hover:bg-primary/20 text-primary text-[9px] sm:text-[10px] font-medium transition-colors border border-primary/20 truncate max-w-[120px] sm:max-w-[150px]"
                                                                >
                                                                    {s.name}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Divider */}
                                                    <div className="h-px bg-white/5 my-0.5 sm:my-1" />

                                                    {/* Birds Section */}
                                                    <div className="flex items-center justify-between">

                                                        <div>
                                                            <div className="text-lg sm:text-2xl font-extrabold text-white tracking-tight">
                                                                {row.doc}
                                                            </div>
                                                            <div className="text-[9px] sm:text-[11px] uppercase tracking-wider text-gray-500">
                                                                birds
                                                            </div>
                                                        </div>

                                                        {row.birdType && (
                                                            <div className="text-[9px] sm:text-xs text-gray-400 font-medium text-right bg-white/5 px-1.5 py-0.5 sm:px-2 sm:py-1 rounded-lg">
                                                                {row.birdType}
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Actions */}
                                                    <div className="flex flex-row items-center gap-1.5 sm:gap-2 pt-1 sm:pt-2 w-full">

                                                        {!row.matchedFarmerId ? (
                                                            <Button
                                                                className="flex-1 h-9 sm:h-11 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs
          bg-white text-black hover:bg-gray-100
          shadow-[0_0_25px_-8px_rgba(255,255,255,0.3)]
          transition-all active:scale-95 min-w-0 px-2 sm:px-4"
                                                                onClick={() => handleCreateFarmer(row)}
                                                                disabled={loadingRowIds.has(row.id)}
                                                            >
                                                                {loadingRowIds.has(row.id) ? (
                                                                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1.5 sm:mr-2 shrink-0" />
                                                                ) : (
                                                                    <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 shrink-0" />
                                                                )}
                                                                <span className="truncate">CREATE</span>
                                                            </Button>
                                                        ) : (
                                                            <div className="flex-1 h-9 sm:h-11 flex items-center justify-center
          rounded-xl sm:rounded-2xl text-[10px] sm:text-xs font-bold
          text-emerald-400 bg-emerald-500/10
          border border-emerald-500/30 min-w-0">
                                                                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 shrink-0" />
                                                                <span className="truncate">READY</span>
                                                            </div>
                                                        )}

                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl sm:rounded-2xl shrink-0
         text-gray-500 hover:text-red-400
         hover:bg-red-500/10"
                                                            onClick={() => handleDismiss(row.id)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                                                        </Button>
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
