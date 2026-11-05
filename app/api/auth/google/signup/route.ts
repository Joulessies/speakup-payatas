import { NextResponse, type NextRequest } from "next/server";
import { getUserByEmail, getUserByPhoneLast10, insertGoogleUser } from "@/lib/app-users";
import {
    GOOGLE_OAUTH_COOKIE_PATH,
    GOOGLE_SIGNUP_COOKIE,
    getRedirectByRole,
    readGoogleSignupToken,
    setSessionCookie,
} from "@/lib/google-oauth";

const PHONE_TAKEN = "This mobile number is already registered. Sign in with Mobile OTP instead.";

function readSignup(request: NextRequest) {
    return readGoogleSignupToken(request.cookies.get(GOOGLE_SIGNUP_COOKIE)?.value);
}

function forgetSignup(res: NextResponse) {
    res.cookies.delete({ name: GOOGLE_SIGNUP_COOKIE, path: GOOGLE_OAUTH_COOKIE_PATH });
    return res;
}

/** `restart` tells the login page this sign-up can't continue, so the person has to choose Continue with Google again. */
function restart(error: string, status: number) {
    return forgetSignup(NextResponse.json({ error, restart: true }, { status }));
}

const expired = () => restart("Your Google sign-up timed out. Continue with Google again.", 401);
const emailTaken = () => restart("This email already has an account. Continue with Google again to sign in.", 409);

/** Which Google email is waiting for a mobile number. */
export async function GET(request: NextRequest) {
    const signup = await readSignup(request);
    return signup ? NextResponse.json({ email: signup.email }) : expired();
}

/** Creates the resident account with the mobile number, then signs it in. */
export async function POST(request: NextRequest) {
    const signup = await readSignup(request);
    if (!signup)
        return expired();
    const body = await request.json().catch(() => null);
    const phone = String(body?.phone ?? "").replace(/\D/g, "").slice(-10);
    if (!/^\d{10}$/.test(phone))
        return NextResponse.json({ error: "Enter a valid 10-digit PH mobile number (e.g., 09171234567)." }, { status: 400 });

    try {
        if (await getUserByEmail(signup.email))
            return emailTaken();
        if (await getUserByPhoneLast10(phone))
            return NextResponse.json({ error: PHONE_TAKEN }, { status: 409 });
        const user = await insertGoogleUser(signup.email, phone);
        const res = forgetSignup(NextResponse.json({ success: true, redirect_to: signup.next ?? getRedirectByRole(user.role) }));
        await setSessionCookie(res, { role: user.role, email: signup.email, phoneLast10: user.phone_e164 });
        return res;
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (/duplicate key|unique constraint/i.test(message))
            return /phone/i.test(message) ? NextResponse.json({ error: PHONE_TAKEN }, { status: 409 }) : emailTaken();
        console.error("[auth] Google sign-up:", message);
        return NextResponse.json({ error: "Couldn't create your account. Please try again." }, { status: 500 });
    }
}

/** Back on the sign-up step. */
export async function DELETE() {
    return forgetSignup(NextResponse.json({ success: true }));
}
