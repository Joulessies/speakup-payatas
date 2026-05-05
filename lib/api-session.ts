import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken, type UserRole } from "@/lib/auth";

export async function getSessionFromCookies() {
    const store = await cookies();
    return verifyAuthToken(store.get(AUTH_COOKIE_NAME)?.value);
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

/** Higher report list limits for dashboard routes (cookie sent on same-origin fetch). */
export async function getReportsListLimitCap(): Promise<number> {
    const session = await getSessionFromCookies();
    const role = session?.role as UserRole | undefined;
    if (role === "admin" || role === "staff")
        return 25000;
    return 100;
}
