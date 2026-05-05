import { NextResponse } from "next/server";
import { issueSmsOtp, invalidateSmsOtp } from "@/lib/sms-otp";
import { sendSemaphoreOtpSms } from "@/lib/semaphore";
import { isMockSmsDelivery } from "@/lib/sms-provider";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const phone = String(body?.phone ?? "").replace(/\D/g, "").slice(-10);
        if (!/^\d{10}$/.test(phone)) {
            return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
        }

        const issued = await issueSmsOtp(phone);
        if ("error" in issued) {
            return NextResponse.json({ error: issued.error }, { status: 429 });
        }

        try {
            await sendSemaphoreOtpSms(phone, issued.code);
        } catch (err) {
            await invalidateSmsOtp(phone);
            const message = err instanceof Error ? err.message : "Failed to send OTP";
            return NextResponse.json({ error: message }, { status: 503 });
        }

        const mock = isMockSmsDelivery();
        return NextResponse.json({
            success: true,
            message: mock
                ? "OTP generated (mock mode — check the dev server terminal for the code)."
                : "OTP sent.",
            mock_sms: mock || undefined,
        });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.includes("Missing Supabase configuration")) {
            return NextResponse.json({ error: "Server missing Supabase credentials for OTP storage." }, { status: 503 });
        }
        return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
}
