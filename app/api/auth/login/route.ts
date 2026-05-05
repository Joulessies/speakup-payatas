import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, getAllowedCredentials, signAuthPayload, type UserRole } from "@/lib/auth";
import {
    ensureSystemAccountsInDb,
    getUserByEmail,
    getUserByPhoneLast10,
    insertEmailUser,
    insertPhoneUser,
} from "@/lib/app-users";
import { verifyPassword, hashPassword } from "@/lib/password";
import { sendSemaphoreTransactionalSms } from "@/lib/semaphore";
import { verifySmsOtp } from "@/lib/sms-otp";

function getRedirectByRole(role: UserRole) {
    return role === "admin" ? "/admin" : role === "staff" ? "/staff" : "/";
}

function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

function isDuplicateKeyError(message: string) {
    return /duplicate key|unique constraint/i.test(message);
}

/** Fire-and-forget login / registration SMS to the user's registered PH mobile (stored as last 10 digits). */
function scheduleSignInNoticeSms(action: string, phoneLast10: string | null | undefined) {
    const digits = String(phoneLast10 ?? "").replace(/\D/g, "").slice(-10);
    if (!/^\d{10}$/.test(digits))
        return;
    const isRegister = action === "register";
    const custom = isRegister
        ? process.env.SEMAPHORE_REGISTRATION_NOTICE_MESSAGE?.trim()
        : process.env.SEMAPHORE_LOGIN_NOTICE_MESSAGE?.trim();
    const message =
        custom && custom.length > 0
            ? custom
            : isRegister
                ? "SpeakUp Payatas: Welcome! Your account was created."
                : "SpeakUp Payatas: Your account was signed in. If this was not you, change your password and contact barangay staff.";
    void sendSemaphoreTransactionalSms(digits, message).catch((err) => {
        console.error("[auth] sign-in notice SMS:", err instanceof Error ? err.message : err);
    });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const action = String(body?.action ?? "login").trim().toLowerCase();
        const method = String(body?.method ?? "email").trim().toLowerCase();
        const email = normalizeEmail(String(body?.email ?? ""));
        const emailPassword = String(body?.password ?? "").trim();
        const phone = String(body?.phone ?? "").replace(/\D/g, "").slice(-10);
        const registrationPhone = String(body?.registration_phone ?? "").replace(/\D/g, "").slice(-10);
        const otp = String(body?.otp ?? "").trim();

        const { adminEmail, staffEmail } = await ensureSystemAccountsInDb();

        // SMS auth/register flow (OTP in Supabase sms_otp_sessions; SMS via MessageBird / Semaphore / mock)
        if (method === "sms" && phone) {
            if (!/^\d{10}$/.test(phone)) {
                return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
            }
            if (!/^\d{6}$/.test(otp)) {
                return NextResponse.json({ error: "Invalid OTP. Enter the 6-digit code." }, { status: 401 });
            }
            const otpCheck = await verifySmsOtp(phone, otp);
            if (!otpCheck.ok) {
                return NextResponse.json({ error: otpCheck.error }, { status: 401 });
            }

            const existingSms = await getUserByPhoneLast10(phone);
            if (action === "register") {
                if (existingSms) {
                    return NextResponse.json({ error: "Phone number already registered." }, { status: 409 });
                }
                try {
                    await insertPhoneUser(phone);
                }
                catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    if (isDuplicateKeyError(msg)) {
                        return NextResponse.json({ error: "Phone number already registered." }, { status: 409 });
                    }
                    throw e;
                }
            }
            else if (!existingSms) {
                return NextResponse.json({ error: "Phone number not registered. Please register first." }, { status: 404 });
            }

            const token = await signAuthPayload({
                role: "user",
                username: `+63${phone}`,
                phone: `+63${phone}`,
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
        }

        // Email/password auth
        if (email) {
            if (!emailPassword || emailPassword.length < 6) {
                return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
            }

            const row = await getUserByEmail(email);

            if (action === "register") {
                if (email === adminEmail || email === staffEmail) {
                    return NextResponse.json({ error: "This email is reserved for system staff accounts." }, { status: 403 });
                }
                if (!/^\d{10}$/.test(registrationPhone)) {
                    return NextResponse.json({ error: "Enter a valid PH mobile number (10 digits, e.g. 9171234567)." }, { status: 400 });
                }
                if (row) {
                    return NextResponse.json({ error: "Email already registered." }, { status: 409 });
                }
                const phoneRow = await getUserByPhoneLast10(registrationPhone);
                if (phoneRow) {
                    return NextResponse.json({ error: "This mobile number is already registered." }, { status: 409 });
                }
                try {
                    const hash = await hashPassword(emailPassword);
                    await insertEmailUser(email, hash, "user", registrationPhone);
                }
                catch (e) {
                    const msg = e instanceof Error ? e.message : String(e);
                    if (isDuplicateKeyError(msg)) {
                        return NextResponse.json({
                            error: /phone|phone_e164/i.test(msg)
                                ? "This mobile number is already registered."
                                : "Email already registered.",
                        }, { status: 409 });
                    }
                    throw e;
                }
            }
            else {
                if (!row?.password_hash) {
                    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
                }
                const ok = await verifyPassword(emailPassword, row.password_hash);
                if (!ok) {
                    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
                }
            }

            const sessionRow = action === "register" ? await getUserByEmail(email) : row;
            if (!sessionRow) {
                return NextResponse.json({ error: "Unable to complete sign-in." }, { status: 500 });
            }

            const role = sessionRow.role;
            const token = await signAuthPayload({
                role,
                username: email,
                phone: sessionRow.phone_e164 ? `+63${sessionRow.phone_e164}` : undefined,
                exp: Date.now() + 1000 * 60 * 60 * 8,
            });
            scheduleSignInNoticeSms(action, sessionRow.phone_e164 ?? undefined);

            const res = NextResponse.json({
                success: true,
                role,
                redirect_to: getRedirectByRole(role),
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
        }

        // Legacy auth flow fallback
        const username = String(body?.username ?? "").trim();
        const password = String(body?.password ?? "").trim();
        const role = String(body?.role ?? "") as UserRole;
        const legacyPhone = String(body?.phone ?? "").trim();
        const legacyOtp = String(body?.otp ?? "").trim();
        if (!username && !legacyPhone) {
            return NextResponse.json({ error: "Username or phone required" }, { status: 400 });
        }
        if (role !== "admin" && role !== "staff" && role !== "user") {
            return NextResponse.json({ error: "Invalid role" }, { status: 400 });
        }
        if (role === "user" && legacyPhone) {
            if (legacyOtp.length !== 6 || !/^\d{6}$/.test(legacyOtp)) {
                return NextResponse.json({ error: "Invalid OTP. Enter the 6-digit code sent to your phone." }, { status: 401 });
            }
            const token = await signAuthPayload({
                role: "user",
                username: `+63${legacyPhone.replace(/\D/g, "").slice(-10)}`,
                phone: legacyPhone,
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
        }
        const credentials = getAllowedCredentials()[role];
        const userPasses = role === "admin" || role === "staff"
            ? username === credentials.username && password === credentials.password
            : username.length > 0;
        if (!userPasses) {
            return NextResponse.json({
                error: role === "admin" ? "Invalid admin credentials" : role === "staff" ? "Invalid staff credentials" : "Invalid username",
            }, { status: 401 });
        }
        const token = await signAuthPayload({
            role,
            username,
            exp: Date.now() + 1000 * 60 * 60 * 8,
        });
        const res = NextResponse.json({
            success: true,
            role,
            redirect_to: getRedirectByRole(role),
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
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid request body";
        const status = msg.includes("Missing Supabase configuration") ? 503 : 400;
        return NextResponse.json({ error: msg }, { status });
    }
}
