import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function configErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { report_id, author, author_role, content } = body as {
            report_id?: string;
            author?: string;
            author_role?: "admin" | "staff";
            content?: string;
        };
        if (!report_id || !author || !content?.trim()) {
            return NextResponse.json({ error: "Missing required fields (report_id, author, content)" }, { status: 400 });
        }
        const { data, error } = await getSupabaseAdmin()
            .from("internal_notes")
            .insert({
                report_id,
                author_id: author,
                author_role: author_role || "staff",
                content: content.trim(),
            })
            .select("*")
            .single();
        if (error || !data) {
            return NextResponse.json({ error: error?.message ?? "Failed to create note" }, { status: 500 });
        }
        return NextResponse.json({ success: true, note: data }, { status: 201 });
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
        const report_id = searchParams.get("report_id");
        if (!report_id) {
            return NextResponse.json({ error: "Missing report_id" }, { status: 400 });
        }
        const { data, error } = await getSupabaseAdmin()
            .from("internal_notes")
            .select("*")
            .eq("report_id", report_id)
            .order("created_at", { ascending: false });
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }
        const notes = data ?? [];
        return NextResponse.json({ notes });
    } catch (err) {
        return configErrorResponse(err);
    }
}
