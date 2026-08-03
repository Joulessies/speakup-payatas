import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { normalizeActionHistory } from "@/lib/server-db";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";

function serverErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Track lookup failed";
    console.error("[/api/track] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: Request) {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
        const session = await verifyAuthToken(token);

        const { searchParams } = new URL(request.url);
        const query = (searchParams.get("q") ?? searchParams.get("hash"))?.trim();
        const reporterHash = searchParams.get("reporter_hash")?.trim();
        
        let dbQuery = getSupabaseAdmin()
            .from("reports")
            .select("id, receipt_id, category, description, severity, status, created_at, action_history, reporter_hash")
            .order("created_at", { ascending: false })
            .limit(100);

        // Allow searching across all reports for all users (Report History is public)
        if (query && query.toLowerCase() !== "all") {
            const prefix = `%${query}%`;
            dbQuery = dbQuery.or(
                [
                    `id.ilike.${prefix}`,
                    `reporter_hash.ilike.${prefix}`,
                    `receipt_id.ilike.${prefix}`,
                    `category.ilike.${prefix}`,
                    `description.ilike.${prefix}`,
                ].join(",")
            );
        }

        const { data, error } = await dbQuery;
            
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
