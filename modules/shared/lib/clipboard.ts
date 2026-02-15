"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

interface UseCopyToClipboardOptions {
    /** Duration in ms to keep `copied` as `true`. Default: 2000 */
    resetDelay?: number;
    /** Toast message shown on successful copy */
    successMessage?: string;
    /** Toast message shown on failure */
    errorMessage?: string;
}

/**
 * Hook that wraps `navigator.clipboard.writeText` with a
 * temporary `copied` flag and optional toast notifications.
 */
export function useCopyToClipboard(options: UseCopyToClipboardOptions = {}) {
    const {
        resetDelay = 2000,
        successMessage = "Copied to clipboard!",
        errorMessage = "Failed to copy",
    } = options;

    const [copied, setCopied] = useState(false);

    const copy = useCallback(
        async (text: string) => {
            try {
                await navigator.clipboard.writeText(text);
                setCopied(true);
                if (successMessage) toast.success(successMessage);
                setTimeout(() => setCopied(false), resetDelay);
                return true;
            } catch {
                if (errorMessage) toast.error(errorMessage);
                return false;
            }
        },
        [resetDelay, successMessage, errorMessage],
    );

    return { copied, copy } as const;
}
