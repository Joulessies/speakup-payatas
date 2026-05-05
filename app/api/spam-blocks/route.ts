import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function configErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { reporter_hash, reason } = body as { reporter_hash?: string; reason?: string };
        if (!reporter_hash) {
            return NextResponse.json({ error: "reporter_hash required" }, { status: 400 });
        }
        const { data: existing } = await getSupabaseAdmin()
            .from("spam_blocks")
            .select("*")
            .eq("reporter_hash", reporter_hash)
            .maybeSingle();
        if (existing) {
            return NextResponse.json({ error: "Already blocked", block: existing }, { status: 409 });
        }
        const { error } = await getSupabaseAdmin().from("spam_blocks").insert({
            reporter_hash,
            blocked_by: "Admin",
            reason: reason || "Manually blocked by admin",
        });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (err) {
        if (err instanceof SyntaxError) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        return configErrorResponse(err);
    }
}

export async function GET() {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from("spam_blocks")
            .select("*")
            .order("blocked_at", { ascending: false });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        return NextResponse.json({ blocks: data ?? [], total: (data ?? []).length });
    } catch (err) {
        return configErrorResponse(err);
    }
}

export async function DELETE(request: Request) {
    try {
        const body = await request.json();
        const { reporter_hash } = body as { reporter_hash?: string };
        if (!reporter_hash) return NextResponse.json({ error: "reporter_hash required" }, { status: 400 });
        const { error } = await getSupabaseAdmin().from("spam_blocks").delete().eq("reporter_hash", reporter_hash);
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ success: true });
    } catch (err) {
        if (err instanceof SyntaxError) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        return configErrorResponse(err);
    }
}
