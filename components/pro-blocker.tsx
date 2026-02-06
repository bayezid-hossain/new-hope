"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import Link from "next/link";

interface ProBlockerProps {
    feature?: string;
    description?: string;
}

export function ProBlocker({
    feature = "Premium Feature",
    description = "This feature is only available on the Pro plan."
}: ProBlockerProps) {
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
                        Upgrade your organization's plan to unlock unlimited access.
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center pb-8">
                    <Button asChild className="bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-purple-500/20">
                        <Link href="/settings/billing">
                            Upgrade to Pro
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
