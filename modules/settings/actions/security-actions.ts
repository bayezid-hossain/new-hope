"use server";

import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export const getUserPasswordStatus = async () => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        return { hasPassword: false };
    }

    const accounts = await auth.api.listUserAccounts({
        headers: await headers(),
    });

    const hasPassword = accounts.some((account) => account.providerId === "credential");

    return { hasPassword };
};

export const setUserPassword = async ({ newPassword }: { newPassword: string }) => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        return { error: "Unauthorized" };
    }

    try {
        await auth.api.setPassword({
            headers: await headers(),
            body: {

                newPassword: newPassword
            }
        });
        return { success: true };
    } catch (e) {
        return { error: "Failed to set password" };
    }
};
