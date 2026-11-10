/** Sends one plain-text email through the Brevo API. */

export async function sendBrevoEmail(input: { to: string; subject: string; text: string }) {
    const to = input.to.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        throw new Error("Invalid email address.");
    }
    const apiKey = process.env.BREVO_API_KEY?.trim() ?? "";
    const fromEmail = process.env.BREVO_SENDER_EMAIL?.trim() || "noreply@speakupayatas.com";
    const fromName = process.env.BREVO_SENDER_NAME?.trim() || "SpeakUp Payatas";
    if (!apiKey) {
        throw new Error("Missing BREVO_API_KEY.");
    }

    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
            accept: "application/json",
            "content-type": "application/json",
            "api-key": apiKey,
        },
        body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: to }],
            subject: input.subject.replace(/[\r\n]/g, " "),
            textContent: input.text,
        }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const detail = String(data?.message || data?.code || res.statusText || "Unknown error");
        throw new Error(`Brevo could not send the email (${detail}).`);
    }
    return data;
}
