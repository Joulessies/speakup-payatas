import { createHash } from "crypto";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { getUserByEmail, getUserByPhoneLast10 } from "@/lib/app-users";

/** Same salt the browser uses, so a device hash and an account hash stay comparable. */
export function hashReporterKey(raw: string) {
    const salt = process.env.NEXT_PUBLIC_HASH_SALT ?? "speakup-payatas-default-salt";
    return createHash("sha256").update(`${raw}:${salt}`).digest("hex");
}

/** Stable across browsers. Reports filed while signed in use this instead of the laptop's device id. */
export async function accountReporterHashFromSession(): Promise<string | null> {
    const cookieStore = await cookies();
    const session = await verifyAuthToken(cookieStore.get(AUTH_COOKIE_NAME)?.value);
    if (!session || session.role !== "user")
        return null;
    const user = session.username.includes("@")
        ? await getUserByEmail(session.username)
        : await getUserByPhoneLast10(session.username.replace(/\D/g, "").slice(-10));
    if (!user)
        return null;
    return hashReporterKey(`account:${user.id}`);
}
