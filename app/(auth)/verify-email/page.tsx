import { VerifyEmailView } from "@/modules/auth/ui/views/verify-email-view";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

export default function VerifyEmailPage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <VerifyEmailView />
        </Suspense>
    );
}
