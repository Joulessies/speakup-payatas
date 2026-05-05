import { NextResponse } from "next/server";
import { getUserByPhoneLast10 } from "@/lib/app-users";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const action = String(body?.action ?? "login").trim().toLowerCase();
        const phone = String(body?.phone ?? "").replace(/\D/g, "").slice(-10);

        if (!/^\d{10}$/.test(phone)) {
            return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
        }

        if (action === "register") {
            return NextResponse.json(
                { error: "Email OTP is for existing accounts. Register first using Password." },
                { status: 400 },
            );
        }

        const row = await getUserByPhoneLast10(phone);
        if (!row || !row.email) {
            return NextResponse.json(
                { error: "No email account found for this mobile number. Register first using Password." },
                { status: 404 },
            );
        }

        return NextResponse.json({ email: row.email });
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Unable to resolve account email." },
            { status: 400 },
        );
    }
}
