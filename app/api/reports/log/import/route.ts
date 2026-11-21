import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/api-session";
import { importLogbookFromExcel } from "@/lib/logbook-import";

export async function POST(request: Request) {
    const auth = await requireStaffSession();
    if (!auth.ok) return auth.response;

    try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file || typeof file === "string" || !(file instanceof Blob)) {
            return NextResponse.json({ error: "Please select an Excel file (.xlsx or .xls) to upload." }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        if (buffer.length === 0) {
            return NextResponse.json({ error: "The uploaded file is empty." }, { status: 400 });
        }

        const result = await importLogbookFromExcel(buffer, {
            staffUsername: auth.username,
        });

        if (!result.success && result.errors.length > 0 && result.imported === 0) {
            return NextResponse.json({
                error: result.errors[0] || "Failed to import rows from Excel.",
                details: result,
            }, { status: 422 });
        }

        return NextResponse.json({
            success: true,
            imported: result.imported,
            skipped: result.skipped,
            totalRows: result.totalRows,
            message: `Successfully imported ${result.imported} record${result.imported === 1 ? "" : "s"} from Excel.`,
            errors: result.errors,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to process Excel import.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
