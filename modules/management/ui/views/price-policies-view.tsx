"use client";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { PricePolicyForm, type PricePolicyFormValues } from "../components/price-policies/price-policy-form";
import { PricePolicyTable } from "../components/price-policies/price-policy-table";

interface PricePoliciesViewProps {
    orgId: string;
}

type DialogState =
    | { mode: "closed" }
    | { mode: "create" }
    | { mode: "edit"; policy: PricePolicyFormValues & { id: string } };

export function PricePoliciesView({ orgId }: PricePoliciesViewProps) {
    const trpc = useTRPC();
    const [dialog, setDialog] = useState<DialogState>({ mode: "closed" });

    const { data: policies = [], isLoading } = useQuery(
        trpc.management.pricePolicies.list.queryOptions({ orgId })
    );

    const closeDialog = () => setDialog({ mode: "closed" });

    const isOpen = dialog.mode !== "closed";
    const isEditing = dialog.mode === "edit";
    const dialogTitle = isEditing ? "Edit Price Policy" : "Add New Policy";
    const dialogDescription = isEditing
        ? "Update the prices for this policy period."
        : "Set feed, DOC, and base sell prices for a new effective date.";

    return (
        <div className="flex-1 space-y-8 p-4 md:p-8 pt-2 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                        Price Policies
                    </h2>
                    <p className="text-muted-foreground">
                        Manage feed, DOC, and sell prices over time
                    </p>
                </div>
                <Button
                    onClick={() => setDialog({ mode: "create" })}
                    className="gap-2"
                >
                    <Plus className="h-4 w-4" />
                    Add New Policy
                </Button>
            </div>

            {/* Table */}
            {isLoading ? (
                <div className="py-16 text-center text-muted-foreground">
                    Loading price policies...
                </div>
            ) : (
                <PricePolicyTable
                    policies={policies}
                    onEdit={(policy) => setDialog({ mode: "edit", policy })}
                />
            )}

            {/* Create / Edit Dialog */}
            <Dialog open={isOpen} onOpenChange={(open) => !open && closeDialog()}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{dialogTitle}</DialogTitle>
                        <DialogDescription>{dialogDescription}</DialogDescription>
                    </DialogHeader>
                    <PricePolicyForm
                        orgId={orgId}
                        initialValues={dialog.mode === "edit" ? dialog.policy : undefined}
                        onSuccess={closeDialog}
                        onCancel={closeDialog}
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
