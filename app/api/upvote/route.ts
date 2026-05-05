import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function configErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function POST(request: Request) {
    try {
        const { report_id, reporter_hash } = await request.json();
        if (!report_id || !reporter_hash) {
            return NextResponse.json({ error: "Missing report_id or reporter_hash" }, { status: 400 });
        }
        const { data: report } = await getSupabaseAdmin().from("reports").select("id").eq("id", report_id).maybeSingle();
        if (!report?.id) {
            return NextResponse.json({ error: "Report not found" }, { status: 404 });
        }
        const { data: existing } = await getSupabaseAdmin()
            .from("report_confirmations")
            .select("id")
            .eq("report_id", report_id)
            .eq("reporter_hash", reporter_hash)
            .maybeSingle();
        if (existing) {
            const { count } = await getSupabaseAdmin()
                .from("report_confirmations")
                .select("id", { count: "exact", head: true })
                .eq("report_id", report_id);
            return NextResponse.json({ error: "Already confirmed", confirmations: count ?? 0 }, { status: 409 });
        }
        const { error } = await getSupabaseAdmin().from("report_confirmations").insert({ report_id, reporter_hash });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const { count } = await getSupabaseAdmin()
            .from("report_confirmations")
            .select("id", { count: "exact", head: true })
            .eq("report_id", report_id);
        return NextResponse.json({
            success: true,
            confirmations: count ?? 0,
        });
    }
    catch (err) {
        if (err instanceof SyntaxError) {
            return NextResponse.json({ error: "Invalid request" }, { status: 400 });
        }
        return configErrorResponse(err);
    }
}
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get("report_id");
        if (!reportId) {
            return NextResponse.json({ error: "Missing report_id" }, { status: 400 });
        }
        const { count } = await getSupabaseAdmin()
            .from("report_confirmations")
            .select("id", { count: "exact", head: true })
            .eq("report_id", reportId);
        return NextResponse.json({ confirmations: count });
    } catch (err) {
        return configErrorResponse(err);
    }
}
