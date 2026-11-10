import { getSupabaseAdmin } from "@/lib/supabase-server";

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

function normalizePhoneLast10(phone: string) {
    return phone.replace(/\D/g, "").slice(-10);
}

function normalizeCode(code: string | number) {
    return String(code ?? "").replace(/\D/g, "").slice(0, 6);
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

export async function issueSmsOtp(phoneLast10: string): Promise<{ code: string } | { error: string }> {
    const phone = normalizePhoneLast10(phoneLast10);
    if (!/^\d{10}$/.test(phone)) {
        return { error: "Invalid phone number." };
    }
    const now = Date.now();
    cleanMemorySessions();

    try {
        await deleteExpiredSessions().catch((err) => {
            console.warn("[sms-otp] Could not clear expired codes:", err instanceof Error ? err.message : err);
        });
        const supabase = getSupabaseAdmin();

        const { data: existing, error: fetchErr } = await supabase
            .from("sms_otp_sessions")
            .select("last_sent_at")
            .eq("phone_last10", phone)
            .maybeSingle();

        if (fetchErr) {
            console.error("[sms-otp] Supabase fetch error:", fetchErr.message);
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
                phone_last10: phone,
                code,
                expires_at: expiresAt,
                last_sent_at: lastSentAt,
                attempts_left: MAX_ATTEMPTS,
            },
            { onConflict: "phone_last10" },
        );

        if (upsertErr) {
            console.error("[sms-otp] Supabase upsert error:", upsertErr.message);
            return { error: explainOtpDbError(upsertErr.message) };
        }

        memoryOtpSessions.set(phone, {
            code,
            expiresAt: now + OTP_TTL_MS,
            lastSentAt: now,
            attemptsLeft: MAX_ATTEMPTS,
        });

        return { code };
    } catch (err) {
        const message = err instanceof Error ? err.message : "";
        console.error("[sms-otp] issue failed:", message);
        return { error: message ? explainOtpDbError(message) : "Unable to issue OTP right now. Check the server log for [sms-otp]." };
    }
}

export async function invalidateSmsOtp(phoneLast10: string): Promise<void> {
    const phone = normalizePhoneLast10(phoneLast10);
    memoryOtpSessions.delete(phone);
    try {
        const supabase = getSupabaseAdmin();
        await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phone);
    } catch {
        // Ignored
    }
}

export async function verifySmsOtp(
    phoneLast10: string,
    submittedCode: string,
    options?: { consumeOnSuccess?: boolean }
): Promise<{ ok: true } | { ok: false; error: string }> {
    const phone = normalizePhoneLast10(phoneLast10);
    const code = normalizeCode(submittedCode);
    if (!/^\d{10}$/.test(phone) || !/^\d{6}$/.test(code)) {
        return { ok: false, error: "Invalid OTP. Enter the 6-digit code." };
    }
    const now = Date.now();
    const consume = options?.consumeOnSuccess !== false;
    cleanMemorySessions();

    try {
        await deleteExpiredSessions().catch((err) => {
            console.warn("[sms-otp] Could not clear expired codes:", err instanceof Error ? err.message : err);
        });
        const supabase = getSupabaseAdmin();
        const { data: rec, error } = await supabase
            .from("sms_otp_sessions")
            .select("code, expires_at, attempts_left")
            .eq("phone_last10", phone)
            .maybeSingle();

        if (error || !rec) {
            const mem = memoryOtpSessions.get(phone);
            if (!mem) {
                return { ok: false, error: "No OTP found for this number. Please request a new code." };
            }
            if (now > mem.expiresAt) {
                memoryOtpSessions.delete(phone);
                return { ok: false, error: "OTP expired. Please request a new code." };
            }
            if (normalizeCode(mem.code) !== code) {
                mem.attemptsLeft -= 1;
                if (mem.attemptsLeft <= 0) {
                    memoryOtpSessions.delete(phone);
                    return { ok: false, error: "Too many failed attempts. Request a new OTP." };
                }
                return { ok: false, error: `Invalid OTP. ${mem.attemptsLeft} attempt(s) left.` };
            }
            if (consume) {
                memoryOtpSessions.delete(phone);
            }
            return { ok: true };
        }

        if (new Date(rec.expires_at).getTime() <= now) {
            await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phone);
            memoryOtpSessions.delete(phone);
            return { ok: false, error: "OTP expired. Please request a new code." };
        }

        if (normalizeCode(rec.code) !== code) {
            const attemptsLeft = Number(rec.attempts_left) - 1;
            if (attemptsLeft <= 0) {
                await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phone);
                memoryOtpSessions.delete(phone);
                return { ok: false, error: "Too many failed attempts. Request a new OTP." };
            }
            await supabase
                .from("sms_otp_sessions")
                .update({ attempts_left: attemptsLeft })
                .eq("phone_last10", phone);
            return { ok: false, error: `Invalid OTP. ${attemptsLeft} attempt(s) left.` };
        }

        if (consume) {
            await supabase.from("sms_otp_sessions").delete().eq("phone_last10", phone);
            memoryOtpSessions.delete(phone);
        }
        return { ok: true };
    } catch (err) {
        console.error("[sms-otp] verify failed:", err instanceof Error ? err.message : err);
        const mem = memoryOtpSessions.get(phone);
        if (!mem) {
            return { ok: false, error: "No OTP found for this number. Please request a new code." };
        }
        if (now > mem.expiresAt) {
            memoryOtpSessions.delete(phone);
            return { ok: false, error: "OTP expired. Please request a new code." };
        }
        if (normalizeCode(mem.code) !== code) {
            mem.attemptsLeft -= 1;
            if (mem.attemptsLeft <= 0) {
                memoryOtpSessions.delete(phone);
                return { ok: false, error: "Too many failed attempts. Request a new OTP." };
            }
            return { ok: false, error: `Invalid OTP. ${mem.attemptsLeft} attempt(s) left.` };
        }
        if (consume) {
            memoryOtpSessions.delete(phone);
        }
        return { ok: true };
    }
}
