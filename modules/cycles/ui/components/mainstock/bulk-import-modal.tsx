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
import { AlertCircle, AlertTriangle, ArrowRight, Check, CheckCircle2, Edit2, Loader2, Plus, Search, Sparkles, User, X } from "lucide-react";
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
}

export function BulkImportModal({ open, onOpenChange, orgId }: BulkImportModalProps) {
    const [step, setStep] = useState<"INPUT" | "REVIEW">("INPUT");
    const [inputText, setInputText] = useState("");
    const [parsedData, setParsedData] = useState<ParsedItem[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

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
            toast.success(`Farmer "${data.name}" created!`);
            queryClient.invalidateQueries({ queryKey: [["officer", "farmers"]] });
            // We don't close modal, we update the matched row
            handleFarmerCreated(data.name, data.id);
        },
        onError: (err) => {
            toast.error(`Failed to create farmer: ${err.message}`);
        }
    }));

    const extractFarmersMutation = useMutation(trpc.officer.ai.extractFarmers.mutationOptions({
        onError: (err) => {
            toast.error(`Failed to analyze text: ${err.message}`);
        }
    }));

    const parseText = async () => {
        if (!farmersList?.items || !inputText.trim()) return;

        try {
            console.log("Parsing text:", inputText);
            // Prepare candidates for AI
            const candidates = farmersList.items.map(f => ({ id: f.id, name: f.name }));
            console.log("Candidates count:", candidates.length);

            const extractedData = await extractFarmersMutation.mutateAsync({
                text: inputText,
                candidates: candidates
            });

            console.log("AI Extracted Data:", extractedData);

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

                // Fallback: If AI explicitly returned null but confidence is LOW, maybe try simple exact client match?
                // Actually, let's trust the AI + Candidate list for now. output.

                return {
                    id: `row-${index}`,
                    rawName: nameCandidate,
                    cleanName: nameCandidate,
                    amount: totalAmount,
                    matchedFarmerId: matchedFarmer?.id || null,
                    matchedName: matchedFarmer?.name || null,
                    confidence: confidence,
                    suggestions: suggestions,
                    isDuplicate: false // Initial value
                };
            });

            console.log("Parsed Results:", results);

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
            // Error handled in mutation onError
        }
    };

    const calculateDuplicates = (items: ParsedItem[]): ParsedItem[] => {
        return items.map(item => {
            const count = items.filter(r => {
                // If both matched to same ID -> Duplicate
                if (item.matchedFarmerId && r.matchedFarmerId === item.matchedFarmerId) return true;
                // If neither matched but have same name -> Duplicate
                if (!item.matchedFarmerId && !r.matchedFarmerId && r.cleanName.toLowerCase() === item.cleanName.toLowerCase()) return true;
                return false;
            }).length;

            return { ...item, isDuplicate: count > 1 };
        });
    };

    // Client-side fuzzy (fallback for edits)
    const findBestMatch = (inputName: string, candidates: any[]) => {
        if (!candidates) return null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const exact = candidates.find((c: any) => c.name.toLowerCase() === inputName.toLowerCase());
        if (exact) return exact;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const partial = candidates.find((c: any) => c.name.toLowerCase().includes(inputName.toLowerCase()) || inputName.toLowerCase().includes(c.name.toLowerCase()));
        if (partial) return partial;
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
                    confidence: "HIGH" // User explicitly selected
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
                    suggestions: [] // Clear suggestions on manual edit
                } as ParsedItem;
            });
            return calculateDuplicates(updatedItems);
        });
    };

    const handleFarmerCreated = (name: string, newId: string) => {
        setParsedData(prev => {
            const updatedItems = prev.map(p => {
                if (p.cleanName.toLowerCase() === name.toLowerCase()) {
                    return {
                        ...p,
                        matchedFarmerId: newId,
                        matchedName: name,
                        confidence: "HIGH"
                    } as ParsedItem;
                }
                return p;
            });
            return calculateDuplicates(updatedItems);
        });
    };

    const [loadingRowIds, setLoadingRowIds] = useState<Set<string>>(new Set());

    const handleCreateClick = async (item: ParsedItem) => {
        if (!item.cleanName) return;

        setLoadingRowIds(prev => new Set(prev).add(item.id));
        try {
            await createFarmerMutation.mutateAsync({
                name: item.cleanName,
                initialStock: 0,
                orgId: orgId
            });
            // Success is handled by mutation callbacks
        } catch (error) {
            // Error is handled by mutation callbacks
        } finally {
            setLoadingRowIds(prev => {
                const next = new Set(prev);
                next.delete(item.id);
                return next;
            });
        }
    };

    const handleSubmit = () => {
        const payload = parsedData
            .filter(p => p.matchedFarmerId)
            .map(p => ({
                farmerId: p.matchedFarmerId!,
                amount: p.amount,
                note: `Bulk Import: ${p.rawName}`
            }));

        if (payload.length === 0) {
            toast.error("No valid matches found to import.");
            return;
        }

        bulkAddMutation.mutate(payload);
    };

    // --- PRO CHECK ---
    const { data: session } = authClient.useSession();
    const isPro = (session?.user as any)?.isPro || (session?.user as any)?.globalRole === "ADMIN";

    const requestAccessMutation = useMutation(trpc.officer.requestAccess.mutationOptions({
        onSuccess: () => {
            toast.success("Request sent! Admin will review shortly.");
        },
        onError: (err) => {
            toast.error(err.message);
        }
    }));

    const handleRequestAccess = () => {
        requestAccessMutation.mutate({ feature: "BULK_IMPORT" });
    };

    if (open && !isPro) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="w-[95vw] sm:max-w-md bg-white p-0 overflow-hidden rounded-2xl">
                    <div className="relative h-48 bg-slate-900 flex items-center justify-center overflow-hidden">
                        {/* Close Button for Pro Modal */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 z-20 text-white/70 hover:text-white hover:bg-white/10 rounded-full"
                            onClick={() => onOpenChange(false)}
                        >
                            <X className="h-5 w-5" />
                        </Button>

                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 to-purple-700 opacity-90" />
                        <div className="z-10 text-center text-white p-4">
                            <Sparkles className="h-10 w-10 mx-auto mb-2 text-amber-300" />
                            <h3 className="text-xl font-bold">Pro Feature</h3>
                        </div>
                        {/* Abstract Background Shapes */}
                        <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-500 rounded-full blur-3xl opacity-50" />
                        <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-indigo-500 rounded-full blur-3xl opacity-50" />
                    </div>

                    <div className="p-6 space-y-4">
                        <div className="text-center space-y-2">
                            <DialogTitle className="text-lg font-semibold text-slate-900">Bulk Stock Import</DialogTitle>
                            <DialogDescription className="text-sm text-slate-500">
                                Import thousands of farmer records in seconds using our AI-powered engine. Exclusive to Pro officers.
                            </DialogDescription>
                        </div>

                        <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 flex flex-col gap-2">
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span>Parse WhatsApp/SMS reports</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span>Auto-match existing farmers</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-slate-700">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span>Detect duplicates automatically</span>
                            </div>
                        </div>

                        <Button
                            onClick={handleRequestAccess}
                            disabled={requestAccessMutation.isPending}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg"
                        >
                            {requestAccessMutation.isPending ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                            Request Access
                        </Button>
                        <p className="text-xs text-center text-muted-foreground">
                            Usually approved within 24 hours.
                        </p>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    // --- END PRO CHECK ---

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {/* Mobile Responsive Classes: w-[95vw] h-[90vh] sm:max-w-4xl sm:h-[85vh] */}
            <DialogContent className="w-[95vw] h-[90vh] sm:max-w-4xl sm:h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-white/95 backdrop-blur-xl border border-white/20 shadow-2xl rounded-2xl">
                {/* Header */}
                <DialogHeader className="p-4 sm:p-6 pb-2 sm:pb-4 bg-gradient-to-r from-slate-50 to-white border-b sticky top-0 z-10 relative">
                    {/* Close Button for Main Modal */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-4 top-4 h-8 w-8 text-slate-500 hover:text-slate-900 bg-slate-100/50 hover:bg-slate-200/50 rounded-full"
                        onClick={() => onOpenChange(false)}
                    >
                        <X className="h-4 w-4" />
                    </Button>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pr-8">
                        <DialogTitle className="flex items-center gap-2.5 text-lg sm:text-xl font-bold text-slate-900">
                            <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div className="flex flex-col">
                                <span>Bulk Stock Import</span>
                                <span className="text-xs font-medium text-slate-500 font-normal">AI Powered Extraction</span>
                            </div>
                        </DialogTitle>
                        {step === "REVIEW" && (
                            <div className="flex gap-2 self-end sm:self-auto">
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs sm:text-sm">
                                    <CheckCircle2 className="w-3 h-3 mr-1" />
                                    {parsedData.filter(p => p.matchedFarmerId && !p.isDuplicate).length} Ready
                                </Badge>
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs sm:text-sm">
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
                <div className="flex-1 overflow-hidden bg-slate-50/50 relative">
                    {step === "INPUT" ? (
                        <div className="h-full flex flex-col p-4 sm:p-6 animate-in fade-in zoom-in-95 duration-300">
                            <div className="bg-white border rounded-xl shadow-sm p-1 flex-1 flex flex-col">
                                <Textarea
                                    placeholder={`Example:\nFarm No 1\nFarmer: Rabby Traders\nB2: 15 Bags\n\nFarm No 02\nAbdul Hamid...`}
                                    className="flex-1 border-0 focus-visible:ring-0 resize-none p-4 text-sm sm:text-base font-mono leading-relaxed bg-transparent"
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                />
                                <div className="p-2 border-t bg-slate-50 text-xs text-slate-400 flex justify-between items-center rounded-b-xl">
                                    <span>Paste your daily report text above</span>
                                    <span>{inputText.length} chars</span>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <ScrollArea className="h-full p-4 sm:p-6">
                            {parsedData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 min-h-[300px]">
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
                                                ${row.isDuplicate ? "bg-red-50/50 border-red-100" :
                                                    !row.matchedFarmerId ? "bg-amber-50/30 border-amber-100" : "bg-white border-slate-100 hover:border-emerald-200"}
                                            `}
                                        >
                                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                                                {/* Top Row (Mobile): User Info */}
                                                <div className="flex items-center gap-4 w-full sm:w-auto">
                                                    {/* Icon Status */}
                                                    <div className="shrink-0">
                                                        {row.isDuplicate ? (
                                                            <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
                                                                <AlertTriangle className="h-5 w-5" />
                                                            </div>
                                                        ) : row.matchedFarmerId ? (
                                                            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 relative">
                                                                <Check className="h-5 w-5" />
                                                                {row.confidence === "HIGH" && (
                                                                    <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm border">
                                                                        <Sparkles className="h-3 w-3 text-amber-500" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                                                                <Search className="h-5 w-5" />
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Input / Name */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">
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
                                                                <h3 className="font-semibold text-slate-800 text-lg truncate">
                                                                    {row.cleanName}
                                                                </h3>
                                                                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditingId(row.id)}>
                                                                    <Edit2 className="h-3 w-3 text-slate-400 hover:text-blue-500" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Middle Arrow (Hidden on Mobile) */}
                                                <div className="hidden sm:block text-slate-300">
                                                    <ArrowRight className="h-5 w-5" />
                                                </div>

                                                {/* Match Status / Action */}
                                                <div className="flex-1 w-full sm:w-auto min-w-0 pl-[56px] sm:pl-0 mt-2 sm:mt-0">
                                                    {row.matchedFarmerId ? (
                                                        <div className="p-2.5 rounded-lg bg-emerald-50/50 border border-emerald-100/50 flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <div className="h-8 w-8 rounded-full bg-emerald-200 text-emerald-800 flex items-center justify-center text-xs font-bold">
                                                                    <User className="h-4 w-4" />
                                                                </div>
                                                                <div>
                                                                    <p className="text-sm font-semibold text-emerald-900">{row.matchedName}</p>
                                                                    <p className="text-[10px] text-emerald-600 font-medium uppercase tracking-wide">Database Match</p>
                                                                </div>
                                                            </div>
                                                            <Badge className="bg-emerald-200 text-emerald-900 hover:bg-emerald-300 border-0 h-6">
                                                                +{row.amount} Bags
                                                            </Badge>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-2">
                                                            <div className="flex items-center justify-between gap-3">
                                                                <div className="flex flex-col">
                                                                    <span className="text-sm font-medium text-amber-700">No Match Found</span>
                                                                    <span className="text-xs text-amber-600/70">Create new or select suggestion</span>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge variant="outline" className="bg-white text-slate-600 px-2 h-7 font-mono border-slate-200">
                                                                        +{row.amount}
                                                                    </Badge>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="default"
                                                                        className="h-8 bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                                                                        onClick={() => handleCreateClick(row)}
                                                                        disabled={loadingRowIds.has(row.id)}
                                                                    >
                                                                        {loadingRowIds.has(row.id) ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                                                                        Create
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            {/* AI Suggestions */}
                                                            {row.suggestions && row.suggestions.length > 0 && (
                                                                <div className="flex flex-wrap gap-2 mt-1">
                                                                    <span className="text-xs text-slate-400 font-medium py-1">Did you mean:</span>
                                                                    {row.suggestions.map(s => (
                                                                        <Badge
                                                                            key={s.id}
                                                                            variant="secondary"
                                                                            className="cursor-pointer hover:bg-blue-100 hover:text-blue-700 transition-colors border border-transparent hover:border-blue-200"
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
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="p-4 sm:p-6 bg-white border-t z-10">
                    {step === "INPUT" ? (
                        <div className="w-full flex justify-end">
                            <Button
                                onClick={parseText}
                                disabled={!inputText || isLoadingFarmers || extractFarmersMutation.isPending}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-md transition-all hover:shadow-lg w-full sm:w-auto"
                                size="lg"
                            >
                                {extractFarmersMutation.isPending ? (
                                    <>
                                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Analyze with AI
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="flex flex-col-reverse sm:flex-row gap-3 w-full justify-between items-center">
                            <Button variant="ghost" onClick={() => setStep("INPUT")} className="text-slate-500 hover:text-slate-900 w-full sm:w-auto">
                                Back to Input
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={
                                    bulkAddMutation.isPending ||
                                    parsedData.some(p => p.isDuplicate || !p.matchedFarmerId)
                                }
                                className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[140px] shadow-emerald-200 shadow-lg w-full sm:w-auto"
                                size="lg"
                            >
                                {bulkAddMutation.isPending && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
                                Import {parsedData.filter(p => p.matchedFarmerId && !p.isDuplicate).length} Items
                            </Button>
                        </div>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
