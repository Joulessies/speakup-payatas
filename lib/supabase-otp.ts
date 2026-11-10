import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

function authClient() {
    if (client) return client;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
        throw new Error("Missing Supabase URL or anon key.");
    }
    client = createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    return client;
}

export function toPhilippineE164(phone: string) {
    const last10 = phone.replace(/\D/g, "").slice(-10);
    if (!/^\d{10}$/.test(last10)) {
        throw new Error("Enter a valid PH mobile number.");
    }
    return `+63${last10}`;
}

function explain(error: { message: string }) {
    const message = error.message || "Supabase could not send the code.";
    if (/sms|phone provider|unsupported phone/i.test(message)) {
        return "Supabase could not text this number. In the Supabase dashboard, open Authentication → Providers → Phone and turn on SMS.";
    }
    return message;
}

/** Supabase emails a 6-digit code. Uses the project's Auth email settings. */
export async function sendSupabaseEmailOtp(email: string) {
    const { error } = await authClient().auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
    });
    if (error) throw new Error(explain(error));
}

/** Supabase texts a 6-digit code. Requires the Phone provider in the Supabase project. */
export async function sendSupabasePhoneOtp(phone: string) {
    const { error } = await authClient().auth.signInWithOtp({
        phone: toPhilippineE164(phone),
        options: { shouldCreateUser: true, channel: "sms" },
    });
    if (error) throw new Error(explain(error));
}

export async function verifySupabaseEmailOtp(email: string, token: string) {
    const { data, error } = await authClient().auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.replace(/\D/g, "").slice(0, 6),
        type: "email",
    });
    if (error || !data.user) throw new Error(error?.message || "Invalid or expired email code.");
    return data.user;
}

export async function verifySupabasePhoneOtp(phone: string, token: string) {
    const { data, error } = await authClient().auth.verifyOtp({
        phone: toPhilippineE164(phone),
        token: token.replace(/\D/g, "").slice(0, 6),
        type: "sms",
    });
    if (error || !data.user) throw new Error(error?.message || "Invalid or expired SMS code.");
    return data.user;
}
