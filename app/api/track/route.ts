import { NextResponse } from "next/server";
import { fetchReportsBase } from "@/lib/server-db";

function serverErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Track lookup failed";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET(request: Request) {
    try {
        const mockReports = await fetchReportsBase();
        const { searchParams } = new URL(request.url);
        const query = (searchParams.get("q") ?? searchParams.get("hash"))?.trim();
        if (!query) {
            return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
        }
        const normalizedQuery = query.toLowerCase();
        const matched = mockReports
            .filter((r) => {
                const hash = r.reporter_hash.toLowerCase();
                const receipt = r.receipt_id?.toLowerCase() ?? "";
                return (hash === normalizedQuery ||
                    hash.startsWith(normalizedQuery) ||
                    normalizedQuery.startsWith(hash.slice(0, 12)) ||
                    (receipt.length > 0 &&
                        (receipt === normalizedQuery || receipt.startsWith(normalizedQuery))));
            })
            .map((r) => ({
                id: r.id,
                receipt_id: r.receipt_id,
                category: r.category,
                description: r.description,
                severity: r.severity,
                status: r.status,
                created_at: r.created_at,
                action_history: r.action_history ?? [],
            }))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return NextResponse.json({ reports: matched });
    } catch (err) {
        return serverErrorResponse(err);
    }
}
