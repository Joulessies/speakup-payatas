import { NextResponse } from "next/server";
import { getUserByEmail, getUserByPhoneLast10 } from "@/lib/app-users";
import { sendSemaphoreTransactionalSms } from "@/lib/semaphore";
import { createPasswordResetToken, verifyPasswordResetToken, invalidatePasswordResetToken } from "@/lib/password-reset";
import { getSmsBackend, isMockSmsDelivery } from "@/lib/sms-provider";
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

            // Verify token without consuming it yet so the user can submit the new password in Step 3
            const tokenCheck = await verifyPasswordResetToken(user.phone_e164, token, false);
            if (!tokenCheck.ok) {
                return NextResponse.json({ error: tokenCheck.error }, { status: 401 });
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

        // Create reset token
        const tokenResult = await createPasswordResetToken(user.id, user.phone_e164);
        if ("error" in tokenResult) {
            return NextResponse.json({ error: tokenResult.error }, { status: 429 });
        }

        const token = tokenResult.token;
        const phoneNumber = `+63${user.phone_e164}`;
        const message = `SpeakUp Payatas: Your password reset code is ${token}. Valid for 5 minutes. Do not share this code.`;

        const mockMode = isMockSmsDelivery();
        const backend = getSmsBackend();

        if (mockMode) {
            console.warn(
                `[forgot-password] MOCK SMS — backend=${backend}. ` +
                `Code for ${phoneNumber}: ${token}. Set SEMAPHORE_API_KEY or MESSAGEBIRD_ACCESS_KEY in .env.local to send real SMS.`
            );
        } else {
            try {
                await sendSemaphoreTransactionalSms(user.phone_e164, message);
            } catch (err) {
                console.error("[forgot-password] SMS error:", err);
                return NextResponse.json({
                    error: err instanceof Error ? err.message : "SMS provider failed to send code. Please try again.",
                }, { status: 500 });
            }
        }

        // Mask phone number for display (e.g., +63 9XX XXX X879)
        const maskedPhone = phoneNumber.slice(0, 6) + " XXX X" + phoneNumber.slice(-3);
        const baseMessage = `A password reset code has been sent to your registered mobile number ending in ${phoneNumber.slice(-4)}.`;
        const hint = mockMode
            ? `Dev mode: Mock OTP code is [ ${token} ] (or check terminal log).`
            : null;

        return NextResponse.json({
            success: true,
            message: baseMessage,
            maskedPhone,
            identifier: user.email || user.phone_e164,
            delivery: {
                backend,
                mock: mockMode,
                hint,
                mock_code: mockMode ? token : undefined,
            },
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
