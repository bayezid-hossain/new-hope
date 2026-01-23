"use client";

import { Button } from "@/components/ui/button";
import { Lock, RefreshCw } from "lucide-react";

interface PendingStateProps {
    orgName: string;
}

export const PendingState = ({ orgName }: PendingStateProps) => {
    return (
        <div className="h-screen w-full flex flex-col items-center justify-center gap-4 bg-muted/10 p-4">
            <div className="bg-card p-8 rounded-xl border shadow-sm max-w-md text-center space-y-6">
                <div className="bg-yellow-100 p-4 rounded-full w-fit mx-auto ring-8 ring-yellow-50">
                    <Lock className="h-8 w-8 text-yellow-600" />
                </div>
                
                <div className="space-y-2">
                    <h2 className="text-2xl font-semibold tracking-tight">Access Pending</h2>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                        You have requested to join <span className="font-medium text-foreground">{orgName}</span>. 
                        <br/>
                        An administrator needs to approve your request before you can access the dashboard.
                    </p>
                </div>

                <Button variant="outline" onClick={() => window.location.reload()} className="w-full">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Check Status
                </Button>
            </div>
        </div>
    );
};