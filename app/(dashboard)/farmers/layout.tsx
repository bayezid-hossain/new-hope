import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import React from "react";

interface Props {
    children: React.ReactNode;
}

const Layout = async ({ children }: Props) => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        redirect("/sign-in");
    }

    // Handle Mode-based redirection
    const { db } = await import("@/db");
    const { member, user: userTable } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");

    // Fetch full user and membership to check active modes
    const [userData, membership] = await Promise.all([
        db.query.user.findFirst({ where: eq(userTable.id, session.user.id) }),
        db.query.member.findFirst({ where: eq(member.userId, session.user.id) })
    ]);

    // Priority 1: System Admin Mode
    if (userData?.globalRole === "ADMIN" && userData?.activeMode === "ADMIN") {
        redirect("/admin");
    }

    // Priority 2: Management Mode
    if (membership && (membership.role === "OWNER" || membership.role === "MANAGER") && membership.activeMode === "MANAGEMENT") {
        redirect("/management");
    }

    return <>{children}</>;
};

export default Layout;
