import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

interface Props {
    children: React.ReactNode;
}

const ManagementLayout = async ({ children }: Props) => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session?.user) {
        redirect("/sign-in");
    }

    // Check if user is in Management mode
    const { db } = await import("@/db");
    const { member } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    const membership = await db.query.member.findFirst({
        where: eq(member.userId, session.user.id),
    });

    // If not in Management mode, redirect to officer dashboard
    if (!membership || membership.activeMode !== "MANAGEMENT") {
        redirect("/");
    }

    // User is in management mode, render children
    return <>{children}</>;
};

export default ManagementLayout;
