import { NextResponse } from "next/server";
import { invalidateSmsOtp, issueSmsOtp } from "@/lib/sms-otp";
import { sendVonageSms } from "@/lib/vonage-sms";

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
            await sendVonageSms(phone, `Your SpeakUp Payatas code is ${issued.code}. It is valid for 5 minutes.`);
        } catch (sendError) {
            await invalidateSmsOtp(phone);
            throw sendError;
        }
        return NextResponse.json({
            success: true,
            channel: "vonage",
            message: "Verification code sent to your mobile number.",
        });
    } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to send SMS.";
        return NextResponse.json({ error: message }, { status: 503 });
    }
}
