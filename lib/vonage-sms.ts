/** Sends one SMS through Vonage. Recipients are Philippine mobiles. */

function normalizeTo63(phoneLast10: string) {
    const digits = phoneLast10.replace(/\D/g, "").slice(-10);
    if (!/^\d{10}$/.test(digits)) {
        throw new Error("Enter a valid PH mobile number.");
    }
    return `63${digits}`;
}

export async function sendVonageSms(phoneLast10: string, message: string) {
    const text = message.trim();
    if (!text) {
        throw new Error("SMS message cannot be empty.");
    }
    const apiKey = process.env.VONAGE_API_KEY?.trim() ?? "";
    const apiSecret = process.env.VONAGE_API_SECRET?.trim() ?? "";
    const from = (process.env.VONAGE_FROM?.trim() || "SPKPAYATAS").slice(0, 11);
    if (!apiKey || !apiSecret) {
        throw new Error("Missing VONAGE_API_KEY or VONAGE_API_SECRET.");
    }

    const res = await fetch("https://rest.nexmo.com/sms/json", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
            api_key: apiKey,
            api_secret: apiSecret,
            to: normalizeTo63(phoneLast10),
            from,
            text,
        }),
    });
    const data = await res.json().catch(() => null);
    const result = data?.messages?.[0];
    if (!res.ok || !result || String(result.status) !== "0") {
        const detail = result?.["error-text"] || data?.["error-text"] || data?.title || res.statusText || "Unknown error";
        throw new Error(`Vonage could not send the text (${detail}).`);
    }
    return result;
}
