import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { normalizeActionHistory } from "@/lib/server-db";

function serverErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Track lookup failed";
    console.error("[/api/track] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = (searchParams.get("q") ?? searchParams.get("hash"))?.trim();
        if (!query) {
            return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
        }
        
        // Build a safe OR filter.
        // In PostgREST's .or() string, ilike wildcards must be provided as
        // `column.ilike.*value*` — the % sign is the SQL wildcard but the
        // Supabase JS SDK .or() helper expects the raw filter string where
        // the percent sign must be included literally (not URL-encoded).
        // We use a single .or() with three arms, but wrap each ilike value
        // in quotes so the filter parser doesn't choke on the % character.
        const prefix = `${query}%`;
        const { data, error } = await getSupabaseAdmin()
            .from("reports")
            .select("id, receipt_id, category, description, severity, status, created_at, action_history")
            .or(
                [
                    `id.eq.${query}`,
                    `reporter_hash.ilike.${prefix}`,
                    `receipt_id.ilike.${prefix}`,
                ].join(",")
            )
            .order("created_at", { ascending: false })
            .limit(50);
            
        if (error) throw new Error(error.message);
        
        const matched = (data ?? []).map((r) => ({
            id: r.id,
            receipt_id: r.receipt_id,
            category: r.category,
            description: r.description,
            severity: r.severity,
            status: r.status,
            created_at: r.created_at,
            action_history: normalizeActionHistory(r.action_history),
        }));
        
        return NextResponse.json({ reports: matched });
    } catch (err) {
        return serverErrorResponse(err);
    }
}
