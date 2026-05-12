import { NextResponse } from "next/server";
import { fetchReportsBase } from "@/lib/server-db";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function serverErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Transparency feed failed";
    return NextResponse.json({ error: message }, { status: 503 });
}

interface FeedbackRow {
    report_id: string | null;
    rating: number;
    comment: string | null;
    created_at: string;
    updated_at?: string | null;
}

export async function GET(request: Request) {
    try {
        const mockReports = await fetchReportsBase();
        const { searchParams } = new URL(request.url);
        const category = searchParams.get("category");
        const limit = Number(searchParams.get("limit") ?? "20");

        const filteredResolved = mockReports
            .filter((r) => r.status === "resolved" && r.verification_status !== "spam")
            .filter((r) => (category ? r.category === category : true))
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .slice(0, Math.max(1, Math.min(limit, 50)));

        // Pull any feedback the residents left for these reports. Failures here are non-fatal — the
        // transparency feed still renders without ratings.
        const ids = filteredResolved.map((r) => r.id);
        const feedbackByReport = new Map<string, { rating: number; comment: string | null; created_at: string }[]>();
        let totalRating = 0;
        let ratingCount = 0;
        if (ids.length > 0) {
            try {
                const { data } = await getSupabaseAdmin()
                    .from("feedback")
                    .select("report_id, rating, comment, created_at, updated_at")
                    .in("report_id", ids);
                const rows = (data ?? []) as FeedbackRow[];
                for (const row of rows) {
                    if (!row.report_id) continue;
                    const bucket = feedbackByReport.get(row.report_id) ?? [];
                    bucket.push({ rating: row.rating, comment: row.comment, created_at: row.updated_at || row.created_at });
                    feedbackByReport.set(row.report_id, bucket);
                    totalRating += row.rating;
                    ratingCount += 1;
                }
            } catch {
                // Best-effort — leave feedbackByReport empty.
            }
        }

        const resolved = filteredResolved.map((r) => {
            const entries = (feedbackByReport.get(r.id) ?? []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            const ratings = entries.map((e) => e.rating);
            const avg = ratings.length > 0 ? Math.round((ratings.reduce((s, n) => s + n, 0) / ratings.length) * 10) / 10 : null;
            return {
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
                feedback: {
                    count: entries.length,
                    average_rating: avg,
                    entries: entries.slice(0, 3).map((e) => ({
                        rating: e.rating,
                        comment: e.comment ?? "",
                        date: e.created_at,
                    })),
                },
            };
        });

        const overallAverage = ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : null;

        return NextResponse.json({
            reports: resolved,
            total: resolved.length,
            feedback_summary: {
                total_feedback: ratingCount,
                average_rating: overallAverage,
            },
        });
    } catch (err) {
        return serverErrorResponse(err);
    }
}
