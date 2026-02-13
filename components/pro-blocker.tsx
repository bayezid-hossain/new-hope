"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useTRPC } from "@/trpc/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

interface ProBlockerProps {
    feature?: string;
    description?: string;
}

export function ProBlocker({
    feature = "Premium Feature",
    description = "This feature is only available on the Pro plan."
}: ProBlockerProps) {
    const trpc = useTRPC();
    const queryClient = useQueryClient();

    const { data: requestStatus, isLoading: isLoadingStatus } = useQuery(
        trpc.officer.getMyRequestStatus.queryOptions({ feature: "PRO_PACK" })
    );

    const requestMutation = useMutation(
        trpc.officer.requestAccess.mutationOptions({
            onSuccess: () => {
                toast.success("Pro access requested successfully!");
                queryClient.invalidateQueries(trpc.officer.getMyRequestStatus.pathFilter());
            },
            onError: (err) => {
                toast.error(`Request failed: ${err.message}`);
            }
        })
    );

    const isPending = requestStatus?.status === "PENDING";
    const isApproved = requestStatus?.status === "APPROVED";

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <Card className="w-full max-w-md border-2 border-dashed border-muted-foreground/20 shadow-none bg-muted/10">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Lock className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                        Pro Access Required
                    </CardTitle>
                    <CardDescription className="text-base text-center mt-2">
                        {feature} is a Pro feature.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-center text-muted-foreground">
                        {description} <br />
                        Upgrade your plan to unlock unlimited access.
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center pb-8">
                    {isLoadingStatus ? (
                        <Button disabled className="w-full sm:w-auto">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Checking status...
                        </Button>
                    ) : isPending ? (
                        <Button disabled className="w-full sm:w-auto bg-muted text-muted-foreground">
                            Request Pending
                        </Button>
                    ) : isApproved ? (
                        <Button disabled className="w-full sm:w-auto bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            Access Granted (Refresh)
                        </Button>
                    ) : (
                        <Button
                            onClick={() => requestMutation.mutate({ feature: "PRO_PACK" })}
                            disabled={requestMutation.isPending}
                            className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-purple-500/20 w-full sm:w-auto font-bold"
                        >
                            {requestMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Request Pro Access
                        </Button>
                    )}
                </CardFooter>
            </Card>
        </div>
    );
}
