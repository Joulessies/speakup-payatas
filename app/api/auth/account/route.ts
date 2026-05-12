import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, signAuthPayload, type AuthPayload } from "@/lib/auth";
import { getSessionFromCookies } from "@/lib/api-session";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { hashPassword, verifyPassword } from "@/lib/password";
import { getUserByEmail, getUserByPhoneLast10, isReservedStaffEmail, type AppUserRow } from "@/lib/app-users";

const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

function parsePhoneLast10(raw: string): string | null {
    const d = raw.replace(/\D/g, "");
    if (d.length >= 10) return d.slice(-10);
    return null;
}

async function resolveCurrentUser(): Promise<{ row: AppUserRow; session: AuthPayload } | null> {
    const session = await getSessionFromCookies();
    if (!session) return null;
    const username = session.username;
    let row: AppUserRow | null = null;
    if (username && username.includes("@")) {
        row = await getUserByEmail(username);
    } else if (username) {
        const phone10 = parsePhoneLast10(username);
        if (phone10) row = await getUserByPhoneLast10(phone10);
    }
    if (!row) return null;
    return { row, session };
}

function sanitize(row: AppUserRow) {
    return {
        id: row.id,
        email: row.email,
        phone: row.phone_e164 ? `+63${row.phone_e164}` : null,
        role: row.role,
        has_password: Boolean(row.password_hash),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

/** Return the currently authenticated user's profile. */
export async function GET() {
    const me = await resolveCurrentUser();
    if (!me) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    return NextResponse.json({ user: sanitize(me.row) });
}

/**
 * Update the current user's profile. Body may include any subset of:
 *   - email          (string)
 *   - phone          (string PH last-10 / 09XXXXXXXXX / +63XXXXXXXXXX)
 *   - currentPassword (string) — required when changing email or password
 *   - newPassword    (string)
 */
export async function PATCH(request: Request) {
    const me = await resolveCurrentUser();
    if (!me) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (me.session.role !== "user") {
        return NextResponse.json({ error: "Built-in staff/admin accounts cannot be changed here. Use admin tools." }, { status: 403 });
    }

    let body: Record<string, unknown>;
    try {
        body = (await request.json()) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const row = me.row;

    const wantsEmail = typeof body.email === "string" && body.email.trim().length > 0;
    const wantsPhone = typeof body.phone === "string" && body.phone.trim().length > 0;
    const wantsNewPassword = typeof body.newPassword === "string" && (body.newPassword as string).length > 0;
    const currentPassword = typeof body.currentPassword === "string" ? (body.currentPassword as string) : "";

    if (!wantsEmail && !wantsPhone && !wantsNewPassword) {
        return NextResponse.json({ error: "No changes provided." }, { status: 400 });
    }

    // Email or password changes require the existing password (when one is set).
    const sensitiveChange = wantsEmail || wantsNewPassword;
    if (sensitiveChange && row.password_hash) {
        if (!currentPassword) {
            return NextResponse.json({ error: "Current password is required to change email or password." }, { status: 400 });
        }
        const ok = await verifyPassword(currentPassword, row.password_hash);
        if (!ok) {
            return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
        }
    }

    const updates: Record<string, unknown> = {};
    let nextEmail = row.email;
    let nextPhone = row.phone_e164;

    if (wantsEmail) {
        const email = normalizeEmail(String(body.email));
        if (!/\S+@\S+\.\S+/.test(email)) {
            return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
        }
        if (isReservedStaffEmail(email)) {
            return NextResponse.json({ error: "This email is reserved for system accounts." }, { status: 403 });
        }
        if (email !== row.email) {
            const other = await getUserByEmail(email);
            if (other && other.id !== row.id) {
                return NextResponse.json({ error: "This email is already in use." }, { status: 409 });
            }
            updates.email = email;
            nextEmail = email;
        }
    }

    if (wantsPhone) {
        const phone10 = parsePhoneLast10(String(body.phone));
        if (!phone10) {
            return NextResponse.json({ error: "Enter a valid 10-digit PH mobile number." }, { status: 400 });
        }
        if (phone10 !== row.phone_e164) {
            const other = await getUserByPhoneLast10(phone10);
            if (other && other.id !== row.id) {
                return NextResponse.json({ error: "This mobile number is already registered." }, { status: 409 });
            }
            updates.phone_e164 = phone10;
            nextPhone = phone10;
        }
    }

    if (wantsNewPassword) {
        const newPwd = String(body.newPassword);
        if (newPwd.length < 8) {
            return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });
        }
        updates.password_hash = await hashPassword(newPwd);
    }

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: "No changes detected." }, { status: 400 });
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
        .from("app_users")
        .update(updates)
        .eq("id", row.id)
        .select("id, email, phone_e164, password_hash, role, created_at, updated_at")
        .single();

    if (error || !data) {
        const msg = error?.message || "Update failed.";
        const status = /duplicate|unique/i.test(msg) ? 409 : 500;
        return NextResponse.json({ error: msg }, { status });
    }

    // If the username (email/phone) changed, the auth cookie needs to be re-issued so the user stays logged in.
    const newUsername = (data as AppUserRow).email || (nextPhone ? `+63${nextPhone}` : null);
    const oldUsername = me.session.username;
    const usernameChanged = Boolean(newUsername && newUsername !== oldUsername);

    const res = NextResponse.json({ success: true, user: sanitize(data as AppUserRow) });
    if (usernameChanged && newUsername) {
        const exp = Date.now() + SESSION_COOKIE_MAX_AGE_SECONDS * 1000;
        const token = await signAuthPayload({ role: me.session.role, username: newUsername, exp });
        res.cookies.set({
            name: AUTH_COOKIE_NAME,
            value: token,
            httpOnly: true,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
            maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
            path: "/",
        });
    }
    // Suppress unused-variable lint on intentionally-unused locals
    void nextEmail;
    void oldUsername;
    return res;
}

/**
 * Delete (or deactivate) the current user's account. Body may include:
 *   - currentPassword (string, required if password is set)
 *   - mode: "delete" (default) or "deactivate"
 */
export async function DELETE(request: Request) {
    const me = await resolveCurrentUser();
    if (!me) {
        return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (me.session.role !== "user") {
        return NextResponse.json({ error: "Built-in staff/admin accounts cannot be deleted from here." }, { status: 403 });
    }

    let body: Record<string, unknown> = {};
    try {
        body = (await request.json()) as Record<string, unknown>;
    } catch {
        // body is optional
    }
    const currentPassword = typeof body.currentPassword === "string" ? (body.currentPassword as string) : "";
    const mode = typeof body.mode === "string" ? (body.mode as string) : "delete";

    if (me.row.password_hash) {
        if (!currentPassword) {
            return NextResponse.json({ error: "Current password is required to confirm." }, { status: 400 });
        }
        const ok = await verifyPassword(currentPassword, me.row.password_hash);
        if (!ok) {
            return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
        }
    }

    const supabase = getSupabaseAdmin();

    if (mode === "deactivate") {
        // Soft-disable: clear password and mark email with a deactivated marker so the user can't sign in.
        const stamp = new Date().toISOString();
        const { error } = await supabase
            .from("app_users")
            .update({
                password_hash: null,
                email: me.row.email ? `deactivated_${me.row.id.slice(0, 8)}_${me.row.email}` : me.row.email,
                phone_e164: me.row.phone_e164 ? null : me.row.phone_e164,
                updated_at: stamp,
            })
            .eq("id", me.row.id);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    } else {
        const { error } = await supabase.from("app_users").delete().eq("id", me.row.id);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
    }

    // Clear the session cookie so the user is signed out immediately.
    const store = await cookies();
    store.set({
        name: AUTH_COOKIE_NAME,
        value: "",
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
    });
    return NextResponse.json({ success: true, mode });
}
