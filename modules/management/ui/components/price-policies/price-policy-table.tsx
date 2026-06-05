"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Pencil } from "lucide-react";
import type { PricePolicyFormValues } from "./price-policy-form";

export type PricePolicy = {
    id: string;
    organizationId: string;
    effectiveFrom: Date | string;
    feedPricePerBag: string;
    docPricePerBird: string;
    baseSellPrice: string;
    createdAt: Date | string;
    updatedAt: Date | string;
};

interface PricePolicyTableProps {
    policies: PricePolicy[];
    onEdit: (policy: PricePolicyFormValues & { id: string }) => void;
}

function formatDate(date: Date | string): string {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function findActivePolicyId(policies: PricePolicy[]): string | null {
    const today = new Date();
    // Policies are sorted newest-first; find the first one whose effectiveFrom <= today
    const active = policies.find((p) => {
        const d = typeof p.effectiveFrom === "string" ? new Date(p.effectiveFrom) : p.effectiveFrom;
        return d <= today;
    });
    return active?.id ?? null;
}

export function PricePolicyTable({ policies, onEdit }: PricePolicyTableProps) {
    const activePolicyId = findActivePolicyId(policies);

    if (policies.length === 0) {
        return (
            <div className="text-center py-16 bg-muted/5 rounded-3xl border border-dashed border-muted/50">
                <div className="mx-auto h-14 w-14 bg-muted/20 rounded-full flex items-center justify-center mb-4">
                    <Pencil className="h-6 w-6 text-muted-foreground/40" />
                </div>
                <h3 className="text-base font-medium text-foreground">No price policies yet</h3>
                <p className="text-muted-foreground mt-1 text-sm max-w-xs mx-auto">
                    Add a price policy to define feed, DOC, and sell prices for your organization.
                </p>
            </div>
        );
    }

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Effective From</TableHead>
                    <TableHead>Feed Price / Bag (৳)</TableHead>
                    <TableHead>DOC Price / Bird (৳)</TableHead>
                    <TableHead>Base Sell Price (৳)</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {policies.map((policy) => {
                    const isActive = policy.id === activePolicyId;
                    return (
                        <TableRow
                            key={policy.id}
                            className={
                                isActive
                                    ? "bg-emerald-50/60 dark:bg-emerald-950/20 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30"
                                    : undefined
                            }
                        >
                            <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                    {formatDate(policy.effectiveFrom)}
                                    {isActive && (
                                        <Badge
                                            variant="outline"
                                            className="text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-400 bg-emerald-500/10"
                                        >
                                            Active
                                        </Badge>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>৳{Number(policy.feedPricePerBag).toLocaleString()}</TableCell>
                            <TableCell>৳{Number(policy.docPricePerBird).toLocaleString()}</TableCell>
                            <TableCell>৳{Number(policy.baseSellPrice).toLocaleString()}</TableCell>
                            <TableCell className="text-right">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        onEdit({
                                            id: policy.id,
                                            effectiveFrom: policy.effectiveFrom,
                                            feedPricePerBag: policy.feedPricePerBag,
                                            docPricePerBird: policy.docPricePerBird,
                                            baseSellPrice: policy.baseSellPrice,
                                        })
                                    }
                                    className="gap-1.5"
                                >
                                    <Pencil className="h-3.5 w-3.5" />
                                    Edit
                                </Button>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
