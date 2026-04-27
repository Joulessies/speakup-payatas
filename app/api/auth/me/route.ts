import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
export async function GET(request: Request) {
    void request;
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
