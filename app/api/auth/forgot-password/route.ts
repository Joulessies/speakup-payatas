import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/app-users";
import { sendSemaphoreTransactionalSms } from "@/lib/semaphore";
import { createPasswordResetToken, verifyPasswordResetToken } from "@/lib/password-reset";
import { getSmsBackend, isMockSmsDelivery } from "@/lib/sms-provider";

/**
 * Request a password reset - sends OTP via SMS to registered phone
 */
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const email = String(body?.email ?? "").trim().toLowerCase();

        if (!email || !/\S+@\S+\.\S+/.test(email)) {
            return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
        }

        const user = await getUserByEmail(email);
        if (!user) {
            // Return success even if user not found to prevent email enumeration
            return NextResponse.json({ 
                success: true, 
                message: "If an account exists with this email, you will receive a password reset code on your registered mobile number." 
            });
        }

        // Only allow password reset for user accounts (not admin/staff system accounts)
        if (user.role !== "user") {
            return NextResponse.json({ 
                error: "Password reset is only available for user accounts. Please contact your administrator." 
            }, { status: 403 });
        }

        if (!user.phone_e164) {
            return NextResponse.json({ 
                error: "No mobile number associated with this account. Please contact support." 
            }, { status: 400 });
        }

        // Create reset token
        const token = await createPasswordResetToken(user.id, user.phone_e164);

        // Send SMS with reset code
        const phoneNumber = `+63${user.phone_e164}`;
        const message = `SpeakUp Payatas: Your password reset code is ${token}. This code expires in 15 minutes. Do not share this code with anyone.`;

        const mockMode = isMockSmsDelivery();
        const backend = getSmsBackend();
        if (mockMode) {
            // No SMS provider is configured. Log the code prominently so the developer can grab it
            // from the server console while running locally without a Semaphore/MessageBird account.
            console.warn(
                `[forgot-password] MOCK SMS — no SMS provider configured. Backend=${backend}. ` +
                `Code for ${phoneNumber}: ${token}. Set SEMAPHORE_API_KEY or MESSAGEBIRD_ACCESS_KEY to deliver real SMS.`
            );
        } else {
            void sendSemaphoreTransactionalSms(user.phone_e164, message).catch((err) => {
                console.error("[forgot-password] SMS error:", err instanceof Error ? err.message : err);
            });
        }

        // Mask phone number for display (e.g., +63 9XX XXX X123)
        const maskedPhone = phoneNumber.slice(0, 4) + " " + phoneNumber.slice(4, 7) + " XXX X" + phoneNumber.slice(-3);

        const baseMessage = `A password reset code has been sent to your registered mobile number ending in ${phoneNumber.slice(-4)}.`;
        const hint = mockMode
            ? "Dev mode: no SMS provider configured — check the server console for the code, or set SEMAPHORE_API_KEY / MESSAGEBIRD_ACCESS_KEY in .env.local to send real SMS."
            : null;

        return NextResponse.json({
            success: true,
            message: baseMessage,
            maskedPhone,
            email, // Include email for the reset flow
            delivery: {
                backend,
                mock: mockMode,
                hint,
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
        const email = String(body?.email ?? "").trim().toLowerCase();
        const token = String(body?.token ?? "").trim();
        const newPassword = String(body?.newPassword ?? "").trim();

        if (!email || !token || !newPassword) {
            return NextResponse.json({ error: "Email, reset code, and new password are required." }, { status: 400 });
        }

        // Get user
        const user = await getUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: "Invalid request." }, { status: 400 });
        }

        // Verify token
        const tokenValid = await verifyPasswordResetToken(user.id, token);
        if (!tokenValid) {
            return NextResponse.json({ error: "Invalid or expired reset code. Please request a new one." }, { status: 401 });
        }

        // Update password
        const { updateUserPassword } = await import("@/lib/app-users");
        await updateUserPassword(user.id, newPassword);

        return NextResponse.json({ 
            success: true, 
            message: "Your password has been updated successfully. Please sign in with your new password." 
        });
    } catch (e) {
        console.error("[forgot-password] reset error:", e);
        return NextResponse.json({ error: "Unable to reset password. Please try again later." }, { status: 500 });
    }
}
