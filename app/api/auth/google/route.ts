import { NextResponse, type NextRequest } from "next/server";
import {
    GOOGLE_OAUTH_COOKIE,
    GOOGLE_OAUTH_COOKIE_MAX_AGE,
    GOOGLE_OAUTH_COOKIE_PATH,
    buildGoogleAuthorizeUrl,
    buildLoginUrl,
    createCodeChallenge,
    createRandomToken,
    getGoogleOAuthConfig,
    getGoogleRedirectUri,
    type GoogleOAuthState,
} from "@/lib/google-oauth";
import { safeNextPath } from "@/lib/safe-next-path";

/** Starts "Continue with Google": remembers this attempt in a short-lived cookie, then sends the browser to Google. */
export async function GET(request: NextRequest) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    const config = getGoogleOAuthConfig();
    if (!config) {
        return NextResponse.redirect(buildLoginUrl(request.url, { error: "google_not_configured", next }));
    }

    const attempt: GoogleOAuthState = { state: createRandomToken(), verifier: createRandomToken(), next };
    const res = NextResponse.redirect(buildGoogleAuthorizeUrl({
        clientId: config.clientId,
        redirectUri: getGoogleRedirectUri(request.nextUrl.origin),
        state: attempt.state,
        codeChallenge: await createCodeChallenge(attempt.verifier),
    }));
    res.cookies.set({
        name: GOOGLE_OAUTH_COOKIE,
        value: JSON.stringify(attempt),
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: GOOGLE_OAUTH_COOKIE_PATH,
        maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE,
    });
    return res;
}
