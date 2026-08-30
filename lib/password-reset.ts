/**
 * Password reset token management
 * Uses persistent Supabase SMS OTP sessions with resilient in-memory fallback.
 */

import { issueSmsOtp, verifySmsOtp, invalidateSmsOtp } from "@/lib/sms-otp";

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
    return await verifySmsOtp(phoneLast10, token, { consumeOnSuccess: consume });
}

/**
 * Invalidate/clear reset token after use
 */
export async function invalidatePasswordResetToken(phoneLast10: string): Promise<void> {
    await invalidateSmsOtp(phoneLast10);
}
