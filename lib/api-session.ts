import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken, type UserRole } from "@/lib/auth";

export async function getSessionFromCookies(): Promise<
    | ({
          role: UserRole;
          username: string;
          email?: string;
          id?: string;
          exp: number;
      })
    | null
> {
    try {
        const { auth } = await import("@/lib/better-auth");
        if (!auth) throw new Error("Better Auth database is not configured.");
        const { headers } = await import("next/headers");
        const betterSession = await auth.api.getSession({
            headers: await headers(),
        });
        if (betterSession?.user && betterSession?.session) {
            return {
                role: (betterSession.user.role as UserRole) || "user",
                username: betterSession.user.name || betterSession.user.email,
                email: betterSession.user.email,
                id: betterSession.user.id,
                exp: new Date(betterSession.session.expiresAt).getTime(),
            };
        }
    } catch {
    }

    const store = await cookies();
    const legacy = await verifyAuthToken(store.get(AUTH_COOKIE_NAME)?.value);
    if (!legacy) return null;
    return legacy;
}

export async function requireAdminSession(): Promise<
    | { ok: true; role: "admin"; username: string }
    | { ok: false; response: NextResponse }
> {
    const session = await getSessionFromCookies();
    if (!session || session.role !== "admin") {
        return {
            ok: false,
            response: NextResponse.json({ error: "Admin access required." }, { status: 403 }),
        };
    }
    return { ok: true, role: "admin", username: session.username };
}

export function isStaffOrAdminRole(role: UserRole | string | undefined | null): role is "admin" | "staff" {
    return role === "admin" || role === "staff";
}

export async function requireStaffSession(): Promise<
    | { ok: true; role: "admin" | "staff"; username: string }
    | { ok: false; response: NextResponse }
> {
    const session = await getSessionFromCookies();
    if (!session || !isStaffOrAdminRole(session.role)) {
        return {
            ok: false,
            response: NextResponse.json({ error: "Staff or admin access required." }, { status: 403 }),
        };
    }
    return { ok: true, role: session.role, username: session.username };
}

export async function getReportsListLimitCap(): Promise<number> {
    const session = await getSessionFromCookies();
    const role = session?.role as UserRole | undefined;
    if (role === "admin" || role === "staff")
        return 25000;
    return 100;
}
