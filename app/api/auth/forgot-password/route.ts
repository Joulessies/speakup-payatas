import { NextResponse } from "next/server";
import { getUserByEmail, getUserByPhoneLast10 } from "@/lib/app-users";
import { verifyPasswordResetToken, invalidatePasswordResetToken, createPasswordResetToken } from "@/lib/password-reset";
import { sendBrevoEmail } from "@/lib/brevo-email";
import { sendVonageSms } from "@/lib/vonage-sms";
import { validatePassword } from "@/lib/password-validation";

// In-memory rate limiting map for password reset requests (1 request per 30s per user)
const forgotPasswordRateLimits = new Map<string, number>();
const RATE_LIMIT_COOLDOWN_MS = 30 * 1000; // 30 seconds

function normalizePhoneLast10(raw: string): string {
    return raw.replace(/\D/g, "").slice(-10);
}

async function findUserByIdentifier(identifier: string) {
    const trimmed = identifier.trim().toLowerCase();
    if (!trimmed) return null;

    if (trimmed.includes("@")) {
        const user = await getUserByEmail(trimmed);
        if (user) return user;
    }

    const phone10 = normalizePhoneLast10(trimmed);
    if (/^\d{10}$/.test(phone10)) {
        const user = await getUserByPhoneLast10(phone10);
        if (user) return user;
    }

    return null;
}

/**
 * Request a password reset OTP, or verify the reset OTP
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const action = String(body?.action ?? "request").trim().toLowerCase();
        const rawIdentifier = String(body?.identifier ?? body?.email ?? body?.phone ?? "").trim();

        if (!rawIdentifier) {
            return NextResponse.json({ error: "Please enter your registered email address or mobile number." }, { status: 400 });
        }

        const user = await findUserByIdentifier(rawIdentifier);

        // Verification step
        if (action === "verify") {
            const token = String(body?.token ?? "").trim();
            if (!/^\d{6}$/.test(token)) {
                return NextResponse.json({ error: "Please enter the valid 6-digit code." }, { status: 400 });
            }

            if (!user || !user.phone_e164) {
                return NextResponse.json({ error: "Invalid or expired reset code. Please request a new one." }, { status: 400 });
            }

            const local = await verifyPasswordResetToken(user.phone_e164, token, false);
            if (!local.ok) {
                return NextResponse.json({ error: local.error }, { status: 401 });
            }

            return NextResponse.json({
                success: true,
                verified: true,
                message: "Code verified successfully.",
            });
        }

        // Standard request step (Send reset code)
        if (!user) {
            // Return success to prevent email/phone enumeration
            return NextResponse.json({
                success: true,
                message: "If an account exists with this detail, you will receive a password reset code on your registered mobile number.",
            });
        }

        // Only allow password reset for user accounts (not system staff/admin accounts)
        if (user.role !== "user") {
            return NextResponse.json({
                error: "Password reset is only available for resident user accounts. Please contact your system administrator.",
            }, { status: 403 });
        }

        if (!user.phone_e164 || !/^\d{10}$/.test(user.phone_e164)) {
            return NextResponse.json({
                error: "No verified mobile number is associated with this account. Please contact support.",
            }, { status: 400 });
        }

        // Server-side rate limit per user
        const lastRequest = forgotPasswordRateLimits.get(user.id);
        const now = Date.now();
        if (lastRequest && now - lastRequest < RATE_LIMIT_COOLDOWN_MS) {
            const waitSeconds = Math.ceil((RATE_LIMIT_COOLDOWN_MS - (now - lastRequest)) / 1000);
            return NextResponse.json({
                error: `Please wait ${waitSeconds}s before requesting another reset code.`,
            }, { status: 429 });
        }

        // Record timestamp
        forgotPasswordRateLimits.set(user.id, now);

        const phoneNumber = `+63${user.phone_e164}`;
        try {
            if (rawIdentifier.includes("@") && user.email) {
                const issued = await createPasswordResetToken(user.id, user.phone_e164);
                if ("error" in issued) {
                    return NextResponse.json({ error: issued.error }, { status: 429 });
                }
                await sendBrevoEmail({
                    to: user.email,
                    subject: "SpeakUp Payatas password reset code",
                    text: `Your SpeakUp Payatas reset code is ${issued.token}. It is valid for 5 minutes. If you did not ask for this, ignore this email.`,
                });
            } else {
                const issued = await createPasswordResetToken(user.id, user.phone_e164);
                if ("error" in issued) {
                    return NextResponse.json({ error: issued.error }, { status: 429 });
                }
                await sendVonageSms(
                    user.phone_e164,
                    `Your SpeakUp Payatas reset code is ${issued.token}. It is valid for 5 minutes.`,
                );
            }
        } catch (err) {
            console.error("[forgot-password] send error:", err);
            return NextResponse.json({
                error: err instanceof Error ? err.message : "Could not send the reset code.",
            }, { status: 503 });
        }

        const maskedPhone = phoneNumber.slice(0, 6) + " XXX X" + phoneNumber.slice(-3);
        const sentToEmail = rawIdentifier.includes("@") && Boolean(user.email);
        const baseMessage = sentToEmail
            ? "A password reset code has been sent to your email."
            : `A password reset code has been sent to your mobile number ending in ${phoneNumber.slice(-4)}.`;

        return NextResponse.json({
            success: true,
            message: baseMessage,
            maskedPhone,
            identifier: user.email || user.phone_e164,
            delivery: { backend: sentToEmail ? "brevo" : "vonage", mock: false },
        });
    } catch (e) {
        console.error("[forgot-password] error:", e);
        return NextResponse.json({ error: "Unable to process request. Please try again later." }, { status: 500 });
    }
}

/**
 * Verify reset token and update password
 */
export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const rawIdentifier = String(body?.identifier ?? body?.email ?? body?.phone ?? "").trim();
        const token = String(body?.token ?? "").trim();
        const newPassword = String(body?.newPassword ?? "").trim();

        if (!rawIdentifier || !token || !newPassword) {
            return NextResponse.json({ error: "Account identifier, reset code, and new password are required." }, { status: 400 });
        }

        // Password complexity validation
        const passwordValidation = validatePassword(newPassword);
        if (!passwordValidation.isValid) {
            return NextResponse.json({
                error: passwordValidation.errors[0] || "Password does not meet security requirements.",
            }, { status: 400 });
        }

        // Get user
        const user = await findUserByIdentifier(rawIdentifier);
        if (!user || !user.phone_e164) {
            return NextResponse.json({ error: "Invalid request. User not found." }, { status: 400 });
        }

        // Verify token
        const tokenValid = await verifyPasswordResetToken(user.phone_e164, token);
        if (!tokenValid.ok) {
            return NextResponse.json({ error: tokenValid.error || "Invalid or expired reset code." }, { status: 401 });
        }

        // Update password
        const { updateUserPassword } = await import("@/lib/app-users");
        await updateUserPassword(user.id, newPassword);
        await invalidatePasswordResetToken(user.phone_e164);

        return NextResponse.json({
            success: true,
            message: "Your password has been updated successfully. Please sign in with your new password.",
        });
    } catch (e) {
        console.error("[forgot-password] reset error:", e);
        return NextResponse.json({ error: "Unable to reset password. Please try again later." }, { status: 500 });
    }
}
