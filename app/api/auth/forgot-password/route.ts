import { NextResponse } from "next/server";
import { getUserByEmail } from "@/lib/app-users";
import { sendSemaphoreTransactionalSms } from "@/lib/semaphore";
import { createPasswordResetToken, verifyPasswordResetToken } from "@/lib/password-reset";

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
        
        // Fire and forget SMS
        void sendSemaphoreTransactionalSms(user.phone_e164, message).catch((err) => {
            console.error("[forgot-password] SMS error:", err instanceof Error ? err.message : err);
        });

        // Mask phone number for display (e.g., +63 9XX XXX X123)
        const maskedPhone = phoneNumber.slice(0, 4) + " " + phoneNumber.slice(4, 7) + " XXX X" + phoneNumber.slice(-3);

        return NextResponse.json({ 
            success: true, 
            message: `A password reset code has been sent to your registered mobile number ending in ${phoneNumber.slice(-4)}.`,
            maskedPhone,
            email, // Include email for the reset flow
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
