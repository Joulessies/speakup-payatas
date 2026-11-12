import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/api-session";
import { loadConcernLog } from "@/lib/concern-log";
import { buildLogbookSheet, manilaDayRange } from "@/lib/logbook";

export async function GET(request: Request) {
    const auth = await requireStaffSession();
    if (!auth.ok) return auth.response;

    const params = new URL(request.url).searchParams;
    const template = params.get("template") === "1";
    const date = params.get("date") ?? "";

    if (!template && date && !manilaDayRange(date)) {
        return NextResponse.json({ error: "Choose a valid date (YYYY-MM-DD)." }, { status: 400 });
    }

    try {
        const rows = template ? [] : await loadConcernLog(date);
        const file = await buildLogbookSheet(rows);
        const filename = template || rows.length === 0 ? "PAYATAS SPEAK UP.xlsx" : `PAYATAS SPEAK UP ${date}.xlsx`;

        return new NextResponse(new Uint8Array(file), {
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store",
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Could not build the logbook sheet.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
