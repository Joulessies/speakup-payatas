/**
 * Delivery backends: mock logs only; Semaphore & MessageBird send real SMS (paid).
 */

export type SmsBackend = "mock" | "semaphore" | "messagebird";

function explicitProvider(): string {
    return (process.env.SMS_PROVIDER ?? "").trim().toLowerCase();
}

export function getSmsBackend(): SmsBackend {
    const p = explicitProvider();
    if (p === "mock") {
        return "mock";
    }
    if (p === "messagebird") {
        return "messagebird";
    }
    if (p === "semaphore") {
        return "semaphore";
    }

    const hasSem = Boolean(process.env.SEMAPHORE_API_KEY?.trim());
    const hasMb = Boolean(process.env.MESSAGEBIRD_ACCESS_KEY?.trim());

    if (process.env.NODE_ENV === "development" && !hasSem && !hasMb) {
        return "mock";
    }
    if (hasMb) {
        return "messagebird";
    }
    if (hasSem) {
        return "semaphore";
    }
    return process.env.NODE_ENV === "development" ? "mock" : "semaphore";
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
