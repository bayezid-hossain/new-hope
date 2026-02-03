"use client";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { LogOut, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";

interface InactiveStateProps {
    orgName: string;
}

export const InactiveState = ({ orgName }: InactiveStateProps) => {
    const router = useRouter();

    const onLogout = () => {
        authClient.signOut({
            fetchOptions: {
                onSuccess: () => {
                    router.push("/sign-in");
                },
            },
        });
    };

    return (
        <div className="h-screen w-full flex items-center justify-center bg-muted/10 p-4">
            <div className="bg-card p-8 rounded-xl border shadow-sm max-w-md text-center space-y-6">
                <div className="bg-muted p-4 rounded-full w-fit mx-auto ring-8 ring-muted/50">
                    <UserMinus className="h-8 w-8 text-muted-foreground" />
                </div>

                <div className="space-y-2">
                    <h2 className="text-2xl font-semibold tracking-tight">Account Deactivated</h2>
                    <p className="text-muted-foreground text-sm">
                        Your access to <span className="font-medium text-foreground">{orgName}</span> has been temporarily deactivated by an administrator.
                    </p>
                </div>

                <div className="flex flex-col gap-2">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => {
                            window.location.reload();
                        }}
                    >
                        Check Again
                    </Button>
                    <Button variant="ghost" onClick={onLogout} className="w-full text-muted-foreground">
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                    </Button>
                </div>
            </div>
        </div>
    );
};
