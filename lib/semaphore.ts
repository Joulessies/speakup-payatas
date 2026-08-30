import { sendMessageBirdSmsToPhLast10 } from "@/lib/messagebird-sms";
import { sendTextbeltSms } from "@/lib/textbelt-sms";
import { sendTextbeeSms } from "@/lib/textbee-sms";
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

    const backend = getSmsBackend();

    if (backend === "textbee") {
        await sendTextbeeSms(phoneLast10, otpMessageBody(code));
        return;
    }

    if (backend === "textbelt") {
        await sendTextbeltSms(phoneLast10, otpMessageBody(code));
        return;
    }

    if (backend === "messagebird") {
        await sendMessageBirdSmsToPhLast10(phoneLast10, otpMessageBody(code));
        return;
    }

    const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("Missing SEMAPHORE_API_KEY for SMS OTP.");
    }

    const number = normalizeTo63(phoneLast10);
    const sendername = process.env.SEMAPHORE_SENDERNAME?.trim();
    const messageBody = otpMessageBody(code);

    const payload = new URLSearchParams();
    payload.set("apikey", apiKey);
    payload.set("number", number);
    payload.set("message", messageBody);
    if (sendername) {
        payload.set("sendername", sendername);
    }

    const res = await fetch(`${SEMAPHORE_BASE_URL}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
        let cleanMsg = text;
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed[0]?.message) {
                cleanMsg = parsed[0].message;
            } else if (typeof parsed === "string") {
                cleanMsg = parsed;
            }
        } catch { }

        if (res.status === 403 && cleanMsg.toLowerCase().includes("not yet been approved")) {
            throw new Error("Your Semaphore SMS account is pending approval. Please verify your email / phone on semaphore.co to enable sending.");
        }
        throw new Error(`Semaphore SMS failed (${res.status}): ${cleanMsg || "Unknown error"}`);
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

    const backend = getSmsBackend();

    if (backend === "textbee") {
        await sendTextbeeSms(phoneLast10, message.trim());
        return;
    }

    if (backend === "textbelt") {
        await sendTextbeltSms(phoneLast10, message.trim());
        return;
    }

    if (backend === "messagebird") {
        await sendMessageBirdSmsToPhLast10(phoneLast10, message.trim());
        return;
    }

    const apiKey = process.env.SEMAPHORE_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("Missing SEMAPHORE_API_KEY for SMS.");
    }

    const number = normalizeTo63(phoneLast10);
    const sendername = process.env.SEMAPHORE_SENDERNAME?.trim();

    const payload = new URLSearchParams();
    payload.set("apikey", apiKey);
    payload.set("number", number);
    payload.set("message", message.trim());
    if (sendername) {
        payload.set("sendername", sendername);
    }

    const res = await fetch(`${SEMAPHORE_BASE_URL}/messages`, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
        let cleanMsg = text;
        try {
            const parsed = JSON.parse(text);
            if (Array.isArray(parsed) && parsed[0]?.message) {
                cleanMsg = parsed[0].message;
            } else if (typeof parsed === "string") {
                cleanMsg = parsed;
            }
        } catch { }

        if (res.status === 403 && cleanMsg.toLowerCase().includes("not yet been approved")) {
            throw new Error("Your Semaphore SMS account is pending approval. Please verify your email / phone on semaphore.co to enable sending.");
        }
        throw new Error(`Semaphore SMS failed (${res.status}): ${cleanMsg || "Unknown error"}`);
    }
}
