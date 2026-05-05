/** Send outbound SMS via MessageBird REST API. Docs: https://developers.messagebird.com/api/sms-messaging */

const MESSAGEBIRD_MESSAGES_URL = "https://rest.messagebird.com/messages";

/** Philippine mobile stored as last 10 digits (e.g. 9171234567) → MSISDN without + prefix */
function phMsisdn(phoneLast10: string): string {
    return `63${phoneLast10}`;
}

/**
 * @param phoneLast10 — Philippine mobile last 10 digits
 * @param body — full SMS body (GSM 03.38 unless you need unicode)
 */
export async function sendMessageBirdSmsToPhLast10(phoneLast10: string, body: string): Promise<void> {
    const accessKey = process.env.MESSAGEBIRD_ACCESS_KEY?.trim();
    if (!accessKey) {
        throw new Error("Missing MESSAGEBIRD_ACCESS_KEY.");
    }
    const trimmed = body.trim();
    if (!trimmed) {
        throw new Error("SMS body cannot be empty.");
    }

    const originator = (process.env.MESSAGEBIRD_ORIGINATOR?.trim() || "SpeakUp").slice(0, 11);
    const recipients = phMsisdn(phoneLast10);

    const payload = new URLSearchParams();
    payload.set("recipients", recipients);
    payload.set("originator", originator);
    payload.set("body", trimmed);

    const res = await fetch(MESSAGEBIRD_MESSAGES_URL, {
        method: "POST",
        headers: {
            Authorization: `AccessKey ${accessKey}`,
            Accept: "application/json",
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload.toString(),
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`MessageBird SMS failed (${res.status}): ${text || "unknown error"}`);
    }
}
