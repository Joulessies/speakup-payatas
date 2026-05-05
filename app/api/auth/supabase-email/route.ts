import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, signAuthPayload } from "@/lib/auth";
import {
    ensureSystemAccountsInDb,
    getUserByEmail,
    getUserByPhoneLast10,
    insertEmailOtpUser,
    isReservedStaffEmail,
    updateAppUserPhoneLast10ById,
} from "@/lib/app-users";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

function parsePhoneLast10(raw: unknown): string | null {
    const digits = String(raw ?? "").replace(/\D/g, "").slice(-10);
    return /^\d{10}$/.test(digits) ? digits : null;
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const action = String(body?.action ?? "login").trim().toLowerCase();
        const accessToken = String(body?.accessToken ?? "").trim();
        const phoneLast10 = parsePhoneLast10(body?.phoneLast10 ?? body?.phone);
        if (!accessToken) {
            return NextResponse.json({ error: "Missing Supabase access token." }, { status: 400 });
        }
        if (!phoneLast10) {
            return NextResponse.json({ error: "Enter a valid PH mobile number (10 digits, e.g. 9171234567)." }, { status: 400 });
        }

        const { adminEmail, staffEmail } = await ensureSystemAccountsInDb();

        const supabase = getSupabaseAdmin();
        const { data: authData, error: authErr } = await supabase.auth.getUser(accessToken);
        if (authErr || !authData.user) {
            return NextResponse.json(
                { error: authErr?.message || "Unable to validate Supabase session." },
                { status: 401 },
            );
        }

        const emailRaw = authData.user.email ?? "";
        const email = normalizeEmail(emailRaw);
        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            return NextResponse.json({ error: "No valid email on Supabase user." }, { status: 401 });
        }

        if (email === adminEmail || email === staffEmail || isReservedStaffEmail(email)) {
            return NextResponse.json({ error: "Use staff credentials for this account." }, { status: 403 });
        }

        const existingUser = await getUserByEmail(email);
        if (action === "register") {
            if (existingUser) {
                return NextResponse.json({ error: "Email already registered." }, { status: 409 });
            }
            const phoneTaken = await getUserByPhoneLast10(phoneLast10);
            if (phoneTaken) {
                return NextResponse.json({ error: "This mobile number is already registered." }, { status: 409 });
            }
            try {
                await insertEmailOtpUser(email, phoneLast10);
            }
            catch (insErr) {
                const msg = insErr instanceof Error ? insErr.message : "";
                if (/duplicate key|unique constraint/i.test(msg)) {
                    return NextResponse.json({ error: "Email or mobile already registered." }, { status: 409 });
                }
                if (msg.includes("email_has_password") || msg.includes("check constraint")) {
                    return NextResponse.json({
                        error: "Database missing migration sql/008_app_users_email_otp_optional_password.sql — run it in Supabase SQL editor.",
                    }, { status: 503 });
                }
                throw insErr;
            }
        }
        else {
            if (!existingUser) {
                return NextResponse.json({ error: "Email not registered. Register first or use password sign-in." }, { status: 404 });
            }
            if (existingUser.phone_e164) {
                if (existingUser.phone_e164 !== phoneLast10) {
                    return NextResponse.json({ error: "Mobile number does not match this account." }, { status: 403 });
                }
            }
            else {
                try {
                    await updateAppUserPhoneLast10ById(existingUser.id, phoneLast10);
                }
                catch (e) {
                    const msg = e instanceof Error ? e.message : "";
                    if (msg.includes("already registered")) {
                        return NextResponse.json({ error: "This mobile number is already registered." }, { status: 409 });
                    }
                    throw e;
                }
            }
        }

        const sessionRow = await getUserByEmail(email);
        if (!sessionRow) {
            return NextResponse.json({ error: "Unable to load account." }, { status: 500 });
        }
        const role = sessionRow.role;
        const token = await signAuthPayload({
            role,
            username: email,
            phone: sessionRow.phone_e164 ? `+63${sessionRow.phone_e164}` : undefined,
            exp: Date.now() + 1000 * 60 * 60 * 8,
        });

        const redirectTo = role === "admin" ? "/admin" : role === "staff" ? "/staff" : "/";

        const res = NextResponse.json({ success: true, role, redirect_to: redirectTo });
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
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Unable to verify Supabase email login.";
        return NextResponse.json({ error: msg }, { status: 401 });
    }
}
