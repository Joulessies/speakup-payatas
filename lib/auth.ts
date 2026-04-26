export type UserRole = "admin" | "user";

export interface AuthPayload {
  role: UserRole;
  username: string;
  exp: number;
}

export const AUTH_COOKIE_NAME = "speakup_auth";

const encoder = new TextEncoder();

function getAuthSecret() {
  return process.env.AUTH_SECRET || "speakup-dev-secret-change-me";
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
  if (!token) return null;
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = await digestHex(`${getAuthSecret()}.${encoded}`);
  if (expected !== signature) return null;

  try {
    const payload = JSON.parse(decodeURIComponent(encoded)) as AuthPayload;
    if (!payload?.role || !payload?.username || !payload?.exp) return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAllowedCredentials() {
  return {
    admin: {
      username: process.env.ADMIN_USERNAME || "admin",
      password: process.env.ADMIN_PASSWORD || "admin123",
    },
    user: {
      username: process.env.USER_USERNAME || "user",
      password: process.env.USER_PASSWORD || "user123",
    },
  };
}
