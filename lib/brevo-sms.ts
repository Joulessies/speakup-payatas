/** Sends one SMS through Brevo. Requires an API key that starts with xkeysib-. */

function brevoApiKey() {
    return process.env.BREVO_API_KEY?.trim() || "";
}

function senderName() {
    const raw = (process.env.BREVO_SMS_SENDER?.trim() || "SPKPAYATAS").replace(/[^A-Za-z0-9]/g, "");
    return raw.slice(0, 11);
}

export async function sendBrevoSms(phoneLast10: string, message: string) {
    const digits = phoneLast10.replace(/\D/g, "").slice(-10);
    if (!/^\d{10}$/.test(digits)) {
        throw new Error("Enter a valid PH mobile number.");
    }
    const text = message.trim();
    if (!text) {
        throw new Error("SMS message cannot be empty.");
    }
    const apiKey = brevoApiKey();
    if (!apiKey) {
        throw new Error("Missing BREVO_API_KEY. In Brevo, create an API key that starts with xkeysib-.");
    }
    if (apiKey.startsWith("xsmtpsib-")) {
        throw new Error("The Brevo SMTP key cannot send SMS. Create an API key that starts with xkeysib- and set BREVO_API_KEY.");
    }
    const sender = senderName();
    if (sender.length < 3) {
        throw new Error("BREVO_SMS_SENDER must be 3 to 11 letters or numbers.");
    }

    const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            "api-key": apiKey,
        },
        body: JSON.stringify({
            sender,
            recipient: `63${digits}`,
            content: text,
            type: "transactional",
            unicodeEnabled: false,
        }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const detail = String(data?.message || data?.code || res.statusText || "Unknown error");
        if (/unrecognised ip|unauthorized ip|authorised_ips/i.test(detail)) {
            throw new Error("Brevo blocked this network. In Brevo, open Security → Authorized IPs and add this IP, or turn IP restriction off.");
        }
        if (/key not found/i.test(detail) || apiKey.startsWith("xsmtpsib-")) {
            throw new Error("Brevo rejected the SMS key. Use an API key that starts with xkeysib-.");
        }
        throw new Error(`Brevo SMS failed (${res.status}): ${detail}`);
    }
    return data;
}
