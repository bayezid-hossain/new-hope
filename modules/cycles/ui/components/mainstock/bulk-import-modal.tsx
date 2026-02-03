"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, AlertTriangle, ArrowRight, Check, CheckCircle2, Clock, Edit2, Loader2, Pencil, Plus, Search, Sparkles, Trash2, User, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface BulkImportModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    orgId: string;
}

interface ParsedItem {
    id: string; // Internal ID for the row
    rawName: string; // Name from text
    cleanName: string; // Edited name
    amount: number;
    matchedFarmerId: string | null;
    matchedName: string | null;
    confidence: "HIGH" | "MEDIUM" | "LOW";
    suggestions?: { id: string; name: string }[];
    isDuplicate?: boolean;
    stockAdded?: boolean;
}

export function BulkImportModal({ open, onOpenChange, orgId }: BulkImportModalProps) {
    const [step, setStep] = useState<"INPUT" | "REVIEW">("INPUT");
    const [inputText, setInputText] = useState("");
    const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingAmountId, setEditingAmountId] = useState<string | null>(null);
    const [showProGate, setShowProGate] = useState(false);
    const [loadingRowIds, setLoadingRowIds] = useState<Set<string>>(new Set());

    const trpc = useTRPC();
    const queryClient = useQueryClient();

    // Fetch ALL farmers for matching (lightweight query: id, name)
    const { data: farmersList, isPending: isLoadingFarmers } = useQuery({
        ...trpc.officer.farmers.listWithStock.queryOptions({
            orgId,
            page: 1,
            pageSize: 1000 // Get many for matching
        }),
        enabled: open
    });

    const bulkAddMutation = useMutation(trpc.officer.stock.bulkAddStock.mutationOptions({
        onSuccess: (data) => {
            toast.success(`Successfully added stock to ${data.count} farmers.`);
            queryClient.invalidateQueries({ queryKey: [["officer", "farmers"]] });
            onOpenChange(false);
            // Reset
            setStep("INPUT");
            setInputText("");
            setParsedData([]);
        },
        onError: (err) => {
            toast.error(`Failed to import: ${err.message}`);
        }
    }));

    const createFarmerMutation = useMutation(trpc.officer.farmers.create.mutationOptions({
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: [["officer", "farmers"]] });
            // We don't close modal, we update the matched row
            handleFarmerCreated(data.name, data.id);
        },
        onError: (err) => {
            toast.error(`Failed to create farmer: ${err.message}`);
        }
    }));

    const createBulkMutation = useMutation(trpc.officer.farmers.createBulk.mutationOptions({
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: [["officer", "farmers"]] });

            // Update matched rows for all created farmers
            setParsedData(prev => {
                const updatedItems = prev.map(p => {
                    // Try to find if this item was just created
                    const created = data.find(c => c.name.toUpperCase() === p.cleanName.toUpperCase());
                    if (created && !p.matchedFarmerId) {
                        return {
                            ...p,
                            matchedFarmerId: created.id,
                            matchedName: created.name,
                            confidence: "HIGH",
                            stockAdded: false
                        } as ParsedItem;
                    }
                    return p;
                });
                return calculateDuplicates(updatedItems);
            });

            toast.success(`Created ${data.length} farmers`);
        },
        onError: (err) => {
            toast.error(`Failed to create farmers: ${err.message}`);
        }
    }));
    // ...
    const handleFarmerCreated = (name: string, newId: string) => {
        setParsedData(prev => {
            const updatedItems = prev.map(p => {
                if (p.cleanName.toLowerCase() === name.toLowerCase()) {
                    return {
                        ...p,
                        matchedFarmerId: newId,
                        matchedName: name,
                        confidence: "HIGH",
                        stockAdded: false // Updated: Stock NOT added during creation, will be added by bulk import
                    } as ParsedItem;
                }
                return p;
            });
            return calculateDuplicates(updatedItems);
        });
    };
    // ...
    const handleCreateClick = async (item: ParsedItem) => {
        if (!item.cleanName) return;

        setLoadingRowIds(prev => new Set(prev).add(item.id));
        try {
            await createFarmerMutation.mutateAsync({
                name: item.cleanName,
                initialStock: 0, // Updated: Create with 0 stock
                orgId: orgId,
            });
            toast.success(`Farmer "${item.cleanName}" created!`);
        } catch (error) {
            // Error handled by mutation
        } finally {
            setLoadingRowIds(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    };

    const extractFarmersMutation = useMutation(trpc.ai.extractFarmers.mutationOptions({
        onError: (err) => {
            toast.error(`Failed to analyze text: ${err.message}`);
        }
    }));

    // Fetch Request Status
    const { data: requestStatus, refetch: refetchStatus, isPending: isLoadingStatus } = useQuery({
        ...trpc.officer.getMyRequestStatus.queryOptions({ feature: "PRO_PACK" }),
        enabled: open
    });

    const parseText = async () => {
        if (!farmersList?.items || !inputText.trim()) return;

        try {
            //conosle.log("Parsing text:", inputText);
            // Prepare candidates for AI
            const candidates = farmersList.items.map(f => ({ id: f.id, name: f.name }));
            //conosle.log("Candidates count:", candidates.length);

            const extractedData = await extractFarmersMutation.mutateAsync({
                text: inputText,
                candidates: candidates
            });

            //conosle.log("AI Extracted Data:", extractedData);

            // Map AI result to ParsedItem structure
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const results: ParsedItem[] = (extractedData as any[]).map((item: any, index: number) => {
                const nameCandidate = item.name.trim();
                const totalAmount = item.amount;
                const matchedId = item.matchedId;
                const confidence = item.confidence || "LOW";
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const suggestions = (item.suggestions || []) as { id: string; name: string }[];

                // Find the matched farmer object if ID exists
                const matchedFarmer = matchedId ? farmersList.items.find(f => f.id === matchedId) : null;

                let finalMatchedId = null;
                let finalMatchedName = null;

                // STRICT MATCH LOGIC:
                // Only automatically link if the name is an EXACT match (case-insensitive)
                if (matchedFarmer) {
                    if (matchedFarmer.name.toLowerCase().trim() === nameCandidate.toLowerCase()) {
                        finalMatchedId = matchedFarmer.id;
                        finalMatchedName = matchedFarmer.name;
                    } else {
                        // If it was a partial match by AI, move it to suggestions
                        const exists = suggestions.find(s => s.id === matchedFarmer.id);
                        if (!exists) {
                            suggestions.unshift({ id: matchedFarmer.id, name: matchedFarmer.name });
                        }
                    }
                }

                return {
                    id: `row-${index}`,
                    rawName: nameCandidate,
                    cleanName: nameCandidate,
                    amount: totalAmount,
                    matchedFarmerId: finalMatchedId,
                    matchedName: finalMatchedName,
                    confidence: finalMatchedId ? "HIGH" : "LOW",
                    suggestions: suggestions,
                    isDuplicate: false // Initial value
                };
            });

            //conosle.log("Parsed Results:", results);

            if (results.length === 0) {
                toast.warning("The AI couldn't find any farmer data in the text. Please check the format.");
                return;
            }

            // Calculate duplicates
            const finalResults = calculateDuplicates(results);
            setParsedData(finalResults);
            setStep("REVIEW");

        } catch (err) {
            console.error(err);
        }
    };

    const calculateDuplicates = (items: ParsedItem[]): ParsedItem[] => {
        return items.map(item => {
            const count = items.filter(r => {
                if (item.matchedFarmerId && r.matchedFarmerId === item.matchedFarmerId) return true;
                if (!item.matchedFarmerId && !r.matchedFarmerId && r.cleanName.toLowerCase() === item.cleanName.toLowerCase()) return true;
                return false;
            }).length;

            return { ...item, isDuplicate: count > 1 };
        });
    };

    const findBestMatch = (inputName: string, candidates: any[]) => {
        if (!candidates) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exact = candidates.find((c: any) => c.name.toLowerCase() === inputName.toLowerCase());
        if (exact) return exact;

        // Strict Mode: No partial matches allowed for auto-select
        return null;
    };

    const handleSuggestionClick = (rowId: string, suggestion: { id: string, name: string }) => {
        setParsedData(prev => {
            const updatedItems = prev.map(p => {
                if (p.id !== rowId) return p;
                return {
                    ...p,
                    matchedFarmerId: suggestion.id,
                    matchedName: suggestion.name,
                    confidence: "HIGH"
                } as ParsedItem;
            });
            return calculateDuplicates(updatedItems);
        });
    };

    const handleNameEdit = (id: string, newName: string) => {
        setParsedData(prev => {
            const updatedItems = prev.map(p => {
                if (p.id !== id) return p;

                const match = findBestMatch(newName, farmersList?.items || []);
                return {
                    ...p,
                    cleanName: newName,
                    matchedFarmerId: match?.id || null,
                    matchedName: match?.name || null,
                    confidence: "HIGH",
                    suggestions: []
                } as ParsedItem;
            });
            return calculateDuplicates(updatedItems);
        });
    };

    const handleAmountEdit = (id: string, newAmount: string) => {
        const amount = parseInt(newAmount) || 0;
        setParsedData(prev => {
            return prev.map(p => {
                if (p.id !== id) return p;
                return {
                    ...p,
                    amount: amount
                };
            });
        });
    };



    const handleDismiss = (id: string) => {
        setParsedData(prev => {
            const next = prev.filter(p => p.id !== id);
            return calculateDuplicates(next);
        });
    };

    const handleSubmit = () => {
        const payload = parsedData
            .filter(p => p.matchedFarmerId && !p.stockAdded)
            .map(p => ({
                farmerId: p.matchedFarmerId!,
                amount: p.amount,
                note: `Bulk Import: ${p.matchedName || p.cleanName}`
            }));

        if (payload.length === 0) {
            toast.error("No valid matches found to import.");
            return;
        }

        bulkAddMutation.mutate(payload);
    };

    // --- PRO CHECK ---
    const { data: session } = authClient.useSession();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session?.user as any;
    const isPro = user?.isPro || user?.globalRole === "ADMIN";

    const requestAccessMutation = useMutation(trpc.officer.requestAccess.mutationOptions({
        onSuccess: () => {
            toast.success("Request sent! Admin will review shortly.");
            refetchStatus();
        },
        onError: (err) => {
            toast.error(err.message);
        }
    }));



    const hasRequested = requestStatus?.status === "PENDING";
    const isApprovedInDb = (requestStatus?.status === "APPROVED") && isPro;

    const handleRequestAccess = () => {
        requestAccessMutation.mutate({ feature: "PRO_PACK" });
    };

    const handleOpenChangeWrapper = (isOpen: boolean) => {
        if (!isOpen) {
            setStep("INPUT");
            setInputText("");
            setParsedData([]);
            setEditingId(null);
            setEditingAmountId(null);
            setLoadingRowIds(new Set());
            setShowProGate(false);
        }
        onOpenChange(isOpen);
    };

    const [isCreatingAll, setIsCreatingAll] = useState(false);

    const handleCreateAll = async () => {
        const missing = parsedData.filter(p => !p.matchedFarmerId && p.cleanName);
        if (missing.length === 0) return;

        setIsCreatingAll(true);
        // Deduplicate creation requests by name to avoid double creating
        const uniqueNames = new Set<string>();
        const uniqueMissing = missing.filter(p => {
            const normalized = p.cleanName.toLowerCase().trim();
            if (uniqueNames.has(normalized)) return false;
            // CHECK: Don't include if already being created individually
            if (loadingRowIds.has(p.id)) return false;
            uniqueNames.add(normalized);
            return true;
        });

        try {
            await createBulkMutation.mutateAsync({
                farmers: uniqueMissing.map(item => ({
                    name: item.cleanName,
                    initialStock: 0 // Create with 0 stock
                })),
                orgId: orgId
            });
            // Success handled in onSuccess
        } catch (error) {
            console.error(error);
        } finally {
            setIsCreatingAll(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChangeWrapper}>
            <DialogContent className="w-[95vw] h-[90vh] sm:max-w-4xl sm:h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background/95 backdrop-blur-xl border border-border/50 shadow-2xl rounded-2xl">
                {showProGate ? (
                    <div className="h-full w-full flex flex-col animate-in fade-in zoom-in-95 duration-200">
                        <div className="relative h-48 bg-slate-900 flex items-center justify-center overflow-hidden shrink-0">
                            {/* Close Button for Pro Modal - Just goes back to input */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute top-2 right-2 z-20 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                                onClick={() => setShowProGate(false)}
                            >
                                <X className="h-5 w-5" />
                            </Button>

                            <div className="absolute inset-0 bg-gradient-to-br from-primary to-primary/80 opacity-90" />
                            <div className="z-10 text-center text-white p-4">
                                <Sparkles className="h-10 w-10 mx-auto mb-2 text-amber-300" />
                                <h3 className="text-xl font-bold">Pro Feature</h3>
                            </div>
                            <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/20 rounded-full blur-3xl opacity-50" />
                            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-primary/30 rounded-full blur-3xl opacity-50" />
                        </div>

                        <div className="p-6 space-y-4 flex-1 overflow-y-auto">
                            <div className="text-center space-y-2">
                                <DialogTitle className="text-lg font-semibold text-foreground">AI Stock Extraction</DialogTitle>
                                <DialogDescription className="text-sm text-muted-foreground">
                                    Import thousands of farmer records in seconds using our AI-powered engine. Exclusive to Pro officers.
                                </DialogDescription>
                            </div>

                            <div className="bg-muted rounded-lg p-4 border border-border/50 flex flex-col gap-2">
                                <div className="flex items-center gap-2 text-sm text-foreground/80">
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                    <span>Parse WhatsApp/SMS reports</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-foreground/80">
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                    <span>Auto-match existing farmers</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-foreground/80">
                                    <CheckCircle2 className="h-4 w-4 text-primary" />
                                    <span>Detect duplicates automatically</span>
                                </div>
                            </div>

                            <Button
                                onClick={handleRequestAccess}
                                disabled={requestAccessMutation.isPending || hasRequested || isLoadingStatus}
                                className={`w-full shadow-lg text-white transition-all ${hasRequested || isLoadingStatus
                                    ? "bg-muted text-muted-foreground cursor-not-allowed hover:bg-muted"
                                    : "bg-gradient-to-r from-primary to-primary/80 hover:opacity-90"
                                    }`}
                            >
                                {requestAccessMutation.isPending || isLoadingStatus ? (
                                    <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                ) : isApprovedInDb ? (
                                    <CheckCircle2 className="h-4 w-4 mr-2" />
                                ) : hasRequested ? (
                                    <Clock className="h-4 w-4 mr-2" />
                                ) : (
                                    <Sparkles className="h-4 w-4 mr-2" />
                                )}
                                {isLoadingStatus ? "Checking status..." : isApprovedInDb ? "Pro Status Approved" : hasRequested ? "Access Requested" : "Request Access"}
                            </Button>

                            <p className="text-xs text-center text-muted-foreground h-4">
                                {isLoadingStatus ? (
                                    <span className="animate-pulse">Verifying access...</span>
                                ) : isApprovedInDb ? (
                                    <span className="text-primary font-medium italic">Approved! Refresh page to enable features.</span>
                                ) : hasRequested ? (
                                    <span className="text-amber-500 font-medium">Pending admin approval.</span>
                                ) : (
                                    "Usually approved within 24 hours."
                                )}
                            </p>

                            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowProGate(false)}>
                                No thanks, I'll type manually
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 bg-gradient-to-r from-muted to-background border-b sticky top-0 z-10 relative">
                            {/* Close Button for Main Modal */}
                            <Button
                                variant="ghost"
                                size="icon"
                                className="absolute right-4 top-4 h-8 w-8 text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-full"
                                onClick={() => handleOpenChangeWrapper(false)}
                            >
                                <X className="h-4 w-4" />
                            </Button>

                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pr-8">
                                <DialogTitle className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-foreground">
                                    <div className="p-2 bg-primary/10 text-primary rounded-lg">
                                        <Sparkles className="h-5 w-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span>Bulk Stock Import</span>
                                        <span className="text-xs font-medium text-muted-foreground font-normal">AI Powered Extraction</span>
                                    </div>
                                </DialogTitle>
                                {step === "REVIEW" && (
                                    <div className="flex gap-2 self-end sm:self-auto">
                                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs sm:text-sm">
                                            <CheckCircle2 className="w-3 h-3 mr-1" />
                                            {parsedData.filter(p => p.matchedFarmerId && !p.isDuplicate).length} Ready
                                        </Badge>
                                        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20 text-xs sm:text-sm">
                                            <AlertCircle className="w-3 h-3 mr-1" />
                                            {parsedData.filter(p => !p.matchedFarmerId || p.isDuplicate).length} Check
                                        </Badge>
                                    </div>
                                )}
                            </div>
                            <DialogDescription className="hidden">
                                Import stock from daily reports
                            </DialogDescription>
                        </DialogHeader>

                        {/* Content */}
                        <div className="flex-1 overflow-hidden bg-muted/30 relative">
                            {step === "INPUT" ? (
                                <div className="h-full flex flex-col p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
                                    <div className="bg-card border border-border/50 rounded-xl shadow-sm p-1 flex-1 flex flex-col">
                                        <Textarea
                                            placeholder={`Example:\nFarm No 1\nFarmer: Rabby Traders\nB2: 15 Bags\n\nFarm No 02\nAbdul Hamid...`}
                                            className="flex-1 border-0 focus-visible:ring-0 resize-none p-4 text-sm sm:text-base font-mono leading-relaxed bg-transparent overflow-y-auto max-h-[500px]"
                                            value={inputText}
                                            onChange={(e) => setInputText(e.target.value)}
                                        />
                                        <div className="p-2 border-t bg-muted/50 text-xs text-muted-foreground flex justify-between items-center rounded-b-xl">
                                            <span>Paste your daily report text above</span>
                                            <span>{inputText.length} chars</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <ScrollArea className="h-full p-4 sm:p-6">
                                    {parsedData.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 min-h-[300px]">
                                            <Search className="h-8 w-8 opacity-20" />
                                            <p>No items found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            {parsedData.map((row) => (
                                                <div
                                                    key={row.id}
                                                    className={`
                                                group relative p-3 sm:p-4 rounded-xl border transition-all duration-200 hover:shadow-md
                                                ${row.isDuplicate ? "bg-destructive/5 border-destructive/20" :
                                                            !row.matchedFarmerId ? "bg-amber-500/5 border-amber-500/10" : "bg-card border-border/50 hover:border-primary/50"}
                                            `}
                                                >
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                                        {/* Top Row (Mobile): User Info */}
                                                        <div className="flex items-center gap-4 w-full sm:w-auto">
                                                            {/* Icon Status */}
                                                            <div className="shrink-0">
                                                                {row.isDuplicate ? (
                                                                    <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                                                                        <AlertTriangle className="h-5 w-5" />
                                                                    </div>
                                                                ) : row.matchedFarmerId ? (
                                                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary relative">
                                                                        <Check className="h-5 w-5" />
                                                                        {row.confidence === "HIGH" && (
                                                                            <div className="absolute -top-1 -right-1 bg-background rounded-full p-0.5 shadow-sm border border-border/50">
                                                                                <Sparkles className="h-3 w-3 text-amber-500" />
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-500">
                                                                        <Search className="h-5 w-5" />
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Input / Name */}
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                                                        Extracted: "{row.rawName}"
                                                                    </span>
                                                                    {row.isDuplicate && <Badge variant="destructive" className="h-5 text-[10px] px-1.5">Duplicate</Badge>}
                                                                </div>

                                                                {editingId === row.id ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <Input
                                                                            value={row.cleanName}
                                                                            onChange={(e) => handleNameEdit(row.id, e.target.value)}
                                                                            onBlur={() => setEditingId(null)}
                                                                            autoFocus
                                                                            className="h-8 max-w-[200px]"
                                                                        />
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2">
                                                                        <h3 className="font-semibold text-foreground text-lg truncate">
                                                                            {row.cleanName}
                                                                        </h3>
                                                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditingId(row.id)}>
                                                                            <Edit2 className="h-3 w-3 text-muted-foreground hover:text-primary" />
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Middle Arrow (Hidden on Mobile) */}
                                                        <div className="hidden sm:block text-muted-foreground/30">
                                                            <ArrowRight className="h-5 w-5" />
                                                        </div>

                                                        {/* Match Status / Action */}
                                                        <div className="flex-1 w-full sm:w-auto min-w-0 pl-[56px] sm:pl-0 mt-2 sm:mt-0 flex items-center justify-between gap-2">
                                                            <div className="flex-1">
                                                                {row.matchedFarmerId ? (
                                                                    <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 flex items-center justify-between">
                                                                        <div className="flex items-center gap-2">
                                                                            <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                                                                                <User className="h-4 w-4" />
                                                                            </div>
                                                                            <div>
                                                                                <p className="text-sm font-semibold text-foreground">{row.matchedName}</p>
                                                                                <p className="text-[10px] text-primary/70 font-medium uppercase tracking-wide">
                                                                                    {row.stockAdded ? "Created & Stock Added" : "Database Match"}
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                        {editingAmountId === row.id && !row.stockAdded ? (
                                                                            <Input
                                                                                type="number"
                                                                                className="h-6 w-20 bg-background border-primary/20 focus-visible:ring-primary p-1 text-right"
                                                                                value={row.amount}
                                                                                onChange={(e) => handleAmountEdit(row.id, e.target.value)}
                                                                                onBlur={() => setEditingAmountId(null)}
                                                                                autoFocus
                                                                            />
                                                                        ) : (
                                                                            <div className="flex items-center gap-1 group/amount cursor-pointer" onClick={() => !row.stockAdded && setEditingAmountId(row.id)}>
                                                                                {row.stockAdded ? (
                                                                                    <Badge className="bg-primary text-primary-foreground hover:opacity-90 border-0 h-6">
                                                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                                        {row.amount} Added
                                                                                    </Badge>
                                                                                ) : (
                                                                                    <>
                                                                                        <Badge className="bg-primary/20 text-primary hover:bg-primary/30 border-0 h-6">
                                                                                            +{row.amount} Bags
                                                                                        </Badge>
                                                                                        <Pencil className="h-3 w-3 text-primary/70 opacity-0 group-hover/amount:opacity-100 transition-opacity" />
                                                                                    </>
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex flex-col gap-2">
                                                                        <div className="flex items-center justify-between gap-3">
                                                                            <div className="flex flex-col">
                                                                                <span className="text-sm font-medium text-amber-600 dark:text-amber-500">No Match Found</span>
                                                                                <span className="text-xs text-muted-foreground/70">Create new or select suggestion</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-2">
                                                                                {editingAmountId === row.id ? (
                                                                                    <Input
                                                                                        type="number"
                                                                                        className="h-7 w-20 bg-background border-border text-right"
                                                                                        value={row.amount}
                                                                                        onChange={(e) => handleAmountEdit(row.id, e.target.value)}
                                                                                        onBlur={() => setEditingAmountId(null)}
                                                                                        autoFocus
                                                                                    />
                                                                                ) : (
                                                                                    <div className="flex items-center gap-1 group/amount cursor-pointer" onClick={() => setEditingAmountId(row.id)}>
                                                                                        <Badge variant="outline" className="bg-background text-muted-foreground px-2 h-7 font-mono border-border">
                                                                                            +{row.amount}
                                                                                        </Badge>
                                                                                        <Pencil className="h-3 w-3 text-muted-foreground/50 opacity-0 group-hover/amount:opacity-100 transition-opacity" />
                                                                                    </div>
                                                                                )}
                                                                                <Button
                                                                                    size="sm"
                                                                                    variant="default"
                                                                                    className="h-8 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                                                                    onClick={() => handleCreateClick(row)}
                                                                                    disabled={loadingRowIds.has(row.id) || isCreatingAll}
                                                                                >
                                                                                    {loadingRowIds.has(row.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                                                                                    Create
                                                                                </Button>
                                                                            </div>
                                                                        </div>

                                                                        {/* AI Suggestions */}
                                                                        {row.suggestions && row.suggestions.length > 0 && (
                                                                            <div className="flex flex-wrap gap-2 mt-1">
                                                                                <span className="text-xs text-muted-foreground font-medium py-1">Did you mean:</span>
                                                                                {row.suggestions.map(s => (
                                                                                    <Badge
                                                                                        key={s.id}
                                                                                        variant="secondary"
                                                                                        className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors border border-transparent hover:border-primary/30"
                                                                                        onClick={() => handleSuggestionClick(row.id, s)}
                                                                                    >
                                                                                        {s.name}
                                                                                    </Badge>
                                                                                ))}
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Remove Action */}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => handleDismiss(row.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </ScrollArea>
                            )}
                        </div>

                        {/* Footer */}
                        <DialogFooter className="p-4 sm:p-6 bg-muted/30 border-t border-border/50 z-10">
                            {step === "INPUT" ? (
                                <div className="w-full flex justify-between items-center sm:justify-end gap-3">
                                    {!isPro && (
                                        <Button
                                            variant="ghost"
                                            onClick={handleRequestAccess}
                                            disabled={requestAccessMutation.isPending || hasRequested || isLoadingStatus || isApprovedInDb}
                                            className={`text-muted-foreground hover:text-primary hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all ${hasRequested ? "opacity-50 cursor-not-allowed" : ""
                                                }`}
                                            size="sm"
                                        >
                                            {requestAccessMutation.isPending || isLoadingStatus ? (
                                                <Loader2 className="animate-spin h-3.5 w-3.5 mr-2" />
                                            ) : isApprovedInDb ? (
                                                <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                                            ) : hasRequested ? (
                                                <Clock className="h-3.5 w-3.5 mr-2" />
                                            ) : (
                                                <Sparkles className="h-3.5 w-3.5 mr-2 text-primary" />
                                            )}
                                            {isLoadingStatus ? "Checking..." : isApprovedInDb ? "Approved" : hasRequested ? "Access Requested" : "Request Pro Access"}
                                        </Button>
                                    )}
                                    <Button
                                        onClick={() => {
                                            if (!isPro) {
                                                setShowProGate(true);
                                                return;
                                            }
                                            parseText();
                                        }}
                                        disabled={!inputText || isLoadingFarmers || extractFarmersMutation.isPending}
                                        className={`text-white shadow-md transition-all hover:shadow-lg w-full sm:w-auto ${!isPro
                                            ? "bg-slate-700 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700"
                                            : "bg-gradient-to-r from-primary to-primary/80 hover:opacity-90"
                                            }`}
                                        size="lg"
                                    >
                                        {extractFarmersMutation.isPending ? (
                                            <>
                                                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                                Analyzing...
                                            </>
                                        ) : !isPro ? (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4 text-amber-300" />
                                                <span className="hidden sm:inline">Analyze with AI</span><span className="sm:hidden">Analyze</span> <Badge className="ml-2 bg-amber-400 text-amber-950 text-[10px] items-center px-1 h-4">PRO</Badge>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles className="mr-2 h-4 w-4" />
                                                <span className="hidden sm:inline">Analyze with AI</span><span className="sm:hidden">Analyze</span>
                                            </>
                                        )}
                                    </Button>
                                </div>
                            ) : (
                                <div className="flex flex-col-reverse sm:flex-row gap-3 w-full justify-between items-center">
                                    <Button variant="ghost" onClick={() => setStep("INPUT")} className="text-muted-foreground hover:text-foreground w-full sm:w-auto">
                                        Back to Input
                                    </Button>
                                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto justify-end">
                                        {parsedData.some(p => !p.matchedFarmerId) && (
                                            <Button
                                                variant="outline"
                                                onClick={handleCreateAll}
                                                disabled={isCreatingAll}
                                                className="w-full sm:w-auto border-primary/20 text-primary hover:bg-primary/5"
                                            >
                                                {isCreatingAll ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                                                <span className="hidden sm:inline">Create Missing ({parsedData.filter(p => !p.matchedFarmerId).length})</span>
                                                <span className="sm:hidden">Create ({parsedData.filter(p => !p.matchedFarmerId).length})</span>
                                            </Button>
                                        )}
                                        <Button
                                            onClick={() => {
                                                // Calculate properly inside the handler or use derived state
                                                const validToImport = parsedData.filter(p => p.matchedFarmerId && !p.isDuplicate && !p.stockAdded);
                                                if (validToImport.length === 0) {
                                                    // All items are either invalid or already processed (created with stock)
                                                    // If we are here and the button is enabled, it means all items are valid but processed.
                                                    handleOpenChangeWrapper(false);
                                                    return;
                                                }
                                                handleSubmit();
                                            }}
                                            disabled={
                                                bulkAddMutation.isPending ||
                                                parsedData.some(p => p.isDuplicate || !p.matchedFarmerId)
                                            }
                                            className="bg-primary hover:opacity-90 text-primary-foreground min-w-[140px] shadow-primary/20 shadow-lg w-full sm:w-auto"
                                            size="lg"
                                        >
                                            {bulkAddMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                                            {(() => {
                                                const count = parsedData.filter(p => p.matchedFarmerId && !p.isDuplicate && !p.stockAdded).length;
                                                if (count === 0) return "Done";
                                                return <><span className="hidden sm:inline">Import {count} Items</span><span className="sm:hidden">Import {count}</span></>;
                                            })()}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </DialogFooter>
                    </>
                )}
            </DialogContent>

        </Dialog>
    );
}
