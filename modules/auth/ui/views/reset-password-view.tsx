"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertCircle, CheckCircle2, Loader2, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

const formSchema = z.object({
    password: z.string().min(8, { message: "Password must be at least 8 characters" }),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

export const ResetPasswordView = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get("token");

    const [isSuccess, setIsSuccess] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            password: "",
            confirmPassword: "",
        },
    });

    useEffect(() => {
        if (!token) {
            setError("Reset token is missing. Please request a new password reset link.");
        }
    }, [token]);

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (!token) return;

        setIsPending(true);
        setError(null);
        const { error } = await authClient.resetPassword({
            newPassword: data.password,
            token: token,
        });
        setIsPending(false);

        if (error) {
            setError(error.message || "Failed to reset password. The link may be expired.");
            toast.error("Failed to reset password");
        } else {
            setIsSuccess(true);
            toast.success("Password reset successfully!");
        }
    };

    if (isSuccess) {
        return (
            <Card className="max-w-md w-full mx-auto gradient-border">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Password Reset</CardTitle>
                    <CardDescription className="text-base mt-2">
                        Your password has been reset successfully. You can now log in with your new password.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <Button asChild className="w-full h-11">
                        <Link href="/sign-in">Return to Login</Link>
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <Card className="max-w-md w-full mx-auto overflow-hidden gradient-border">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold tracking-tight">Reset Password</CardTitle>
                    <CardDescription className="text-base mt-2">
                        Enter your new password below to reset your account access.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-2">
                    {error && (
                        <Alert variant="destructive" className="mb-6 bg-destructive/10 border-destructive/20 text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="password"
                                                    placeholder="*******"
                                                    className="pl-10 h-11"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm New Password</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    type="password"
                                                    placeholder="*******"
                                                    className="pl-10 h-11"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full h-11" disabled={isPending || !token}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Resetting...
                                    </>
                                ) : (
                                    "Reset Password"
                                )}
                            </Button>
                        </form>
                    </Form>

                    {!token && (
                        <Button asChild variant="ghost" className="w-full mt-4 h-11 hover:bg-muted">
                            <Link href="/forgot-password">Request new link</Link>
                        </Button>
                    )}
                </CardContent>
            </Card>

            <style jsx global>{`
        .gradient-border {
          position: relative;
          background: hsl(var(--card));
        }
        .gradient-border::before {
          content: "";
          position: absolute;
          inset: -1px;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(45deg, hsl(var(--primary) / 0.5), transparent, hsl(var(--primary) / 0.5));
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
      `}</style>
        </div>
    );
};
