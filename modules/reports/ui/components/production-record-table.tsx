"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";

export interface ProductionRecord {
    farmerId: string;
    farmerName: string;
    doc: number;
    survivalRate: number;
    averageWeight: number;
    fcr: number;
    epi: number;
    age: number;
    profit: number;
}

interface ProductionRecordTableProps {
    data: ProductionRecord[] | undefined;
    isLoading: boolean;
    monthName: string;
    year: number;
}

export function ProductionRecordTable({ data, isLoading, monthName, year }: ProductionRecordTableProps) {
    if (isLoading) {
        return (
            <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="text-center p-8 text-muted-foreground border rounded-lg bg-card mt-4">
                No production records found for {monthName} {year}.
            </div>
        );
    }

    // Calculate totals/averages for footer
    const totalDoc = data.reduce((sum, item) => sum + item.doc, 0);
    const totalProfit = data.reduce((sum, item) => sum + item.profit, 0);
    const avgFcr = data.length > 0 ? data.reduce((sum, item) => sum + item.fcr, 0) / data.length : 0;
    const avgEpi = data.length > 0 ? data.reduce((sum, item) => sum + item.epi, 0) / data.length : 0;
    const avgSurvival = data.length > 0 ? data.reduce((sum, item) => sum + item.survivalRate, 0) / data.length : 0;
    const avgWeight = data.length > 0 ? data.reduce((sum, item) => sum + item.averageWeight, 0) / data.length : 0;
    console.log(avgEpi)
    const formattedTotalProfit = totalProfit.toLocaleString('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 });

    return (
        <div className="border rounded-md overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px]">Farmer</TableHead>
                        <TableHead className="text-right">DOC</TableHead>
                        <TableHead className="text-right">Surv. %</TableHead>
                        <TableHead className="text-right">Avg Wt (kg)</TableHead>
                        <TableHead className="text-right">FCR</TableHead>
                        <TableHead className="text-right">EPI</TableHead>
                        <TableHead className="text-right">Age</TableHead>
                        <TableHead className="text-right">Net Profit</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((record) => (
                        <TableRow key={record.farmerId}>
                            <TableCell className="font-medium">{record.farmerName}</TableCell>
                            <TableCell className="text-right">{record.doc.toLocaleString()}</TableCell>
                            <TableCell className="text-right">{record.survivalRate.toFixed(1)}%</TableCell>
                            <TableCell className="text-right">{record.averageWeight.toFixed(3)}</TableCell>
                            <TableCell className="text-right font-mono">{record.fcr.toFixed(2)}</TableCell>
                            <TableCell className="text-right font-mono">{record.epi.toFixed(2)}</TableCell>
                            <TableCell className="text-right">{record.age.toFixed(1)}</TableCell>
                            <TableCell className={`text-right font-medium ${record.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {record.profit.toLocaleString('en-BD', { style: 'currency', currency: 'BDT', maximumFractionDigits: 0 })}
                            </TableCell>
                        </TableRow>
                    ))}
                    {/* Summary Row */}
                    <TableRow className="bg-muted/90 font-bold border-t-2">
                        <TableCell>Total / Avg</TableCell>
                        <TableCell className="text-right">{totalDoc.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{avgSurvival.toFixed(1)}%</TableCell>
                        <TableCell className="text-right">{avgWeight.toFixed(3)}</TableCell>
                        <TableCell className="text-right">{avgFcr.toFixed(2)}</TableCell>
                        <TableCell className="text-right">{avgEpi.toFixed(2)}</TableCell>
                        <TableCell className="text-right">-</TableCell>
                        <TableCell className={`text-right ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formattedTotalProfit}
                        </TableCell>
                    </TableRow>
                </TableBody>
            </Table>
        </div>
    );
}
