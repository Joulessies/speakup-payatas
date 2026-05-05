import { sendMessageBirdSmsToPhLast10 } from "@/lib/messagebird-sms";
import { getSmsBackend, isMockSmsDelivery, logMockSms } from "@/lib/sms-provider";

const SEMAPHORE_BASE_URL = "https://api.semaphore.co/api/v4";

function normalizeTo63(phoneLast10: string) {
    return `63${phoneLast10}`;
}

function otpMessageBody(code: string): string {
    const messageTemplate = process.env.SMS_OTP_MESSAGE?.trim()
        || process.env.SEMAPHORE_OTP_MESSAGE?.trim()
        || "Your SpeakUp Payatas OTP is {otp}. Valid for 5 minutes.";
    return messageTemplate.replace(/\{otp\}/g, code);
}

export async function sendSemaphoreOtpSms(phoneLast10: string, code: string) {
    if (isMockSmsDelivery()) {
        logMockSms("OTP", {
            to: `+63${phoneLast10}`,
            otp: code,
            hint: "Copy the otp value above to verify; no SMS was sent.",
        });
        return;
    }

    if (getSmsBackend() === "messagebird") {
        await sendMessageBirdSmsToPhLast10(phoneLast10, otpMessageBody(code));
        return;
    }

    const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("Missing SEMAPHORE_API_KEY for SMS OTP.");
    }

    const number = normalizeTo63(phoneLast10);
    const sendername = process.env.SEMAPHORE_SENDERNAME?.trim() || "SEMAPHORE";
    const messageTemplate = process.env.SMS_OTP_MESSAGE?.trim()
        || process.env.SEMAPHORE_OTP_MESSAGE?.trim()
        || "Your SpeakUp Payatas OTP is {otp}. Valid for 5 minutes.";

    const payload = new URLSearchParams();
    payload.set("apikey", apiKey);
    payload.set("number", number);
    payload.set("message", messageTemplate);
    payload.set("sendername", sendername);
    payload.set("code", code);

    const res = await fetch(`${SEMAPHORE_BASE_URL}/otp`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Semaphore request failed (${res.status}): ${text || "Unknown error"}`);
    }
}

/**
 * Sends a plain SMS (not OTP-specific). Recipient is PH number as last 10 digits → 63XXXXXXXXXX.
 */
export async function sendSemaphoreTransactionalSms(phoneLast10: string, message: string) {
    if (!message.trim()) {
        throw new Error("SMS message cannot be empty.");
    }
    if (isMockSmsDelivery()) {
        logMockSms("NOTICE", {
            to: `+63${phoneLast10}`,
            message: message.trim(),
        });
        return;
    }

    if (getSmsBackend() === "messagebird") {
        await sendMessageBirdSmsToPhLast10(phoneLast10, message.trim());
        return;
    }

    const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("Missing SEMAPHORE_API_KEY for SMS.");
    }

    const number = normalizeTo63(phoneLast10);
    const sendername = process.env.SEMAPHORE_SENDERNAME?.trim() || "SEMAPHORE";

    const payload = new URLSearchParams();
    payload.set("apikey", apiKey);
    payload.set("number", number);
    payload.set("message", message.trim());
    payload.set("sendername", sendername);

    const res = await fetch(`${SEMAPHORE_BASE_URL}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Semaphore messages failed (${res.status}): ${text || "Unknown error"}`);
    }
}
