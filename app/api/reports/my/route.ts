import { NextResponse } from "next/server";
import { fetchReportsBase } from "@/lib/server-db";

function serverErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load reports";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET(request: Request) {
    try {
        const mockReports = await fetchReportsBase();
        const { searchParams } = new URL(request.url);
        const reporter_hash = searchParams.get("reporter_hash");
        if (!reporter_hash || reporter_hash.length < 8) {
            return NextResponse.json({ error: "reporter_hash required (min 8 chars)" }, { status: 400 });
        }
        const myReports = mockReports
            .filter((r) => r.reporter_hash.startsWith(reporter_hash))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((r) => ({
                id: r.id,
                receipt_id: r.receipt_id,
                category: r.category,
                description: r.description,
                severity: r.severity,
                status: r.status,
                verification_status: r.verification_status,
                submitted_at: r.submitted_at,
                created_at: r.created_at,
                action_history: r.action_history,
            }));

        const grouped: Record<string, typeof myReports> = {};
        for (const r of myReports) {
            const dateKey = r.created_at.slice(0, 10);
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(r);
        }

        return NextResponse.json({ reports: myReports, grouped, total: myReports.length });
    } catch (err) {
        return serverErrorResponse(err);
    }
}
