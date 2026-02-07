"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { useTRPC } from "@/trpc/client";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, FileSpreadsheet, Loader2 } from "lucide-react";
import { useState } from "react";

export function ImportHistoryView() {
    const trpc = useTRPC();
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery(trpc.officer.stock.getImportHistory.infiniteQueryOptions(
        { limit: 10 },
        {
            getNextPageParam: (lastPage: any) => lastPage.nextCursor,
        }
    ));

    const batches = data?.pages.flatMap((page) => page.items) || [];

    const toggleExpand = (batchId: string) => {
        setExpandedBatchId(expandedBatchId === batchId ? null : batchId);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="grid gap-4">
                {isLoading ? (
                    <div className="flex flex-col gap-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-24 bg-muted/20 rounded-xl animate-pulse" />
                        ))}
                    </div>
                ) : batches.length === 0 ? (
                    <div className="text-center py-20 bg-muted/5 rounded-3xl border border-dashed border-muted/50">
                        <div className="mx-auto h-16 w-16 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                            <FileSpreadsheet className="h-8 w-8 text-muted-foreground/40" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground">No import history</h3>
                        <p className="text-muted-foreground mt-1">
                            You haven't performed any bulk imports yet.
                        </p>
                    </div>
                ) : (
                    batches.map((batch) => (
                        <Card key={batch.batchId} className="overflow-hidden border-muted/40 transition-all hover:border-primary/20">
                            <div
                                className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-muted/5"
                                onClick={() => toggleExpand(batch.batchId)}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                                        {expandedBatchId === batch.batchId ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-semibold text-lg">
                                                Import #{batch.batchId.slice(0, 8)}
                                            </h3>
                                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 text-xs">
                                                {batch.count} Farmers
                                            </Badge>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            {format(batch.createdAt, "PPP 'at' p")}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 sm:ml-auto">
                                    <div className="text-left sm:text-right">
                                        <p className="text-sm font-medium text-foreground">{batch.totalAmount.toLocaleString()} Bags</p>
                                        <p className="text-xs text-muted-foreground">Total Added</p>
                                    </div>
                                </div>
                            </div>

                            {expandedBatchId === batch.batchId && (
                                <div className="border-t bg-muted/5 p-4 sm:p-6 animate-in slide-in-from-top-2">
                                    <BatchDetails batchId={batch.batchId} />
                                </div>
                            )}
                        </Card>
                    ))
                )}

                {hasNextPage && (
                    <div className="flex justify-center pt-4">
                        <Button
                            variant="ghost"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                            className="text-muted-foreground"
                        >
                            {isFetchingNextPage ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Load older imports
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}

function BatchDetails({ batchId }: { batchId: string }) {
    const trpc = useTRPC();
    const { data: details, isLoading } = useQuery(trpc.officer.stock.getBatchDetails.queryOptions({ batchId }));

    if (isLoading) {
        return <div className="py-8 text-center text-sm text-muted-foreground">Loading details...</div>;
    }

    return (
        <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead>Farmer</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Note</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {details?.map((log) => (
                        <TableRow key={log.logId}>
                            <TableCell className="font-medium">{log.farmerName}</TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="font-mono">
                                    +{log.amount}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                                {log.note}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
