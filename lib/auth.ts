export type UserRole = "admin" | "staff" | "user";
export interface AuthPayload {
    role: UserRole;
    username: string;
    phone?: string;
    exp: number;
}
export const AUTH_COOKIE_NAME = "speakup_auth";
const encoder = new TextEncoder();
function getAuthSecret() {
    return process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET || "speakup-dev-secret-change-me";
}

async function digestHex(input: string) {
    const bytes = encoder.encode(input);
    const hash = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}
export async function signAuthPayload(payload: AuthPayload) {
    const encoded = encodeURIComponent(JSON.stringify(payload));
    const signature = await digestHex(`${getAuthSecret()}.${encoded}`);
    return `${encoded}.${signature}`;
}
export async function verifyAuthToken(token: string | undefined | null) {
    if (!token)
        return null;
    const dot = token.lastIndexOf(".");
    if (dot <= 0)
        return null;
    const encoded = token.slice(0, dot);
    const signature = token.slice(dot + 1);
    if (!encoded || !signature)
        return null;
    const expected = await digestHex(`${getAuthSecret()}.${encoded}`);
    if (expected !== signature)
        return null;
    try {
        const payload = JSON.parse(decodeURIComponent(encoded)) as AuthPayload;
        if (!payload?.role || !payload?.username || !payload?.exp)
            return null;
        if (Date.now() > payload.exp)
            return null;
        return payload;
    }
    catch {
        return null;
    }
}
/** For short-lived values that must never pass as a session, like a Google sign-up still waiting for a mobile number. */
export async function signScopedToken(scope: string, value: object, ttlSeconds: number) {
    const encoded = encodeURIComponent(JSON.stringify({ ...value, exp: Date.now() + ttlSeconds * 1000 }));
    const signature = await digestHex(`${getAuthSecret()}:${scope}.${encoded}`);
    return `${encoded}.${signature}`;
}
export async function verifyScopedToken<T extends object>(scope: string, token: string | undefined | null): Promise<T | null> {
    if (!token)
        return null;
    const dot = token.lastIndexOf(".");
    if (dot <= 0)
        return null;
    const encoded = token.slice(0, dot);
    const expected = await digestHex(`${getAuthSecret()}:${scope}.${encoded}`);
    if (expected !== token.slice(dot + 1))
        return null;
    try {
        const value = JSON.parse(decodeURIComponent(encoded)) as T & { exp?: unknown };
        return typeof value.exp === "number" && Date.now() <= value.exp ? value : null;
    }
    catch {
        return null;
    }
}
export function getAllowedCredentials() {
    return {
        admin: {
            username: process.env.ADMIN_USERNAME || "admin",
            password: process.env.ADMIN_PASSWORD || "admin123",
        },
        staff: {
            username: process.env.STAFF_USERNAME || "staff",
            password: process.env.STAFF_PASSWORD || "staff123",
        },
        user: {
            username: process.env.USER_USERNAME || "user",
            password: process.env.USER_PASSWORD || "user123",
        },
    };
}
