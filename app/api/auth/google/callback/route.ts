import { NextResponse, type NextRequest } from "next/server";
import { getUserByEmail } from "@/lib/app-users";
import {
    GOOGLE_OAUTH_COOKIE,
    GOOGLE_OAUTH_COOKIE_PATH,
    GOOGLE_SIGNUP_COOKIE,
    GOOGLE_SIGNUP_MAX_AGE,
    buildLoginUrl,
    createGoogleSignupToken,
    fetchGoogleIdentity,
    getGoogleOAuthConfig,
    getGoogleRedirectUri,
    getRedirectByRole,
    readGoogleOAuthState,
    setSessionCookie,
} from "@/lib/google-oauth";

/** Google sends the browser back here. Signs into the account with the same email, or starts a resident sign-up. */
export async function GET(request: NextRequest) {
    const attempt = readGoogleOAuthState(request.cookies.get(GOOGLE_OAUTH_COOKIE)?.value);
    const redirectTo = (url: URL) => {
        const res = NextResponse.redirect(url);
        res.cookies.delete({ name: GOOGLE_OAUTH_COOKIE, path: GOOGLE_OAUTH_COOKIE_PATH });
        return res;
    };
    const fail = (code: string, extra: Record<string, string> = {}) =>
        redirectTo(buildLoginUrl(request.url, { error: code, next: attempt?.next, ...extra }));

    const config = getGoogleOAuthConfig();
    if (!config)
        return fail("google_not_configured");
    const params = request.nextUrl.searchParams;
    const googleError = params.get("error");
    if (googleError)
        return fail(googleError === "access_denied" ? "google_cancelled" : "google_failed");
    const code = params.get("code");
    if (!attempt || !code || params.get("state") !== attempt.state)
        return fail("google_expired");

    try {
        const identity = await fetchGoogleIdentity({
            code,
            verifier: attempt.verifier,
            redirectUri: getGoogleRedirectUri(request.nextUrl.origin),
            ...config,
        });
        if (!identity.emailVerified)
            return fail("google_unverified");

        const user = await getUserByEmail(identity.email);
        if (user?.suspended_until && new Date(user.suspended_until).getTime() > Date.now())
            return fail("suspended", { until: user.suspended_until });
        if (!user) {
            const res = redirectTo(buildLoginUrl(request.url, { google_signup: "1", next: attempt.next }));
            res.cookies.set({
                name: GOOGLE_SIGNUP_COOKIE,
                value: await createGoogleSignupToken({ email: identity.email, next: attempt.next }),
                httpOnly: true,
                sameSite: "lax",
                secure: process.env.NODE_ENV === "production",
                path: GOOGLE_OAUTH_COOKIE_PATH,
                maxAge: GOOGLE_SIGNUP_MAX_AGE,
            });
            return res;
        }

        const res = redirectTo(new URL(attempt.next ?? getRedirectByRole(user.role), request.url));
        await setSessionCookie(res, { role: user.role, email: identity.email, phoneLast10: user.phone_e164 });
        return res;
    }
    catch (e) {
        console.error("[auth] Google sign-in:", e instanceof Error ? e.message : e);
        return fail("google_failed");
    }
}
