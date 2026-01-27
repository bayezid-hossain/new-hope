import { ResetPasswordView } from "@/modules/auth/ui/views/reset-password-view";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        }>
            <ResetPasswordView />
        </Suspense>
    );
}
