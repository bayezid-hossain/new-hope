"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

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
    email: z.string().email({ message: "Please enter a valid email address" }),
});

export const ForgotPasswordView = () => {
    const [isSuccess, setIsSuccess] = useState(false);
    const [isPending, setIsPending] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: "",
        },
    });

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        setIsPending(true);
        const { error } = await authClient.requestPasswordReset({
            email: data.email,
            redirectTo: "/reset-password",
        });
        setIsPending(false);

        if (error) {
            toast.error(error.message || "Something went wrong. Please try again.");
        } else {
            setIsSuccess(true);
            toast.success("Reset link sent!");
        }
    };

    if (isSuccess) {
        return (
            <Card className="max-w-md w-full mx-auto gradient-border">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <CheckCircle2 className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold">Check your inbox</CardTitle>
                    <CardDescription className="text-base mt-2">
                        We&apos;ve sent a password reset link to <strong>{form.getValues("email")}</strong>.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-6 pt-2">
                    <Button asChild className="w-full h-11">
                        <Link href="/sign-in">Return to Login</Link>
                    </Button>
                    <p className="text-center text-sm text-muted-foreground">
                        Didn&apos;t receive the email?{" "}
                        <button
                            onClick={() => setIsSuccess(false)}
                            className="text-primary hover:underline font-medium"
                        >
                            Try another email
                        </button>
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <Card className="max-w-md w-full mx-auto overflow-hidden gradient-border">
                <CardHeader className="text-center pb-2">
                    <CardTitle className="text-2xl font-bold tracking-tight">Forgot password?</CardTitle>
                    <CardDescription className="text-base mt-2">
                        Enter your email and we&apos;ll send you a link to reset your password.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-2">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address</FormLabel>
                                        <FormControl>
                                            <div className="relative">
                                                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input
                                                    placeholder="name@example.com"
                                                    className="pl-10 h-11"
                                                    {...field}
                                                />
                                            </div>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full h-11" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Sending reset link...
                                    </>
                                ) : (
                                    "Send Reset Link"
                                )}
                            </Button>
                        </form>
                    </Form>

                    <Button asChild variant="ghost" className="w-full mt-4 h-11 hover:bg-muted">
                        <Link href="/sign-in" className="flex items-center justify-center">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Login
                        </Link>
                    </Button>
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
