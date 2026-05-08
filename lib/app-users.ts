import { getAllowedCredentials, type UserRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { hashPassword } from "@/lib/password";

export type AppUserRow = {
    id: string;
    email: string | null;
    phone_e164: string | null;
    password_hash: string | null;
    role: UserRole;
    created_at: string;
    updated_at: string;
};

function normalizeEmail(value: string) {
    return value.trim().toLowerCase();
}

export async function ensureSystemAccountsInDb(): Promise<{ adminEmail: string; staffEmail: string }> {
    const supabase = getSupabaseAdmin();
    const credentials = getAllowedCredentials();
    const adminEmail = normalizeEmail(`${credentials.admin.username}@speakup.local`);
    const staffEmail = normalizeEmail(`${credentials.staff.username}@speakup.local`);
    const [adminHash, staffHash] = await Promise.all([
        hashPassword(credentials.admin.password),
        hashPassword(credentials.staff.password),
    ]);
    const now = new Date().toISOString();
    const { error } = await supabase.from("app_users").upsert(
        [
            { email: adminEmail, password_hash: adminHash, role: "admin", updated_at: now },
            { email: staffEmail, password_hash: staffHash, role: "staff", updated_at: now },
        ],
        { onConflict: "email" },
    );
    if (error)
        throw new Error(error.message);
    return { adminEmail, staffEmail };
}

export async function getUserByEmail(email: string): Promise<AppUserRow | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from("app_users")
        .select("id, email, phone_e164, password_hash, role, created_at, updated_at")
        .eq("email", normalizeEmail(email))
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    return data as AppUserRow | null;
}

export async function getUserByPhoneLast10(phone: string): Promise<AppUserRow | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from("app_users")
        .select("id, email, phone_e164, password_hash, role, created_at, updated_at")
        .eq("phone_e164", phone)
        .maybeSingle();
    if (error)
        throw new Error(error.message);
    return data as AppUserRow | null;
}

export async function insertEmailUser(
    email: string,
    passwordHash: string,
    role: UserRole = "user",
    phoneLast10?: string | null,
) {
    const supabase = getSupabaseAdmin();
    const row: Record<string, unknown> = {
        email: normalizeEmail(email),
        password_hash: passwordHash,
        role,
    };
    if (phoneLast10 && /^\d{10}$/.test(phoneLast10)) {
        row.phone_e164 = phoneLast10;
    }
    const { data, error } = await supabase
        .from("app_users")
        .insert(row)
        .select("id, email, phone_e164, password_hash, role, created_at, updated_at")
        .single();
    if (error)
        throw new Error(error.message);
    return data as AppUserRow;
}

/** Email registered via Supabase Email OTP only (no password). Requires migration sql/008_app_users_email_otp_optional_password.sql */
export async function insertEmailOtpUser(email: string, phoneLast10: string) {
    if (!/^\d{10}$/.test(phoneLast10)) {
        throw new Error("Invalid phone number.");
    }
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from("app_users")
        .insert({
            email: normalizeEmail(email),
            phone_e164: phoneLast10,
            password_hash: null,
            role: "user",
        })
        .select("id, email, phone_e164, password_hash, role, created_at, updated_at")
        .single();
    if (error)
        throw new Error(error.message);
    return data as AppUserRow;
}

export async function updateAppUserPhoneLast10ById(userId: string, phoneLast10: string): Promise<AppUserRow> {
    if (!/^\d{10}$/.test(phoneLast10)) {
        throw new Error("Invalid phone number.");
    }
    const other = await getUserByPhoneLast10(phoneLast10);
    if (other && other.id !== userId) {
        throw new Error("This mobile number is already registered.");
    }
    const supabase = getSupabaseAdmin();
    const now = new Date().toISOString();
    const { data, error } = await supabase
        .from("app_users")
        .update({ phone_e164: phoneLast10, updated_at: now })
        .eq("id", userId)
        .select("id, email, phone_e164, password_hash, role, created_at, updated_at")
        .single();
    if (error)
        throw new Error(error.message);
    return data as AppUserRow;
}

export async function insertPhoneUser(phoneLast10: string) {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from("app_users")
        .insert({
            phone_e164: phoneLast10,
            role: "user",
        })
        .select("id, email, phone_e164, password_hash, role, created_at, updated_at")
        .single();
    if (error)
        throw new Error(error.message);
    return data as AppUserRow;
}

export async function listAllAppUsers(): Promise<AppUserRow[]> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from("app_users")
        .select("id, email, phone_e164, password_hash, role, created_at, updated_at")
        .order("created_at", { ascending: false });
    if (error)
        throw new Error(error.message);
    return (data ?? []) as AppUserRow[];
}

export function appUserRowToAdminPayload(row: AppUserRow) {
    const phoneDisplay = row.phone_e164 ? `+63${row.phone_e164}` : undefined;
    const username = row.email ?? phoneDisplay ?? row.id.slice(0, 8);
    return {
        id: row.id,
        username,
        role: row.role,
        phone: phoneDisplay,
        created_at: row.created_at,
        email: row.email,
    };
}

function reservedSystemEmails(): { adminEmail: string; staffEmail: string } {
    const credentials = getAllowedCredentials();
    return {
        adminEmail: normalizeEmail(`${credentials.admin.username}@speakup.local`),
        staffEmail: normalizeEmail(`${credentials.staff.username}@speakup.local`),
    };
}

export function isReservedStaffEmail(email: string | null): boolean {
    if (!email)
        return false;
    const { adminEmail, staffEmail } = reservedSystemEmails();
    const e = normalizeEmail(email);
    return e === adminEmail || e === staffEmail;
}

export async function deleteAppUserById(id: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    const { data: row, error: fetchErr } = await supabase
        .from("app_users")
        .select("id, email, role")
        .eq("id", id)
        .maybeSingle();
    if (fetchErr)
        throw new Error(fetchErr.message);
    if (!row)
        throw new Error("User not found");
    if (row.email && isReservedStaffEmail(row.email))
        throw new Error("Cannot delete the built-in admin or staff account.");
    const { error } = await supabase.from("app_users").delete().eq("id", id);
    if (error)
        throw new Error(error.message);
}

export async function updateAppUserById(
    id: string,
    updates: { role?: UserRole; passwordPlain?: string },
): Promise<AppUserRow> {
    const supabase = getSupabaseAdmin();
    const payload: Record<string, unknown> = {};
    if (updates.role !== undefined) {
        if (!["admin", "staff", "user"].includes(updates.role))
            throw new Error("Invalid role");
        payload.role = updates.role;
    }
    if (updates.passwordPlain !== undefined) {
        if (updates.passwordPlain.length < 6)
            throw new Error("Password must be at least 6 characters");
        payload.password_hash = await hashPassword(updates.passwordPlain);
    }
    if (Object.keys(payload).length === 0)
        throw new Error("No updates");
    const { data, error } = await supabase
        .from("app_users")
        .update(payload)
        .eq("id", id)
        .select("id, email, phone_e164, password_hash, role, created_at, updated_at")
        .single();
    if (error)
        throw new Error(error.message);
    return data as AppUserRow;
}

/**
 * Update user password by user ID (used for password reset)
 */
export async function updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters");
    }
    const password_hash = await hashPassword(newPassword);
    const now = new Date().toISOString();
    
    const { error } = await supabase
        .from("app_users")
        .update({ password_hash, updated_at: now })
        .eq("id", userId);
    
    if (error) {
        throw new Error(error.message);
    }
}
