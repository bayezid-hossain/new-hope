"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormMessage
} from "@/components/ui/form";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const formSchema = z.object({
    code: z.string().min(6, { message: "Verification code must be 6 digits" }).max(6),
});

export const VerifyEmailView = () => {
    const [isResending, setIsResending] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const { data: session } = authClient.useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const urlOtp = searchParams.get("otp");
    const urlEmail = searchParams.get("email");

    const email = urlEmail || session?.user?.email || "";

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            code: "",
        },
    });

    // Auto-verify if OTP and Email are in URL
    useEffect(() => {
        if (urlOtp && urlOtp.length === 6 && email && !isVerifying && !session?.user?.emailVerified) {
            form.setValue("code", urlOtp);
            onVerifyCode({ code: urlOtp });
        }
    }, [urlOtp, email, session]);

    // Polling to auto-detect verification (e.g., if verified in another tab)
    useEffect(() => {
        const interval = setInterval(async () => {
            if (!session?.user?.emailVerified) {
                await authClient.getSession();
            }
        }, 3000); // Check every 3 seconds

        return () => clearInterval(interval);
    }, [session]);

    useEffect(() => {
        if (session?.user?.emailVerified) {
            window.location.href = "/";
        }
    }, [session]);


    const handleResend = async () => {
        if (!email) {
            toast.error("Enter your email or log in to resend the code.");
            return;
        }
        setIsResending(true);
        const { error } = await authClient.sendVerificationEmail({
            email: email,
            callbackURL: window.location.origin + "/",
        });
        setIsResending(true); // Keep disabled for a bit to prevent spam
        setTimeout(() => setIsResending(false), 5000);

        if (error) {
            toast.error(error.message || "Failed to resend verification email");
        } else {
            toast.success("Verification email/code resent!");
        }
    };

    const handleLogout = async () => {
        await authClient.signOut();
        window.location.href = "/sign-in";
    };

    const onVerifyCode = async (data: z.infer<typeof formSchema>) => {
        if (isVerifying) return;
        if (!email) {
            toast.error("No email associated with this verification attempt.");
            return;
        }
        setIsVerifying(true);
        const { error } = await authClient.emailOtp.verifyEmail({
            email: email,
            otp: data.code,
        });

        if (error) {
            setIsVerifying(false);
            toast.error(error.message || "Invalid or expired code.");
            form.reset();
        } else {
            toast.success("Email verified successfully!");
            // If logged in, the polling/useEffect will handle it.
            // If not logged in, we should send them to sign-in.
            if (!session) {
                setTimeout(() => {
                    window.location.href = "/sign-in";
                }, 2000);
            }
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <Card className="max-w-md w-full mx-auto overflow-hidden gradient-border">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-500">
                        <ShieldCheck className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Verify your email</CardTitle>
                    <CardDescription className="text-base text-balance mt-2">
                        We&apos;ve sent a verification code and link to <span className="font-semibold text-foreground italic">{email}</span>. Please enter the code below or click the link to verify your account.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4 p-6 pt-2">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onVerifyCode)} className="flex flex-col gap-4 items-center w-full">
                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col items-center">
                                        <FormControl>
                                            <InputOTP
                                                maxLength={6}
                                                {...field}
                                            >
                                                <InputOTPGroup className="gap-2">
                                                    <InputOTPSlot index={0} className="h-11 w-9 md:h-12 md:w-10 text-lg border-primary/20" />
                                                    <InputOTPSlot index={1} className="h-11 w-9 md:h-12 md:w-10 text-lg border-primary/20" />
                                                    <InputOTPSlot index={2} className="h-11 w-9 md:h-12 md:w-10 text-lg border-primary/20" />
                                                    <InputOTPSlot index={3} className="h-11 w-9 md:h-12 md:w-10 text-lg border-primary/20" />
                                                    <InputOTPSlot index={4} className="h-11 w-9 md:h-12 md:w-10 text-lg border-primary/20" />
                                                    <InputOTPSlot index={5} className="h-11 w-9 md:h-12 md:w-10 text-lg border-primary/20" />
                                                </InputOTPGroup>
                                            </InputOTP>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                type="submit"
                                className="w-full h-11 bg-primary hover:bg-primary/90 transition-all font-semibold"
                                disabled={isVerifying}
                            >
                                {isVerifying ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    "Verify Code"
                                )}
                            </Button>
                        </form>
                    </Form>


                    <Button
                        onClick={handleResend}
                        variant="outline"
                        className="w-full h-11 border-primary/20 hover:bg-primary/5 hover:border-primary/50 transition-all font-semibold"
                        disabled={isResending}
                    >
                        {isResending ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Resending...
                            </>
                        ) : (
                            "Resend Code"
                        )}
                    </Button>

                    <div className="flex items-center gap-2 my-1">
                        <div className="h-[1px] bg-border flex-1" />
                        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">Or</span>
                        <div className="h-[1px] bg-border flex-1" />
                    </div>

                    <Button
                        onClick={handleLogout}
                        variant="ghost"
                        className="w-full h-11 hover:bg-destructive/5 hover:text-destructive transition-all"
                    >
                        <LogOut className="mr-2 h-4 w-4" />
                        Log Out and Change Account
                    </Button>
                </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground max-w-xs mx-auto text-balance">
                By verifying your email, you help us keep your account secure and ensure you receive important updates.
            </p>

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
