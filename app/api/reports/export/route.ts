import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/api-session";
import { buildReportsExcel } from "@/lib/reports-excel";

export async function GET(request: Request) {
    // Requires authenticated Admin or Staff session
    const auth = await requireStaffSession();
    if (!auth.ok) {
        return auth.response;
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || undefined;
        const category = searchParams.get("category") || undefined;
        const startDate = searchParams.get("start_date") || undefined;
        const endDate = searchParams.get("end_date") || undefined;
        const limitParam = searchParams.get("limit");
        const limit = limitParam ? Number(limitParam) : undefined;

        const { buffer, filename, totalReports } = await buildReportsExcel({
            status,
            category,
            startDate,
            endDate,
            limit,
        });

        return new NextResponse(new Uint8Array(buffer), {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="${filename}"`,
                "Cache-Control": "no-store, no-cache, must-revalidate",
                "X-Total-Reports": String(totalReports),
            },
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to generate Excel export";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

