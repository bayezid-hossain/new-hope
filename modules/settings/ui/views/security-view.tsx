"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { getUserPasswordStatus } from "@/modules/settings/actions/security-actions";
import { KeyRound, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const SecurityView = () => {
    const { data: session, isPending: isSessionPending } = authClient.useSession();

    const [hasPassword, setHasPassword] = useState<boolean | null>(null);

    const [isPending, setIsPending] = useState(false);
    const [currentPassword, setCurrentPassword] = useState("");

    // 2FA Verification State
    const [isVerifying2FA, setIsVerifying2FA] = useState(false);
    const [otp, setOtp] = useState("");

    // Dialog states
    const [is2FADialogOpen, setIs2FADialogOpen] = useState(false);

    useEffect(() => {
        const checkPassword = async () => {
            if (!session?.user) return;
            try {
                const status = await getUserPasswordStatus();
                setHasPassword(status.hasPassword);
            } catch (error) {
                console.error("Failed to check password status", error);
            }
        };
        checkPassword();
    }, [session]);

    const handleToggleTwoFactor = async () => {
        if (!currentPassword) {
            toast.error("Please enter your current password.");
            return;
        }

        setIsPending(true);
        const isEnabling = !session?.user.twoFactorEnabled;

        try {
            if (isEnabling) {
                const { error } = await authClient.twoFactor.enable({ password: currentPassword });
                if (error) {
                    toast.error(error.message);
                    setIsPending(false);
                } else {
                    await authClient.twoFactor.sendOtp();
                    setIsVerifying2FA(true);
                    setIsPending(false);
                    // Do not close dialog, waiting for OTP
                }
            } else {
                const { error } = await authClient.twoFactor.disable({ password: currentPassword });
                if (error) {
                    toast.error(error.message);
                } else {
                    toast.success("2FA disabled.");
                    setIs2FADialogOpen(false);
                    setCurrentPassword("");
                }
                setIsPending(false);
            }
        } catch (err) {
            toast.error("Something went wrong.");
            setIsPending(false);
        }
    };

    const handleVerifyOTP = async () => {
        if (!otp || otp.length !== 6) {
            toast.error("Please enter a valid 6-digit code.");
            return;
        }

        setIsPending(true);
        try {
            const { error } = await authClient.twoFactor.verifyOtp({
                code: otp,
            });

            if (error) {
                toast.error(error.message);
            } else {
                toast.success("Two-Factor Authentication Enabled!");
                setIs2FADialogOpen(false);
                setIsVerifying2FA(false);
                setOtp("");
                setCurrentPassword("");
            }
        } catch (err) {
            toast.error("Failed to verify OTP.");
        } finally {
            setIsPending(false);
        }
    };

    if (isSessionPending || hasPassword === null) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // If user has no password (social login only), hide security settings
    if (!hasPassword) {
        return (
            <div className="container max-w-4xl py-10">
                <div className="p-4 rounded-lg bg-muted text-muted-foreground text-center">
                    Security settings are not available for accounts logged in via social providers.
                </div>
            </div>
        );
    }

    const twoFactorEnabled = session?.user.twoFactorEnabled;

    return (
        <div className="container max-w-4xl py-10 space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Security Settings</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your account security and authentication methods.
                </p>
            </div>

            <div className="grid gap-6">
                <Card className="overflow-hidden border-primary/10 shadow-sm">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                        <div className={`p-3 rounded-xl ${twoFactorEnabled ? 'bg-green-500/10' : 'bg-amber-500/10'}`}>
                            {twoFactorEnabled ? (
                                <ShieldCheck className="h-6 w-6 text-green-600" />
                            ) : (
                                <ShieldAlert className="h-6 w-6 text-amber-600" />
                            )}
                        </div>
                        <div className="flex-1">
                            <CardTitle className="text-xl">Two-Factor Authentication</CardTitle>
                            <CardDescription>
                                Secure your account with email verification codes.
                            </CardDescription>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${twoFactorEnabled ? 'bg-green-500/20 text-green-700' : 'bg-amber-500/20 text-amber-700'}`}>
                            {twoFactorEnabled ? 'Active' : 'Inactive'}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-4 border-t border-primary/5">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium">Email OTP Verification</p>
                                <p className="text-sm text-muted-foreground max-w-md">
                                    When logging in from a new device, we&apos;ll send a one-time code to your email.
                                </p>
                            </div>

                            <Dialog open={is2FADialogOpen} onOpenChange={(open) => {
                                setIs2FADialogOpen(open);
                                if (!open) {
                                    // Reset state on close
                                    setIsVerifying2FA(false);
                                    setOtp("");
                                    setCurrentPassword("");
                                }
                            }}>
                                <DialogTrigger asChild>
                                    <Button variant={twoFactorEnabled ? "outline" : "default"}>
                                        {twoFactorEnabled ? "Disable 2FA" : "Enable 2FA"}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <KeyRound className="h-5 w-5 text-primary" />
                                            {isVerifying2FA ? "Verify Email Code" : "Confirm Change"}
                                        </DialogTitle>
                                        <DialogDescription>
                                            {isVerifying2FA
                                                ? "We sent a 6-digit code to your email. Please enter it below to enable 2FA."
                                                : `Enter your password to ${twoFactorEnabled ? "disable" : "enable"} two-factor authentication.`}
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-4 py-4 flex flex-col items-center">
                                        {isVerifying2FA ? (
                                            <InputOTP
                                                maxLength={6}
                                                value={otp}
                                                onChange={setOtp}
                                            >
                                                <InputOTPGroup>
                                                    <InputOTPSlot index={0} />
                                                    <InputOTPSlot index={1} />
                                                    <InputOTPSlot index={2} />
                                                </InputOTPGroup>
                                                <div className="w-2" />
                                                <InputOTPGroup>
                                                    <InputOTPSlot index={3} />
                                                    <InputOTPSlot index={4} />
                                                    <InputOTPSlot index={5} />
                                                </InputOTPGroup>
                                            </InputOTP>
                                        ) : (
                                            <div className="w-full space-y-2">
                                                <Label htmlFor="confirm-pass">Current Password</Label>
                                                <Input
                                                    id="confirm-pass"
                                                    type="password"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    onKeyDown={(e) => e.key === "Enter" && handleToggleTwoFactor()}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <DialogFooter>
                                        <Button variant="ghost" onClick={() => setIs2FADialogOpen(false)}>Cancel</Button>
                                        {isVerifying2FA ? (
                                            <Button onClick={handleVerifyOTP} disabled={isPending || otp.length !== 6}>
                                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Enable"}
                                            </Button>
                                        ) : (
                                            <Button
                                                onClick={handleToggleTwoFactor}
                                                disabled={isPending || !currentPassword}
                                                className={twoFactorEnabled ? "bg-destructive text-white hover:bg-destructive/90" : ""}
                                            >
                                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (twoFactorEnabled ? "Disable 2FA" : "Enable 2FA")}
                                            </Button>
                                        )}
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};