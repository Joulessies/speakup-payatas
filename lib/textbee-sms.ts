/**
 * TextBee SMS Gateway Integration (Free Android Phone Gateway)
 * Documentation: https://textbee.dev
 */

function normalizeToInternationalPh(phoneLast10: string): string {
    const digits = phoneLast10.replace(/\D/g, "").slice(-10);
    return `+63${digits}`;
}

let cachedDeviceId: string | null = null;

async function resolveDeviceId(apiKey: string): Promise<string> {
    if (process.env.TEXTBEE_DEVICE_ID?.trim()) {
        return process.env.TEXTBEE_DEVICE_ID.trim();
    }
    if (cachedDeviceId) {
        return cachedDeviceId;
    }

    try {
        const res = await fetch("https://api.textbee.dev/api/v1/gateway/devices", {
            headers: { "x-api-key": apiKey },
        });
        const json = await res.json();
        const devices = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];
        const activeDevice = devices.find((d: any) => d.enabled !== false && d._id) || devices[0];
        if (activeDevice?._id) {
            cachedDeviceId = activeDevice._id;
            return activeDevice._id;
        }
    } catch { }

    throw new Error("Missing TEXTBEE_DEVICE_ID and no active device was found in your TextBee account.");
}

export async function sendTextbeeSms(phoneLast10: string, message: string): Promise<{ success: boolean; messageId?: string }> {
    const apiKey = process.env.TEXTBEE_API_KEY?.trim();

    if (!apiKey) {
        throw new Error("Missing TEXTBEE_API_KEY. Get your free API key at https://textbee.dev");
    }
    if (!message.trim()) {
        throw new Error("SMS message cannot be empty.");
    }

    const deviceId = await resolveDeviceId(apiKey);
    const recipient = normalizeToInternationalPh(phoneLast10);

    // TextBee v1 API endpoint
    const url = `https://api.textbee.dev/api/v1/gateway/devices/${encodeURIComponent(deviceId)}/sendSMS`;

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
        },
        body: JSON.stringify({
            recipients: [recipient],
            message: message.trim(),
        }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const errorDetail = data?.message || data?.error || res.statusText || "Failed to dispatch SMS via TextBee";
        throw new Error(`TextBee Gateway Error (${res.status}): ${errorDetail}`);
    }

    return {
        success: true,
        messageId: data?.id || data?.data?.id || "queued",
    };
}
