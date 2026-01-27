import { betterFetch } from "@better-fetch/fetch";
import type { Session, User } from "better-auth/types";
import { type NextRequest, NextResponse } from "next/server";

export default async function authMiddleware(request: NextRequest) {
    const { data: auth } = await betterFetch<{
        user: User;
        session: Session;
    }>(
        "/api/auth/get-session",
        {
            baseURL: request.nextUrl.origin,
            headers: {
                //get the cookie from the request
                cookie: request.headers.get("cookie") || "",
            },
        },
    );

    if (!auth) {
        return NextResponse.redirect(new URL("/sign-in", request.url));
    }

    if (!auth.user.emailVerified) {
        return NextResponse.redirect(new URL("/verify-email", request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sign-in|sign-up|forgot-password|reset-password|verify-email|two-factor).*)"],
};
