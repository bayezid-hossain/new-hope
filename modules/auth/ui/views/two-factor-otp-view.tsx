"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    InputOTP,
    InputOTPGroup,
    InputOTPSlot,
} from "@/components/ui/input-otp";
import { authClient } from "@/lib/auth-client";

interface FormValues {
    code: string;
    trustDevice: boolean;
}

const formSchema = z.object({
    code: z.string().min(6, { message: "OTP must be 6 digits" }).max(6),
    trustDevice: z.boolean(),
});

export const TwoFactorOtpView = () => {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            code: "",
            trustDevice: false,
        },
    });

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        setIsPending(true);
        const { error } = await authClient.twoFactor.verifyOtp({
            code: data.code,
            trustDevice: data.trustDevice,
        });
        setIsPending(false);

        if (error) {
            toast.error(error.message || "Invalid or expired code.");
            form.reset();
        } else {
            toast.success("Identity verified!");
            router.push("/");
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <Card className="max-w-md w-full mx-auto overflow-hidden gradient-border">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <ShieldCheck className="h-8 w-8 text-primary" />
                    </div>
                    <CardTitle className="text-2xl font-bold tracking-tight">Two-Factor Auth</CardTitle>
                    <CardDescription className="text-base mt-2 text-balance">
                        We&apos;ve sent a verification code to your email. Please enter it below to continue.
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-6 pt-2 flex flex-col items-center">
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 flex flex-col items-center w-full">
                            <FormField
                                control={form.control}
                                name="code"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col items-center">
                                        <FormLabel className="sr-only">Verification Code</FormLabel>
                                        <FormControl>
                                            <InputOTP
                                                maxLength={6}
                                                {...field}
                                            >
                                                <InputOTPGroup className="gap-2">
                                                    <InputOTPSlot index={0} className="h-12 w-10 md:h-14 md:w-12 text-lg border-primary/20" />
                                                    <InputOTPSlot index={1} className="h-12 w-10 md:h-14 md:w-12 text-lg border-primary/20" />
                                                    <InputOTPSlot index={2} className="h-12 w-10 md:h-14 md:w-12 text-lg border-primary/20" />
                                                    <InputOTPSlot index={3} className="h-12 w-10 md:h-14 md:w-12 text-lg border-primary/20" />
                                                    <InputOTPSlot index={4} className="h-12 w-10 md:h-14 md:w-12 text-lg border-primary/20" />
                                                    <InputOTPSlot index={5} className="h-12 w-10 md:h-14 md:w-12 text-lg border-primary/20" />
                                                </InputOTPGroup>
                                            </InputOTP>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="trustDevice"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-2 space-y-0 w-full justify-start py-2">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel className="text-sm font-medium cursor-pointer">
                                                Trust this device for 30 days
                                            </FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />
                            <Button type="submit" className="w-full h-11" disabled={isPending}>
                                {isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Verifying...
                                    </>
                                ) : (
                                    "Verify & Continue"
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
