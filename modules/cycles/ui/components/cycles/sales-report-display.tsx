"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Copy, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface FeedItem {
    type: string;
    bags: number;
}

interface SaleReportData {
    saleDate: Date;
    farmerName: string;
    location: string;
    houseBirds: number;
    birdsSold: number;
    totalMortality: number;
    totalWeight: string;
    avgWeight: string;
    pricePerKg: string;
    totalAmount: string;
    depositReceived: string;
    cashReceived: string;
    feedConsumed: FeedItem[];
    feedStock: FeedItem[];
    medicineCost: string;
}

interface SalesReportDisplayProps {
    data: SaleReportData;
}

export const SalesReportDisplay = ({ data }: SalesReportDisplayProps) => {
    const [copied, setCopied] = useState(false);

    const formatDate = (date: Date) => {
        const d = new Date(date);
        return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
    };

    const formatNumber = (num: number | string) => {
        const n = typeof num === "string" ? parseFloat(num) : num;
        return n.toLocaleString();
    };

    // Generate text format for copying
    const generateReportText = () => {
        const feedLines = data.feedConsumed.map((f) => `${f.type}: ${f.bags} Bags`).join("\n");
        const stockLines = data.feedStock.length > 0
            ? data.feedStock.map((f) => `${f.type}: ${f.bags} Bags`).join("\n")
            : "None";

        return `Date: ${formatDate(data.saleDate)}

Farmer: ${data.farmerName}
Location: ${data.location}
House bird: ${formatNumber(data.houseBirds)}pcs
Total Sold: ${formatNumber(data.birdsSold)}pcs
Total Mortality: ${formatNumber(data.totalMortality)} pcs

Weight: ${formatNumber(data.totalWeight)} kg
Avg Weight: ${data.avgWeight} kg

Price: ${formatNumber(data.pricePerKg)} tk
Total taka: ${formatNumber(data.totalAmount)} tk
Deposit: ${formatNumber(data.depositReceived)} tk
Cash: ${formatNumber(data.cashReceived)} tk

Feed:
${feedLines}

Stock:
${stockLines}

Medicine: ${formatNumber(data.medicineCost)}`;
    };

    const handleCopy = async () => {
        const text = generateReportText();
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("Report copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("Failed to copy");
        }
    };

    return (
        <Card className="relative">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                        <FileText className="h-4 w-4" />
                        Sales Report
                    </CardTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="gap-2"
                    >
                        {copied ? (
                            <>
                                <Check className="h-4 w-4 text-green-600" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="h-4 w-4" />
                                Copy
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
                <div className="font-medium text-muted-foreground">
                    Date: {formatDate(data.saleDate)}
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div>Farmer:</div>
                    <div className="font-medium">{data.farmerName}</div>
                    <div>Location:</div>
                    <div className="font-medium">{data.location}</div>
                </div>

                <div className="border-t pt-2 grid grid-cols-2 gap-2">
                    <div>House bird:</div>
                    <div className="font-mono">{formatNumber(data.houseBirds)}pcs</div>
                    <div>Total Sold:</div>
                    <div className="font-mono font-bold text-primary">{formatNumber(data.birdsSold)}pcs</div>
                    <div>Total Mortality:</div>
                    <div className="font-mono text-red-600">{formatNumber(data.totalMortality)} pcs</div>
                </div>

                <div className="border-t pt-2 grid grid-cols-2 gap-2">
                    <div>Weight:</div>
                    <div className="font-mono">{formatNumber(data.totalWeight)} kg</div>
                    <div>Avg Wt:</div>
                    <div className="font-mono">{data.avgWeight}</div>
                </div>

                <div className="border-t pt-2 grid grid-cols-2 gap-2">
                    <div>Price:</div>
                    <div className="font-mono">{formatNumber(data.pricePerKg)} tk</div>
                    <div>Total taka:</div>
                    <div className="font-mono font-bold text-lg text-primary">{formatNumber(data.totalAmount)} tk</div>
                    <div>Deposit:</div>
                    <div className="font-mono">{formatNumber(data.depositReceived)} tk</div>
                    <div>Cash:</div>
                    <div className="font-mono">{formatNumber(data.cashReceived)} tk</div>
                </div>

                <div className="border-t pt-2">
                    <div className="font-medium mb-1">Feed:</div>
                    {data.feedConsumed.map((f, i) => (
                        <div key={i} className="font-mono text-muted-foreground">
                            {f.type}: {f.bags} Bags
                        </div>
                    ))}
                </div>

                <div className="border-t pt-2">
                    <div className="font-medium mb-1">Stock:</div>
                    {data.feedStock.length > 0 ? (
                        data.feedStock.map((f, i) => (
                            <div key={i} className="font-mono text-muted-foreground">
                                {f.type}: {f.bags} Bags
                            </div>
                        ))
                    ) : (
                        <div className="font-mono text-muted-foreground">None</div>
                    )}
                </div>

                <div className="border-t pt-2 flex justify-between">
                    <div>Medicine:</div>
                    <div className="font-mono">{formatNumber(data.medicineCost)}</div>
                </div>
            </CardContent>
        </Card>
    );
};
