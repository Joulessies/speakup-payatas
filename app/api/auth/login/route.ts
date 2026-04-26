import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAllowedCredentials,
  signAuthPayload,
  type UserRole,
} from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = String(body?.username ?? "").trim();
    const password = String(body?.password ?? "").trim();
    const role = String(body?.role ?? "") as UserRole;

    if (!username || (role !== "admin" && role !== "user")) {
      return NextResponse.json({ error: "Invalid login request" }, { status: 400 });
    }

    const credentials = getAllowedCredentials()[role];
    const userPasses =
      role === "admin"
        ? username === credentials.username && password === credentials.password
        : username.length > 0;

    if (!userPasses) {
      return NextResponse.json({ error: "Invalid username/password" }, { status: 401 });
    }

    const token = await signAuthPayload({
      role,
      username,
      exp: Date.now() + 1000 * 60 * 60 * 8, // 8 hours
    });

    const res = NextResponse.json({
      success: true,
      role,
      redirect_to: role === "admin" ? "/admin" : "/",
    });
    res.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
