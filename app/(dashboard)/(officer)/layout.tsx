import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

interface Props {
    children: React.ReactNode;
}

const OfficerLayout = async ({ children }: Props) => {
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

    // If in Management mode, redirect to management dashboard
    if (membership && (membership.role === "OWNER" || membership.role === "MANAGER") && membership.activeMode === "MANAGEMENT") {
        redirect("/management");
    }

    // User is in officer mode (or has no management rights), render children
    return <>{children}</>;
};

export default OfficerLayout;
