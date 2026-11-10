/**
 * Password reset token management
 * Uses persistent Supabase SMS OTP sessions with resilient in-memory fallback.
 */

import { issueSmsOtp, verifySmsOtp, invalidateSmsOtp } from "@/lib/sms-otp";
import { getSupabaseAdmin } from "@/lib/supabase-server";

/**
 * Generate a 6-digit numeric reset token for the specified phone number
 */
export async function createPasswordResetToken(
    _userId: string,
    phoneLast10: string,
): Promise<{ token: string } | { error: string }> {
    const result = await issueSmsOtp(phoneLast10);
    if ("error" in result) {
        return { error: result.error };
    }
    return { token: result.code };
}

/**
 * Verify a reset token against the phone number session
 */
export async function verifyPasswordResetToken(
    phoneLast10: string,
    token: string,
    consume: boolean = true,
): Promise<{ ok: true } | { ok: false; error: string }> {
    const phone = phoneLast10.replace(/\D/g, "").slice(-10);
    return await verifySmsOtp(phone, token, { consumeOnSuccess: consume });
}

/**
 * Invalidate/clear reset token after use
 */
/** Saves a code Supabase already accepted so the password form can check it again. */
export async function rememberVerifiedResetCode(phoneLast10: string, token: string): Promise<void> {
    const phone = phoneLast10.replace(/\D/g, "").slice(-10);
    const code = token.replace(/\D/g, "").slice(0, 6);
    if (!/^\d{10}$/.test(phone) || !/^\d{6}$/.test(code)) return;
    await getSupabaseAdmin().from("sms_otp_sessions").upsert(
        {
            phone_last10: phone,
            code,
            expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
            last_sent_at: new Date().toISOString(),
            attempts_left: 3,
        },
        { onConflict: "phone_last10" },
    );
}

export async function invalidatePasswordResetToken(phoneLast10: string): Promise<void> {
    await invalidateSmsOtp(phoneLast10);
}
