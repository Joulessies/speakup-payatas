import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/api-session";
import { parseLogbookWorkbook, type LogbookRowError } from "@/lib/logbook";
import { saveEncodedConcern } from "@/lib/save-encoded-report";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(request: Request) {
    const auth = await requireStaffSession();
    if (!auth.ok) return auth.response;

    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
        return NextResponse.json({ error: "Choose an Excel file." }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
        return NextResponse.json({ error: "The file is larger than 5 MB." }, { status: 400 });
    }

    const parsed = parseLogbookWorkbook(Buffer.from(await file.arrayBuffer()));
    const errors: LogbookRowError[] = [...parsed.errors];
    let imported = 0;
    for (const item of parsed.entries) {
        try {
            await saveEncodedConcern(item.entry, auth);
            imported += 1;
        } catch (err) {
            errors.push({
                row: item.sheetRow,
                message: err instanceof Error ? err.message : "Could not save this row.",
            });
        }
    }

    if (imported === 0 && errors.length === 0) {
        errors.push({ row: 0, message: "No concerns found. Each row needs text in the Concern column." });
    }

    return NextResponse.json({ imported, errors });
}
