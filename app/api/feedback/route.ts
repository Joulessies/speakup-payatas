import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function configErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { reporter_hash, report_id, rating, comment } = body as {
            reporter_hash?: string;
            report_id?: string;
            rating?: number;
            comment?: string;
        };
        if (!reporter_hash || !rating || rating < 1 || rating > 5) {
            return NextResponse.json({ error: "reporter_hash and rating (1-5) required" }, { status: 400 });
        }
        const supabase = getSupabaseAdmin();
        // If the user has already submitted feedback for this specific report, update it instead of inserting a duplicate.
        let existingId: string | null = null;
        if (report_id) {
            const { data: existing } = await supabase
                .from("feedback")
                .select("id")
                .eq("reporter_hash", reporter_hash)
                .eq("report_id", report_id)
                .maybeSingle();
            if (existing && typeof existing.id === "string") existingId = existing.id;
        }

        const payload = {
            reporter_hash,
            report_id: report_id || null,
            rating: Math.round(Math.max(1, Math.min(5, rating))),
            comment: (comment || "").trim(),
        };

        if (existingId) {
            const { data, error } = await supabase
                .from("feedback")
                .update({ ...payload, updated_at: new Date().toISOString() })
                .eq("id", existingId)
                .select("*")
                .single();
            if (error || !data) {
                return NextResponse.json({ error: error?.message ?? "Failed to save feedback" }, { status: 500 });
            }
            return NextResponse.json({ success: true, feedback: data, updated: true });
        }

        const { data, error } = await supabase
            .from("feedback")
            .insert(payload)
            .select("*")
            .single();
        if (error || !data) {
            return NextResponse.json({ error: error?.message ?? "Failed to save feedback" }, { status: 500 });
        }
        return NextResponse.json({ success: true, feedback: data }, { status: 201 });
    } catch (err) {
        if (err instanceof SyntaxError) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        return configErrorResponse(err);
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get("report_id");
        const reporterHash = searchParams.get("reporter_hash");
        let query = getSupabaseAdmin().from("feedback").select("*").order("created_at", { ascending: false });
        if (reportId) query = query.eq("report_id", reportId);
        if (reporterHash) query = query.eq("reporter_hash", reporterHash);

        const { data, error } = await query;
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const sorted = data ?? [];
        const avgRating = sorted.length > 0
            ? Math.round((sorted.reduce((s, f) => s + f.rating, 0) / sorted.length) * 10) / 10
            : 0;
        return NextResponse.json({ feedback: sorted, total: sorted.length, average_rating: avgRating });
    } catch (err) {
        return configErrorResponse(err);
    }
}
