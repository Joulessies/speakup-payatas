import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

const ADMIN_PATHS = ["/admin", "/analytics"];
const STAFF_PATHS = ["/staff"];
const APP_PROTECTED_PATHS = [
    "/track",
    "/about",
    "/qr",
    "/dashboard",
    "/account",
    "/feedback",
    ...ADMIN_PATHS,
    ...STAFF_PATHS,
];

function isProtectedPath(pathname: string) {
    return APP_PROTECTED_PATHS.some((path) => (path === "/" ? pathname === "/" : pathname.startsWith(path)));
}

function isAdminPath(pathname: string) {
    return ADMIN_PATHS.some((path) => pathname.startsWith(path));
}

function isStaffPath(pathname: string) {
    return STAFF_PATHS.some((path) => pathname.startsWith(path));
}

export async function proxy(request: NextRequest) {
    const { pathname, search } = request.nextUrl;

    if (pathname.startsWith("/api") || pathname.startsWith("/_next") || pathname.includes(".")) {
        return NextResponse.next();
    }

    const hasBetterAuthSession = Boolean(getSessionCookie(request));
    const legacyToken = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const legacySession = legacyToken ? await verifyAuthToken(legacyToken) : null;

    const isAuthenticated = hasBetterAuthSession || Boolean(legacySession);

    if (pathname.startsWith("/login")) {
        if (isAuthenticated) {
            const destination =
                legacySession?.role === "admin"
                    ? "/admin/dashboard"
                    : legacySession?.role === "staff"
                      ? "/staff/dashboard"
                      : "/dashboard";
            return NextResponse.redirect(new URL(destination, request.url));
        }
        return NextResponse.next();
    }

    if (isProtectedPath(pathname) && !isAuthenticated) {
        const next = encodeURIComponent(`${pathname}${search}`);
        return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
    }

    if (legacySession) {
        if (isAdminPath(pathname) && legacySession.role !== "admin") {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
        if (isStaffPath(pathname) && legacySession.role !== "staff" && legacySession.role !== "admin") {
            return NextResponse.redirect(new URL("/dashboard", request.url));
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
