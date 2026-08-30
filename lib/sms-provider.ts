/**
 * Delivery backends: mock logs only; Semaphore & MessageBird send real SMS (paid).
 */

export type SmsBackend = "mock" | "semaphore" | "messagebird" | "textbelt" | "textbee";

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
