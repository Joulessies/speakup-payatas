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
