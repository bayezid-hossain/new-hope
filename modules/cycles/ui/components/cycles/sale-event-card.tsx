"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { cn } from "@/lib/utils";
import type { SaleEvent } from "@/modules/shared/types/sale";
import { format } from "date-fns";
import {
    Check,
    CheckCircle2,
    ChevronDown,
    CircleDashed,
    ClipboardCopy,
    History,
    Pencil,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdjustSaleModal } from "./adjust-sale-modal";
import { SaleDetailsContent } from "./sale-details-content";
import { generateReportText } from "./sales-history-card";

export interface SaleEventCardProps {
    sale: SaleEvent;
    isLatest?: boolean;
    indexInGroup?: number;
    totalInGroup?: number;
    hideName?: boolean;
    selectedReportId: string | null;
    onReportSelect: (reportId: string | null) => void;
}

export const SaleEventCard = ({
    sale,
    isLatest,
    indexInGroup,
    totalInGroup,
    hideName = false,
    selectedReportId,
    onReportSelect
}: SaleEventCardProps) => {
    const { activeMode, role, canEdit } = useCurrentOrg();
    const [isExpanded, setIsExpanded] = useState(false);

    const reports = sale.reports || [];
    const hasReports = reports.length > 0;

    const activeReport = selectedReportId
        ? reports.find(r => r.id === selectedReportId) || null
        : (hasReports ? reports[0] : null);

    const displayBirdsSold = activeReport ? activeReport.birdsSold : sale.birdsSold;
    const displayTotalWeight = activeReport ? activeReport.totalWeight : sale.totalWeight;
    const displayAvgWeight = activeReport ? activeReport.avgWeight : sale.avgWeight;
    const displayPricePerKg = activeReport ? activeReport.pricePerKg : sale.pricePerKg;
    const displayTotalAmount = activeReport ? activeReport.totalAmount : sale.totalAmount;
    const displayMortality = (activeReport && activeReport.totalMortality !== undefined && activeReport.totalMortality !== null)
        ? activeReport.totalMortality
        : sale.totalMortality;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generateReportText(sale, activeReport, isLatest || false));
            setCopied(true);
            toast.success("Report copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy report");
        }
    };

    const [copied, setCopied] = useState(false);
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);
    const [showProfitModal, setShowProfitModal] = useState(false);
    const [showFcrEpiModal, setShowFcrEpiModal] = useState(false);

    return (
        <>
            <Card className="border-none shadow-none overflow-hidden gap-2 bg-transparent">
                <CardHeader className="pb-1 px-2 sm:px-4 bg-muted/20 cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => setIsExpanded(!isExpanded)}>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="text-sm font-semibold flex items-center gap-2 py-2">
                                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 text-muted-foreground/50", isExpanded && "rotate-180")} />
                                <span className="truncate">
                                    {(indexInGroup !== undefined && totalInGroup !== undefined)
                                        ? `Sale ${totalInGroup - indexInGroup}`
                                        : (hideName ? "Sale Record" : (sale.farmerName || sale.cycleName || "Sale Record"))}
                                </span>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <div className="shrink-0">
                                            {sale.cycleContext?.isEnded ? (
                                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                            ) : (
                                                <CircleDashed className="h-4 w-4 text-blue-500 animate-[spin_3s_linear_infinite]" />
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    <TooltipContent side="top">
                                        <p className="text-[10px]">{sale.cycleContext?.isEnded ? "Cycle Ended" : "Cycle Running"}</p>
                                    </TooltipContent>
                                </Tooltip>
                                {sale.location && (
                                    <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground bg-background shrink-0">
                                        {sale.location}{sale.party ? ` • ${sale.party}` : ""}
                                    </Badge>
                                )}
                            </CardTitle>
                            <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-muted-foreground ml-6">
                                <span className="font-medium text-foreground/80 lowercase">
                                    {displayBirdsSold} birds • <span className="text-emerald-600 dark:text-emerald-400 font-bold">৳{parseFloat(displayTotalAmount).toLocaleString()}</span>
                                </span>
                                <span className="text-muted-foreground/30">•</span>
                                <span>{format(new Date(sale.saleDate), "dd MMM, HH:mm")}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 w-full pt-1" onClick={(e) => e.stopPropagation()}>
                            {((activeMode === "OFFICER" || (!activeMode && role === "OFFICER")) && canEdit) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsAdjustOpen(true)}
                                    className="h-8 px-2 text-[11px] xs:text-xs"
                                >
                                    <Pencil className="h-3.5 w-3.5 mr-1" />
                                    Adjust
                                </Button>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleCopy}
                                className="h-8 px-2 text-[11px] xs:text-xs gap-1.5"
                                style={{ gridColumn: ((activeMode === "OFFICER" || (!activeMode && role === "OFFICER")) && canEdit) ? 'auto' : 'span 2' }}
                            >
                                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                                Copy
                            </Button>
                        </div>
                    </div>

                    {isExpanded && hasReports && (
                        <div className="flex items-center gap-2 mt-3 ml-8" onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground">
                                        <History className="h-3.5 w-3.5 mr-1.5" />
                                        {activeReport ? (
                                            `Version ${reports.length - reports.findIndex(r => r.id === activeReport.id)} • ${format(new Date(activeReport.createdAt), "dd/MM/yyyy HH:mm")} `
                                        ) : "Original"}
                                        <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="w-[260px]">
                                    <DropdownMenuLabel>Report Versions</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {reports.map((report, idx) => {
                                        const versionNum = reports.length - idx;
                                        return (
                                            <DropdownMenuItem
                                                key={report.id}
                                                onClick={() => onReportSelect(report.id)}
                                                className={cn(selectedReportId === report.id && "bg-muted font-medium")}
                                            >
                                                <div className="flex justify-between w-full items-center gap-2">
                                                    <div className="flex flex-col">
                                                        <span>Version {versionNum}</span>
                                                        <span className="text-[10px] text-muted-foreground">{format(new Date(report.createdAt), "dd/MM/yyyy HH:mm")}</span>
                                                    </div>
                                                    {selectedReportId === report.id && <Check className="h-3.5 w-3.5 text-primary" />}
                                                </div>
                                            </DropdownMenuItem>
                                        );
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )}

                    {isExpanded && activeReport?.adjustmentNote && (
                        <div className="mt-2 ml-8 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded px-2 py-1.5 text-xs text-muted-foreground italic">
                            Note: {activeReport.adjustmentNote}
                        </div>
                    )}
                </CardHeader>
                {isExpanded && (
                    <CardContent className="pt-4 px-2 sm:px-4 gap-2">
                        <SaleDetailsContent
                            sale={sale}
                            isLatest={isLatest}
                            displayBirdsSold={displayBirdsSold}
                            displayTotalWeight={displayTotalWeight}
                            displayAvgWeight={displayAvgWeight}
                            displayPricePerKg={displayPricePerKg}
                            displayTotalAmount={displayTotalAmount}
                            displayMortality={displayMortality}
                            selectedReport={activeReport}
                            setShowFcrEpiModal={setShowFcrEpiModal}
                            setShowProfitModal={setShowProfitModal}
                            showFcrEpiModal={showFcrEpiModal}
                            showProfitModal={showProfitModal}
                            isMobileView={true}
                        />
                    </CardContent>
                )}
            </Card>

            <AdjustSaleModal
                isOpen={isAdjustOpen}
                onClose={() => setIsAdjustOpen(false)}
                saleEvent={sale}
                latestReport={activeReport}
            />
        </>
    );
};
