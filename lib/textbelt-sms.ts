/**
 * Textbelt Free SMS Integration (Zero signup required)
 * Uses the public free key 'textbelt' (1 free SMS per day per IP) or paid custom key.
 */

const TEXTBELT_ENDPOINT = "https://textbelt.com/text";

function normalizeToInternationalPh(phoneLast10: string): string {
    return `+63${phoneLast10.replace(/\D/g, "").slice(-10)}`;
}

export async function sendTextbeltSms(phoneLast10: string, message: string): Promise<{ success: boolean; textId?: string; quotaRemaining?: number }> {
    if (!message.trim()) {
        throw new Error("SMS message cannot be empty.");
    }

    const phone = normalizeToInternationalPh(phoneLast10);
    const key = process.env.TEXTBELT_KEY?.trim() || "textbelt";

    const res = await fetch(TEXTBELT_ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            phone,
            message: message.trim(),
            key,
        }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok || !data) {
        throw new Error(`Textbelt HTTP error (${res.status})`);
    }

    if (!data.success) {
        const err = data.error || "Textbelt failed to send SMS.";
        if (typeof err === "string" && err.toLowerCase().includes("disabled for this country")) {
            throw new Error("Textbelt has disabled free SMS for the Philippines (+63) due to spam prevention. Please use Semaphore or your Android SMS Gateway.");
        }
        if (typeof err === "string" && err.toLowerCase().includes("only one free text")) {
            throw new Error("Textbelt free quota reached for today (1 free SMS per day per IP). You can try again tomorrow or use Semaphore.");
        }
        throw new Error(`Textbelt error: ${err}`);
    }

    return {
        success: true,
        textId: data.textId,
        quotaRemaining: data.quotaRemaining,
    };
}
