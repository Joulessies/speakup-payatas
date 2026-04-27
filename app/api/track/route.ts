import { NextResponse } from "next/server";
import { mockReports, seedIfNeeded } from "../reports/route";
export async function GET(request: Request) {
    seedIfNeeded();
    const { searchParams } = new URL(request.url);
    const hash = searchParams.get("hash")?.trim();
    if (!hash) {
        return NextResponse.json({ error: "Missing hash parameter" }, { status: 400 });
    }
    const matched = mockReports
        .filter((r) => r.reporter_hash === hash ||
        r.reporter_hash.startsWith(hash) ||
        hash.startsWith(r.reporter_hash.slice(0, 12)))
        .map((r) => ({
        id: r.id,
        category: r.category,
        description: r.description,
        severity: r.severity,
        status: r.status,
        created_at: r.created_at,
        action_history: r.action_history ?? [],
    }))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return NextResponse.json({ reports: matched });
}
