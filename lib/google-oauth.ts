import type { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME, signAuthPayload, signScopedToken, verifyScopedToken, type UserRole } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next-path";

const GOOGLE_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);
const GOOGLE_SIGNUP_SCOPE = "google-signup";
const SESSION_SECONDS = 60 * 60 * 8;

export const GOOGLE_OAUTH_COOKIE = "speakup_google_oauth";
export const GOOGLE_OAUTH_COOKIE_PATH = "/api/auth/google";
export const GOOGLE_OAUTH_COOKIE_MAX_AGE = 10 * 60;
export const GOOGLE_SIGNUP_COOKIE = "speakup_google_signup";
export const GOOGLE_SIGNUP_MAX_AGE = 15 * 60;

export type GoogleOAuthState = {
    state: string;
    verifier: string;
    next: string | null;
};

/** A new Google user whose account waits for a mobile number, the same requirement as the other sign-up forms. */
export type GoogleSignup = {
    email: string;
    next: string | null;
};

export function getGoogleOAuthConfig(): { clientId: string; clientSecret: string } | null {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export function getGoogleRedirectUri(origin: string) {
    return `${origin}/api/auth/google/callback`;
}

export function createRandomToken() {
    return Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
}

export async function createCodeChallenge(verifier: string) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    return Buffer.from(digest).toString("base64url");
}

export function readGoogleOAuthState(raw: string | undefined): GoogleOAuthState | null {
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw) as Partial<GoogleOAuthState>;
        if (typeof parsed.state !== "string" || typeof parsed.verifier !== "string")
            return null;
        return { state: parsed.state, verifier: parsed.verifier, next: safeNextPath(parsed.next) };
    }
    catch {
        return null;
    }
}

export function createGoogleSignupToken(signup: GoogleSignup) {
    return signScopedToken(GOOGLE_SIGNUP_SCOPE, signup, GOOGLE_SIGNUP_MAX_AGE);
}

export async function readGoogleSignupToken(raw: string | undefined): Promise<GoogleSignup | null> {
    const signup = await verifyScopedToken<Partial<GoogleSignup>>(GOOGLE_SIGNUP_SCOPE, raw);
    return typeof signup?.email === "string" ? { email: signup.email, next: safeNextPath(signup.next) } : null;
}

export function buildLoginUrl(requestUrl: string, params: Record<string, string | null | undefined>) {
    const url = new URL("/login", requestUrl);
    for (const [key, value] of Object.entries(params)) {
        if (value)
            url.searchParams.set(key, value);
    }
    return url;
}

export function getRedirectByRole(role: UserRole) {
    return role === "admin" ? "/admin/dashboard" : role === "staff" ? "/staff/dashboard" : "/dashboard";
}

/** The same 8-hour session cookie the password login issues. */
export async function setSessionCookie(res: NextResponse, user: { role: UserRole; email: string; phoneLast10: string | null }) {
    const token = await signAuthPayload({
        role: user.role,
        username: user.email,
        phone: user.phoneLast10 ? `+63${user.phoneLast10}` : undefined,
        exp: Date.now() + SESSION_SECONDS * 1000,
    });
    res.cookies.set({
        name: AUTH_COOKIE_NAME,
        value: token,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: SESSION_SECONDS,
    });
}

export function buildGoogleAuthorizeUrl(options: { clientId: string; redirectUri: string; state: string; codeChallenge: string }) {
    const url = new URL(GOOGLE_AUTHORIZE_URL);
    url.search = new URLSearchParams({
        client_id: options.clientId,
        redirect_uri: options.redirectUri,
        response_type: "code",
        scope: "openid email profile",
        state: options.state,
        code_challenge: options.codeChallenge,
        code_challenge_method: "S256",
        // Barangay hall computers are shared, so always let people pick which Google account to use.
        prompt: "select_account",
    }).toString();
    return url;
}

type GoogleIdTokenClaims = {
    iss?: string;
    aud?: string;
    exp?: number;
    email?: string;
    email_verified?: boolean | string;
};

export async function fetchGoogleIdentity(options: {
    code: string;
    verifier: string;
    redirectUri: string;
    clientId: string;
    clientSecret: string;
}): Promise<{ email: string; emailVerified: boolean }> {
    const res = await fetch(GOOGLE_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            code: options.code,
            code_verifier: options.verifier,
            client_id: options.clientId,
            client_secret: options.clientSecret,
            redirect_uri: options.redirectUri,
            grant_type: "authorization_code",
        }),
    });
    const data = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
    if (!res.ok || !data.id_token) {
        throw new Error(`Google token exchange failed: ${data.error_description || data.error || `HTTP ${res.status}`}`);
    }
    // The ID token comes straight from Google's token endpoint over TLS, so its signature doesn't need checking
    // (OpenID Connect Core 3.1.3.7). The issuer, audience, and expiry still do.
    const claims = JSON.parse(Buffer.from(data.id_token.split(".")[1] ?? "", "base64url").toString("utf8")) as GoogleIdTokenClaims;
    if (!claims.iss || !GOOGLE_ISSUERS.has(claims.iss) || claims.aud !== options.clientId || !claims.exp || claims.exp * 1000 < Date.now()) {
        throw new Error("Google returned an ID token that is expired or meant for a different app.");
    }
    if (!claims.email) {
        throw new Error("Google didn't share an email address.");
    }
    return {
        email: claims.email.trim().toLowerCase(),
        emailVerified: claims.email_verified === true || claims.email_verified === "true",
    };
}
