"use client";

import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { toast } from "sonner";

interface RejectedStateProps {
    orgName: string;
}

export const RejectedState = ({ orgName }: RejectedStateProps) => {
    return (
        <div className="h-screen w-full flex items-center justify-center bg-muted/10 p-4">
             <div className="bg-card p-8 rounded-xl border shadow-sm max-w-md text-center space-y-6">
                <div className="bg-red-100 p-4 rounded-full w-fit mx-auto ring-8 ring-red-50">
                    <XCircle className="h-8 w-8 text-red-600" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-semibold tracking-tight">Request Rejected</h2>
                    <p className="text-muted-foreground text-sm">
                        Your request to join <span className="font-medium text-foreground">{orgName}</span> was declined.
                    </p>
                </div>

                <Button 
                    variant="destructive" 
                    className="w-full"
                    onClick={() => {
                        toast.info("Please contact your administrator.");
                        // Optional: Add logic here to leave the org and try again 
                        // if you have a 'leaveOrganization' mutation
                    }}
                >
                    Contact Support
                </Button>
            </div>
        </div>
    );
};