import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, signAuthPayload } from "@/lib/auth";
import { ensureSystemAccountsInDb, getUserByPhoneLast10, insertPhoneUser } from "@/lib/app-users";
import { getFirebaseAdminAuth } from "@/lib/firebase-admin";

function parsePhoneLast10(phoneE164: string): string | null {
    const digits = phoneE164.replace(/\D/g, "");
    const last10 = digits.slice(-10);
    return /^\d{10}$/.test(last10) ? last10 : null;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const action = String(body?.action ?? "login").trim().toLowerCase();
        const idToken = String(body?.idToken ?? "").trim();
        if (!idToken) {
            return NextResponse.json({ error: "Missing Firebase ID token." }, { status: 400 });
        }

        await ensureSystemAccountsInDb();

        const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
        const phoneNumber = decoded.phone_number ?? "";
        const phoneLast10 = parsePhoneLast10(phoneNumber);
        if (!phoneLast10) {
            return NextResponse.json({ error: "No valid phone number found in Firebase token." }, { status: 401 });
        }

        const existingUser = await getUserByPhoneLast10(phoneLast10);
        if (action === "register") {
            if (existingUser) {
                return NextResponse.json({ error: "Phone number already registered." }, { status: 409 });
            }
            await insertPhoneUser(phoneLast10);
        } else if (!existingUser) {
            return NextResponse.json({ error: "Phone number not registered. Please register first." }, { status: 404 });
        }

        const token = await signAuthPayload({
            role: "user",
            username: phoneNumber || `+63${phoneLast10}`,
            phone: phoneNumber || `+63${phoneLast10}`,
            exp: Date.now() + 1000 * 60 * 60 * 8,
        });

        const res = NextResponse.json({ success: true, role: "user", redirect_to: "/" });
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
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unable to verify Firebase phone auth.";
        return NextResponse.json({ error: msg }, { status: 401 });
    }
}
