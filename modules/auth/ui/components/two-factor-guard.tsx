"use client";

import { authClient } from "@/lib/auth-client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export const TwoFactorGuard = ({ children }: { children: React.ReactNode }) => {
    const { data: session } = authClient.useSession();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        if (!session) return;

        const isTwoFactorEnabled = (session.user as any).twoFactorEnabled;
        const isTwoFactorVerified = (session.session as any).twoFactorVerified; // Primary check
        // Fallback check for UI persistence
        const isLocallyVerified = typeof window !== 'undefined' ? sessionStorage.getItem(`2fa_verified_${session.user.id}`) === "true" : false;

        const isVerified = isTwoFactorVerified || isLocallyVerified;

        if (isTwoFactorEnabled) {
            if (!isVerified) {
                if (!pathname.startsWith("/two-factor")) {
                    router.push("/two-factor");
                }
            } else {
                if (pathname.startsWith("/two-factor")) {
                    router.push("/");
                }
            }
        }
    }, [session, pathname, router]);

    return <>{children}</>;
};
