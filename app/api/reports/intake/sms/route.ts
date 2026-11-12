import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/api-session";
import { sendNoticeSms } from "@/lib/sms-provider";

export async function POST(request: Request) {
  const auth = await requireStaffSession();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const contact = typeof body.contact === "string" ? body.contact.trim() : "";
    const receiptId = typeof body.receipt_id === "string" ? body.receipt_id.trim() : "";

    if (!contact) {
      return NextResponse.json({ error: "No mobile contact number provided" }, { status: 400 });
    }
    if (!receiptId) {
      return NextResponse.json({ error: "Missing receipt reference number" }, { status: 400 });
    }

    const cleanDigits = contact.replace(/\D/g, "").slice(-10);
    if (cleanDigits.length !== 10) {
      return NextResponse.json(
        { error: "Invalid mobile number. Must be a valid 10- or 11-digit Philippine number (e.g. 09171234567)." },
        { status: 400 }
      );
    }

    const message = `Barangay Payatas: Natanggap na po ang inyong concern. Reference no.: ${receiptId}. Maaari itong gamitin sa pag-follow up sa speakupayatas.com/track. Maraming salamat!`;
    const sent = await sendNoticeSms(cleanDigits, message);

    return NextResponse.json({ success: sent, message: "SMS sent successfully to complainant" });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Failed to send SMS";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}

