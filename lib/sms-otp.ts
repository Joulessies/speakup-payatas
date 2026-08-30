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

interface MemoryOtpSession {
    code: string;
    expiresAt: number;
    lastSentAt: number;
    attemptsLeft: number;
}

const memoryOtpSessions = new Map<string, MemoryOtpSession>();

function cleanMemorySessions() {
    const now = Date.now();
    for (const [phone, session] of memoryOtpSessions.entries()) {
        if (now > session.expiresAt || session.attemptsLeft <= 0) {
            memoryOtpSessions.delete(phone);
        }
    }
}

/** Stores OTP in Supabase with memory fallback (survives server restarts when Supabase is connected). */
export async function issueSmsOtp(phoneLast10: string): Promise<{ code: string } | { error: string }> {
    const now = Date.now();
    cleanMemorySessions();

    try {
        await deleteExpiredSessions();
        const supabase = getSupabaseAdmin();

        const { data: existing, error: fetchErr } = await supabase
            .from("sms_otp_sessions")
            .select("last_sent_at")
            .eq("phone_last10", phoneLast10)
            .maybeSingle();

        if (fetchErr) {
            console.warn("[sms-otp] Supabase fetch error, using memory fallback:", fetchErr.message);
            throw new Error(fetchErr.message);
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
            console.warn("[sms-otp] Supabase upsert error, using memory fallback:", upsertErr.message);
            throw new Error(upsertErr.message);
        }

        // Keep in memory as secondary mirror
        memoryOtpSessions.set(phoneLast10, {
            code,
            expiresAt: now + OTP_TTL_MS,
            lastSentAt: now,
            attemptsLeft: MAX_ATTEMPTS,
        });

        return { code };
    } catch (err) {
        // Fallback to memory store if Supabase fails
        const mem = memoryOtpSessions.get(phoneLast10);
        if (mem && now - mem.lastSentAt < RESEND_COOLDOWN_MS) {
            const waitSec = Math.ceil((RESEND_COOLDOWN_MS - (now - mem.lastSentAt)) / 1000);
            return { error: `Please wait ${waitSec}s before requesting another OTP.` };
        }

        const code = randomSixDigits();
        memoryOtpSessions.set(phoneLast10, {
            code,
            expiresAt: now + OTP_TTL_MS,
            lastSentAt: now,
            attemptsLeft: MAX_ATTEMPTS,
        });
        return { code };
    }
}

export async function invalidateSmsOtp(phoneLast10: string): Promise<void> {
    memoryOtpSessions.delete(phoneLast10);
    try {
        const supabase = getSupabaseAdmin();
        await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phoneLast10);
    } catch {
        // Ignored
    }
}

export async function verifySmsOtp(
    phoneLast10: string,
    submittedCode: string,
    options?: { consumeOnSuccess?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
    const now = Date.now();
    const consume = options?.consumeOnSuccess !== false;
    cleanMemorySessions();

    try {
        await deleteExpiredSessions();
        const supabase = getSupabaseAdmin();
        const { data: rec, error } = await supabase
            .from("sms_otp_sessions")
            .select("code, expires_at, attempts_left")
            .eq("phone_last10", phoneLast10)
            .maybeSingle();

        if (error || !rec) {
            // Check memory store
            const mem = memoryOtpSessions.get(phoneLast10);
            if (!mem) {
                return { ok: false, error: "No OTP found for this number. Please request a new code." };
            }
            if (now > mem.expiresAt) {
                memoryOtpSessions.delete(phoneLast10);
                return { ok: false, error: "OTP expired. Please request a new code." };
            }
            if (mem.code !== submittedCode) {
                mem.attemptsLeft -= 1;
                if (mem.attemptsLeft <= 0) {
                    memoryOtpSessions.delete(phoneLast10);
                    return { ok: false, error: "Too many failed attempts. Request a new OTP." };
                }
                return { ok: false, error: `Invalid OTP. ${mem.attemptsLeft} attempt(s) left.` };
            }
            if (consume) {
                memoryOtpSessions.delete(phoneLast10);
            }
            return { ok: true };
        }

        if (new Date(rec.expires_at).getTime() <= now) {
            await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phoneLast10);
            memoryOtpSessions.delete(phoneLast10);
            return { ok: false, error: "OTP expired. Please request a new code." };
        }

        if (rec.code !== submittedCode) {
            const attemptsLeft = rec.attempts_left - 1;
            if (attemptsLeft <= 0) {
                await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phoneLast10);
                memoryOtpSessions.delete(phoneLast10);
                return { ok: false, error: "Too many failed attempts. Request a new OTP." };
            }
            await supabase
                .from("sms_otp_sessions")
                .update({ attempts_left: attemptsLeft })
                .eq("phone_last10", phoneLast10);
            return { ok: false, error: `Invalid OTP. ${attemptsLeft} attempt(s) left.` };
        }

        if (consume) {
            await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phoneLast10);
            memoryOtpSessions.delete(phoneLast10);
        }
        return { ok: true };
    } catch {
        const mem = memoryOtpSessions.get(phoneLast10);
        if (!mem) {
            return { ok: false, error: "No OTP found for this number. Please request a new code." };
        }
        if (now > mem.expiresAt) {
            memoryOtpSessions.delete(phoneLast10);
            return { ok: false, error: "OTP expired. Please request a new code." };
        }
        if (mem.code !== submittedCode) {
            mem.attemptsLeft -= 1;
            if (mem.attemptsLeft <= 0) {
                memoryOtpSessions.delete(phoneLast10);
                return { ok: false, error: "Too many failed attempts. Request a new OTP." };
            }
            return { ok: false, error: `Invalid OTP. ${mem.attemptsLeft} attempt(s) left.` };
        }
        if (consume) {
            memoryOtpSessions.delete(phoneLast10);
        }
        return { ok: true };
    }
}
