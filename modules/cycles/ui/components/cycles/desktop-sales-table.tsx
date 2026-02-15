"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DOC_PRICE_PER_BIRD, FEED_PRICE_PER_BAG } from "@/constants";
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
    MoreHorizontal,
    Pencil,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AdjustSaleModal } from "./adjust-sale-modal";
import { SaleDetailsContent } from "./sale-details-content";
import { generateReportText } from "./sales-history-card";

export const DesktopSalesTable = ({
    sales,
    selectedReports,
    onReportSelect,
    hideFarmerName = false
}: {
    sales: SaleEvent[];
    selectedReports: Record<string, string | null>;
    onReportSelect: (saleId: string, reportId: string | null) => void;
    hideFarmerName?: boolean;
}) => {
    return (
        <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent border-b-none">
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="w-[120px]">Date</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead className="text-right">Age</TableHead>
                            <TableHead className="text-right">DOC</TableHead>
                            <TableHead className="text-right font-semibold">Sold</TableHead>
                            <TableHead className="text-right">Mortality</TableHead>
                            <TableHead className="text-right">Weight</TableHead>
                            <TableHead className="text-right font-bold text-emerald-600">Total</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                            <TableHead className="text-right">FCR/EPI</TableHead>
                            <TableHead className="w-[80px] text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sales.map((sale, index) => (
                            <DesktopSaleRow
                                key={sale.id}
                                sale={sale}
                                isLatest={(sale as any).isLatestInCycle ?? (index === 0)}
                                selectedReportId={selectedReports[sale.id] || null}
                                onReportSelect={(reportId) => onReportSelect(sale.id, reportId)}
                                hideFarmerName={hideFarmerName}
                            />
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

const DesktopSaleRow = ({
    sale,
    isLatest,
    selectedReportId,
    onReportSelect,
    hideFarmerName = false
}: {
    sale: SaleEvent;
    isLatest: boolean;
    selectedReportId: string | null;
    onReportSelect: (reportId: string | null) => void;
    hideFarmerName?: boolean;
}) => {
    const { activeMode, role, canEdit } = useCurrentOrg();
    const [isAdjustOpen, setIsAdjustOpen] = useState(false);

    // Logic for reports/versions
    const reports = sale.reports || [];
    const hasReports = reports.length > 0;
    const activeReport = selectedReportId ? reports.find(r => r.id === selectedReportId) || null : (hasReports ? reports[0] : null);

    const displayBirdsSold = activeReport ? activeReport.birdsSold : sale.birdsSold;
    const displayTotalWeight = activeReport ? activeReport.totalWeight : sale.totalWeight;
    const displayAvgWeight = activeReport ? activeReport.avgWeight : sale.avgWeight;
    const displayPricePerKg = activeReport ? activeReport.pricePerKg : sale.pricePerKg;
    const displayTotalAmount = activeReport ? activeReport.totalAmount : sale.totalAmount;
    const displayMortality = (activeReport && activeReport.totalMortality !== undefined && activeReport.totalMortality !== null)
        ? activeReport.totalMortality : sale.totalMortality;

    // Modals state for details view
    const [showProfitModal, setShowProfitModal] = useState(false);
    const [showFcrEpiModal, setShowFcrEpiModal] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(generateReportText(sale, activeReport, isLatest || false));
            toast.success("Report copied!");
        } catch {
            toast.error("Failed to copy");
        }
    };

    const [isExpanded, setIsExpanded] = useState(false);

    return (
        <>
            <TableRow className={cn("group cursor-pointer hover:bg-muted/10 transition-colors", isExpanded && "bg-muted/5 border-b-0")} onClick={() => setIsExpanded(!isExpanded)}>
                <TableCell className="py-3">
                    <ChevronDown className={cn("h-4 w-4 transition-transform duration-200 text-muted-foreground/50", isExpanded && "rotate-180")} />
                </TableCell>
                <TableCell className="font-medium py-3">
                    <div className="flex flex-col">
                        <span className="text-sm">{format(new Date(sale.saleDate), "dd MMM, yyyy")}</span>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(sale.saleDate), "HH:mm")}</span>
                        {activeReport && (
                            <Badge variant="outline" className="mt-1 w-fit text-[9px] h-3.5 px-1 font-normal">
                                v{reports.length - reports.findIndex(r => r.id === activeReport.id)}
                            </Badge>
                        )}
                    </div>
                </TableCell>
                <TableCell className="py-3">
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                            {!hideFarmerName ? (
                                <span className="font-semibold text-sm truncate max-w-[150px]">{sale.farmerName || sale.cycleName}</span>
                            ) : (
                                <span className="font-semibold text-sm text-muted-foreground/50 italic">Sale Record</span>
                            )}
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <div className="shrink-0 cursor-help">
                                        {sale.cycleContext?.isEnded ? (
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                        ) : (
                                            <CircleDashed className="h-3.5 w-3.5 text-blue-500 animate-[spin_3s_linear_infinite]" />
                                        )}
                                    </div>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                    <p className="text-[10px]">{sale.cycleContext?.isEnded ? "Cycle Ended" : "Cycle Running"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </div>
                        {sale.location && (
                            <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">
                                {sale.location} {sale.party && `• ${sale.party}`}
                            </span>
                        )}
                    </div>
                </TableCell>
                <TableCell className="text-right py-3 tabular-nums font-medium">{sale.cycleContext?.age || "N/A"}d</TableCell>
                <TableCell className="text-right py-3 tabular-nums text-muted-foreground">{sale.cycleContext?.doc?.toLocaleString() || sale.houseBirds?.toLocaleString()}</TableCell>
                <TableCell className="text-right py-3 tabular-nums font-bold text-foreground">{displayBirdsSold.toLocaleString()}</TableCell>
                <TableCell className="text-right py-3 tabular-nums text-red-500/80 font-medium">{displayMortality}</TableCell>
                <TableCell className="text-right py-3 tabular-nums">{parseFloat(displayTotalWeight).toLocaleString()} kg</TableCell>
                <TableCell className="text-right py-3 tabular-nums font-bold text-emerald-600">৳{parseFloat(displayTotalAmount).toLocaleString()}</TableCell>
                <TableCell className="text-right py-3 tabular-nums font-bold text-emerald-600">
                    {isLatest && sale.cycleContext?.isEnded ? (
                        (() => {
                            const formulaRevenue = sale.cycleContext.revenue || parseFloat(displayTotalAmount);
                            const totalFeedBags = sale.cycleContext.feedConsumed ?? 0;
                            const doc = sale.cycleContext.doc || sale.houseBirds || 0;
                            const feedCost = totalFeedBags * FEED_PRICE_PER_BAG;
                            const docCost = doc * DOC_PRICE_PER_BIRD;
                            const profit = formulaRevenue - (feedCost + docCost);
                            return `৳${profit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
                        })()
                    ) : "-"}
                </TableCell>
                <TableCell className="text-right py-3 tabular-nums font-medium text-blue-600 dark:text-blue-400">
                    {isLatest && sale.cycleContext?.isEnded ? `${sale.cycleContext.fcr} / ${sale.cycleContext.epi}` : "-"}
                </TableCell>
                <TableCell className="text-right py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                                    <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={handleCopy}>
                                    <ClipboardCopy className="h-4 w-4 mr-2" /> Copy Report
                                </DropdownMenuItem>
                                {hasReports && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuLabel className="text-[10px] uppercase font-bold text-muted-foreground/50 px-2 py-1">Versions</DropdownMenuLabel>
                                        {reports.map((report, idx) => (
                                            <DropdownMenuItem key={report.id} onClick={() => onReportSelect(report.id)}>
                                                <div className="flex justify-between w-full items-center gap-2">
                                                    <span>Version {reports.length - idx}</span>
                                                    {selectedReportId === report.id && <Check className="h-3 w-3" />}
                                                </div>
                                            </DropdownMenuItem>
                                        ))}
                                    </>
                                )}
                                {((activeMode === "OFFICER" || (!activeMode && role === "OFFICER")) && canEdit) && (
                                    <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onClick={() => setIsAdjustOpen(true)}>
                                            <Pencil className="h-4 w-4 mr-2" /> Adjust Sale
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </TableCell>
            </TableRow>

            {/* Expanded Row Content */}
            {isExpanded && (
                <TableRow className="bg-muted/5 border-b hover:bg-transparent">
                    <TableCell colSpan={12} className="p-0">
                        <div className="px-6 lg:px-14 py-6 border-l-2 border-primary/20 bg-gradient-to-r from-background to-transparent animate-in slide-in-from-top-2 duration-200">
                            <div className="w-full">
                                <SaleDetailsContent
                                    sale={sale}
                                    isLatest={isLatest}
                                    displayBirdsSold={displayBirdsSold}
                                    displayTotalWeight={displayTotalWeight}
                                    displayAvgWeight={displayAvgWeight}
                                    displayPricePerKg={displayPricePerKg}
                                    displayTotalAmount={displayTotalAmount}
                                    displayMortality={displayMortality}
                                    setShowFcrEpiModal={setShowFcrEpiModal}
                                    setShowProfitModal={setShowProfitModal}
                                    showFcrEpiModal={showFcrEpiModal}
                                    showProfitModal={showProfitModal}
                                    isMobileView={false}
                                />
                            </div>
                        </div>
                    </TableCell>
                </TableRow>
            )}
            <AdjustSaleModal
                isOpen={isAdjustOpen}
                onClose={() => setIsAdjustOpen(false)}
                saleEvent={sale}
                latestReport={activeReport}
            />
        </>
    )
}
