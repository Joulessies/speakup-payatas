import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { AUTH_COOKIE_NAME, getAllowedCredentials, verifyAuthToken } from "@/lib/auth";
import { getUserByEmail, getUserByPhoneLast10 } from "@/lib/app-users";

async function getLegacyUser(username: string, role: "admin" | "staff" | "user") {
    if (username.includes("@")) {
        return getUserByEmail(username);
    }

    const phoneLast10 = username.replace(/\D/g, "").slice(-10);
    if (/^\d{10}$/.test(phoneLast10)) {
        return getUserByPhoneLast10(phoneLast10);
    }

    if (role === "admin" || role === "staff") {
        const credentials = getAllowedCredentials()[role];
        return getUserByEmail(`${credentials.username}@speakup.local`);
    }

    return null;
}

export async function GET(request: Request) {
    void request;

    try {
        const { auth } = await import("@/lib/better-auth");
        if (!auth) throw new Error("Better Auth database is not configured.");
        const betterSession = await auth.api.getSession({
            headers: await headers(),
        });
        if (betterSession?.user) {
            return NextResponse.json({
                authenticated: true,
                role: betterSession.user.role || "user",
                username: betterSession.user.name || betterSession.user.email,
                email: betterSession.user.email,
                id: betterSession.user.id,
            });
        }
    } catch {
    }

    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifyAuthToken(token);
    if (!session) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    let user = null;
    try {
        user = await getLegacyUser(session.username, session.role);
    } catch {
        // Authentication remains valid if the profile database is temporarily unavailable.
    }

    return NextResponse.json({
        authenticated: true,
        role: session.role,
        username: session.username,
        email: user?.email,
        id: user?.id,
        exp: session.exp,
    });
}
