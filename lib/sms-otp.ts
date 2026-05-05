import { getSupabaseAdmin } from "@/lib/supabase-server";

/** Maps PostgREST / Postgres messages to a short hint (full detail stays in server logs). */
function explainOtpDbError(message: string): string {
    const m = message.toLowerCase();
    if (
        (m.includes("does not exist") && m.includes("sms_otp_sessions"))
        || (m.includes("relation") && m.includes("sms_otp_sessions"))
        || (m.includes("could not find the table") && m.includes("sms_otp_sessions"))
        || (m.includes("schema cache") && m.includes("sms_otp_sessions"))
    ) {
        return "SMS OTP storage is not set up. Run sql/007_sms_otp_sessions.sql in the Supabase SQL editor, then try again.";
    }
    if (m.includes("jwt") || m.includes("invalid api key") || m.includes("permission denied")) {
        return "Supabase credentials failed. Check NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.";
    }
    return "Unable to issue OTP right now. Check the server log for [sms-otp].";
}

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 30 * 1000;
const MAX_ATTEMPTS = 5;

function randomSixDigits() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function deleteExpiredSessions(): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase.from("sms_otp_sessions").delete().lt("expires_at", new Date().toISOString());
}

/** Stores OTP in Supabase (survives server restarts). Requires SUPABASE_SERVICE_ROLE_KEY + migration sql/007_sms_otp_sessions.sql */
export async function issueSmsOtp(phoneLast10: string): Promise<{ code: string } | { error: string }> {
    const now = Date.now();
    await deleteExpiredSessions();

    const supabase = getSupabaseAdmin();

    const { data: existing, error: fetchErr } = await supabase
        .from("sms_otp_sessions")
        .select("last_sent_at")
        .eq("phone_last10", phoneLast10)
        .maybeSingle();

    if (fetchErr) {
        console.error("[sms-otp] fetch:", fetchErr.message, fetchErr);
        return { error: explainOtpDbError(fetchErr.message) };
    }

    if (existing?.last_sent_at) {
        const lastSent = new Date(existing.last_sent_at).getTime();
        if (now - lastSent < RESEND_COOLDOWN_MS) {
            const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - lastSent)) / 1000);
            return { error: `Please wait ${waitSec}s before requesting another OTP.` };
        }
    }

    const code = randomSixDigits();
    const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
    const lastSentAt = new Date(now).toISOString();

    const { error: upsertErr } = await supabase.from("sms_otp_sessions").upsert(
        {
            phone_last10: phoneLast10,
            code,
            expires_at: expiresAt,
            last_sent_at: lastSentAt,
            attempts_left: MAX_ATTEMPTS,
        },
        { onConflict: "phone_last10" },
    );

    if (upsertErr) {
        console.error("[sms-otp] upsert:", upsertErr.message, upsertErr);
        return { error: explainOtpDbError(upsertErr.message) };
    }

    return { code };
}

export async function invalidateSmsOtp(phoneLast10: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phoneLast10);
}

export async function verifySmsOtp(
    phoneLast10: string,
    submittedCode: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const now = Date.now();
    await deleteExpiredSessions();

    const supabase = getSupabaseAdmin();
    const { data: rec, error } = await supabase
        .from("sms_otp_sessions")
        .select("code, expires_at, attempts_left")
        .eq("phone_last10", phoneLast10)
        .maybeSingle();

    if (error) {
        console.error("[sms-otp] verify fetch:", error.message);
        return { ok: false, error: "Unable to verify OTP. Try again." };
    }
    if (!rec) {
        return { ok: false, error: "No OTP found for this number. Please request a new code." };
    }

    if (new Date(rec.expires_at).getTime() <= now) {
        await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phoneLast10);
        return { ok: false, error: "OTP expired. Please request a new code." };
    }

    if (rec.code !== submittedCode) {
        const attemptsLeft = rec.attempts_left - 1;
        if (attemptsLeft <= 0) {
            await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phoneLast10);
            return { ok: false, error: "Too many failed attempts. Request a new OTP." };
        }
        await supabase
            .from("sms_otp_sessions")
            .update({ attempts_left: attemptsLeft })
            .eq("phone_last10", phoneLast10);
        return { ok: false, error: `Invalid OTP. ${attemptsLeft} attempt(s) left.` };
    }

    await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phoneLast10);
    return { ok: true };
}
