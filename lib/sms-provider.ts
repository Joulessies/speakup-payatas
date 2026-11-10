/**
 * Delivery backends: mock logs only; Semaphore & MessageBird send real SMS (paid).
 */

export type SmsBackend = "mock" | "semaphore" | "messagebird" | "textbelt" | "textbee" | "brevo";

function explicitProvider(): string {
    return (process.env.SMS_PROVIDER ?? "").trim().toLowerCase();
}

export function getSmsBackend(): SmsBackend {
    const p = explicitProvider();
    if (p === "mock") {
        return "mock";
    }
    if (p === "textbee") {
        return "textbee";
    }
    if (p === "brevo") {
        return "brevo";
    }
    if (p === "messagebird") {
        return "messagebird";
    }
    if (p === "semaphore") {
        return "semaphore";
    }
    if (p === "textbelt") {
        return "textbelt";
    }

    const hasTextbee = Boolean(process.env.TEXTBEE_API_KEY?.trim());
    const hasTextbelt = Boolean(process.env.TEXTBELT_KEY?.trim());
    const hasSem = Boolean(process.env.SEMAPHORE_API_KEY?.trim());
    const hasMb = Boolean(process.env.MESSAGEBIRD_ACCESS_KEY?.trim());

    if (hasTextbee) {
        return "textbee";
    }
    if (hasTextbelt) {
        return "textbelt";
    }
    if (hasMb) {
        return "messagebird";
    }
    if (hasSem) {
        return "semaphore";
    }
    return "mock";
}

/** True when OTP / notice SMS should not call Semaphore or MessageBird. */
export function isMockSmsDelivery(): boolean {
    return getSmsBackend() === "mock";
}

export function smsDeliveryKind(): SmsBackend {
    return getSmsBackend();
}

export function logMockSms(tag: string, payload: Record<string, unknown>): void {
    console.info(`[SpeakUp MOCK SMS:${tag}]`, JSON.stringify(payload));
}

/** Sends a short notice to a Philippine mobile. Returns false when no real SMS provider is configured. */
export async function sendNoticeSms(phoneLast10: string, message: string): Promise<boolean> {
    const digits = phoneLast10.replace(/\D/g, "").slice(-10);
    if (!/^\d{10}$/.test(digits))
        return false;
    const backend = getSmsBackend();
    if (backend === "mock") {
        logMockSms("notice", { to: digits, message });
        return false;
    }
    if (backend === "semaphore") {
        const { sendSemaphoreTransactionalSms } = await import("@/lib/semaphore");
        await sendSemaphoreTransactionalSms(digits, message);
        return true;
    }
    if (backend === "textbee") {
        const { sendTextbeeSms } = await import("@/lib/textbee-sms");
        const result = await sendTextbeeSms(digits, message);
        return result.success;
    }
    if (backend === "brevo") {
        const { sendBrevoSms } = await import("@/lib/brevo-sms");
        await sendBrevoSms(digits, message);
        return true;
    }
    if (backend === "messagebird") {
        const { sendMessageBirdSmsToPhLast10 } = await import("@/lib/messagebird-sms");
        await sendMessageBirdSmsToPhLast10(digits, message);
        return true;
    }
    if (backend === "textbelt") {
        const { sendTextbeltSms } = await import("@/lib/textbelt-sms");
        const result = await sendTextbeltSms(digits, message);
        return result.success;
    }
    return false;
}
