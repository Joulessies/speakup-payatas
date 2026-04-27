import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
const APP_PROTECTED_PATHS = ["/", "/track", "/about", "/qr", "/admin", "/analytics"];
const ADMIN_PATHS = ["/admin", "/analytics"];
function isProtectedPath(pathname: string) {
    return APP_PROTECTED_PATHS.some((path) => path === "/" ? pathname === "/" : pathname.startsWith(path));
}
function isAdminPath(pathname: string) {
    return ADMIN_PATHS.some((path) => pathname.startsWith(path));
}
export async function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl;
    if (pathname.startsWith("/api"))
        return NextResponse.next();
    if (pathname.startsWith("/_next"))
        return NextResponse.next();
    if (pathname.includes("."))
        return NextResponse.next();
    const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
    const session = await verifyAuthToken(token);
    if (pathname.startsWith("/login")) {
        if (!session)
            return NextResponse.next();
        const redirectTo = session.role === "admin" ? "/admin" : "/";
        return NextResponse.redirect(new URL(redirectTo, request.url));
    }
    if (!isProtectedPath(pathname))
        return NextResponse.next();
    if (!session) {
        const next = encodeURIComponent(`${pathname}${search}`);
        return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
    }
    if (isAdminPath(pathname) && session.role !== "admin") {
        return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
}
export const config = {
    matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
