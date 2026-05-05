import { NextResponse } from "next/server";
import { fetchReportsBase } from "@/lib/server-db";

function serverErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Transparency feed failed";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET(request: Request) {
    try {
        const mockReports = await fetchReportsBase();
        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category");
        const limit = Number(searchParams.get("limit") ?? "20");

        const resolved = mockReports
            .filter((r) => r.status === "resolved" && r.verification_status !== "spam")
            .filter((r) => (category ? r.category === category : true))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, Math.max(1, Math.min(limit, 50)))
            .map((r) => ({
                id: r.id,
                category: r.category,
                description: r.description,
                latitude: Math.round(r.latitude * 100) / 100,
                longitude: Math.round(r.longitude * 100) / 100,
                severity: r.severity,
                status: r.status,
                created_at: r.created_at,
                resolved_at: r.action_history.find((a) => a.status === "resolved")?.created_at,
                actions_taken: r.action_history
                    .filter((a) => a.actor !== "Resident" && a.actor !== "System")
                    .map((a) => ({ status: a.status, note: a.note, date: a.created_at })),
            }));

        return NextResponse.json({ reports: resolved, total: resolved.length });
    } catch (err) {
        return serverErrorResponse(err);
    }
}
