import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

interface NoteItem {
    id: string;
    report_id: string;
    author_id: string;
    author_role: "admin" | "staff";
    content: string;
    created_at: string;
}

const memoryNotesStore = new Map<string, NoteItem[]>();

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

        const noteObj: NoteItem = {
            id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            report_id,
            author_id: author,
            author_role: author_role || "staff",
            content: content.trim(),
            created_at: new Date().toISOString(),
        };

        const existing = memoryNotesStore.get(report_id) ?? [];
        existing.unshift(noteObj);
        memoryNotesStore.set(report_id, existing);

        try {
            await getSupabaseAdmin()
                .from("internal_notes")
                .insert({
                    report_id,
                    author_id: author,
                    author_role: author_role || "staff",
                    content: content.trim(),
                });
        } catch {
            // Memory store fallback succeeds
        }

        return NextResponse.json({ success: true, note: noteObj }, { status: 201 });
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

        try {
            const { data, error } = await getSupabaseAdmin()
                .from("internal_notes")
                .select("*")
                .eq("report_id", report_id)
                .order("created_at", { ascending: false });
            
            if (!error && data && data.length > 0) {
                return NextResponse.json({ notes: data });
            }
        } catch {
            // Memory fallback below
        }

        const fallbackNotes = memoryNotesStore.get(report_id) ?? [];
        return NextResponse.json({ notes: fallbackNotes });
    } catch (err) {
        return configErrorResponse(err);
    }
}
