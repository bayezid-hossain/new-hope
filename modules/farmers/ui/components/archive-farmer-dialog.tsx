"use client";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trash2 } from "lucide-react";

interface ArchiveFarmerDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
    farmerName: string;
    isPending?: boolean;
}

export function ArchiveFarmerDialog({
    open,
    onOpenChange,
    onConfirm,
    farmerName,
    isPending
}: ArchiveFarmerDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                        <Trash2 className="h-5 w-5" />
                        Delete Farmer Profile
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild className="space-y-3 pt-2">
                        <div>
                            <p>
                                Are you sure you want to delete <span className="font-bold text-slate-900">"{farmerName}"</span>?
                            </p>
                            <div className="bg-amber-50 border border-amber-100 p-3 rounded-lg text-amber-800 text-xs leading-relaxed mt-3">
                                <strong>Note:</strong> This will hide the farmer from active lists and stop stock tracking, but their historical data will be preserved for managers and admins. You can restore them later if needed.
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm();
                        }}
                        disabled={isPending}
                        className="bg-red-600 hover:bg-red-700 text-white border-none"
                    >
                        {isPending ? "Deleting..." : "Delete Profile"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
