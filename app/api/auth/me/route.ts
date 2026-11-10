import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

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
    return NextResponse.json({
        authenticated: true,
        role: session.role,
        username: session.username,
        exp: session.exp,
    });
}
