"use client";

import { ProBlocker } from "@/components/pro-blocker";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";

interface ProAccessModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    feature?: string;
    description?: string;
}

export function ProAccessModal({
    open,
    onOpenChange,
    feature = "Premium Feature",
    description = "This feature is only available on the Pro plan."
}: ProAccessModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent aria-describedby="Pro Guard" className="p-0 border-none bg-transparent shadow-none w-full max-w-md outline-none sm:max-w-md" showCloseButton={true}>
                <div className="bg-background rounded-3xl overflow-hidden border border-border/50 shadow-2xl relative">
                    <DialogTitle><p></p></DialogTitle>
                    <ProBlocker feature={feature} description={description} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
