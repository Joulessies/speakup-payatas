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

        let dbNotes: NoteItem[] = [];
        try {
            const { data, error } = await getSupabaseAdmin()
                .from("internal_notes")
                .select("*")
                .eq("report_id", report_id)
                .order("created_at", { ascending: false });
            
            if (!error && data) {
                dbNotes = data as NoteItem[];
            }
        } catch {
            // Memory store fallback
        }

        const memNotes = memoryNotesStore.get(report_id) ?? [];
        
        const combinedMap = new Map<string, NoteItem>();
        for (const n of [...dbNotes, ...memNotes]) {
            const key = n.id || `${n.content}_${n.created_at}`;
            if (!combinedMap.has(key)) {
                combinedMap.set(key, n);
            }
        }

        const notes = Array.from(combinedMap.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        return NextResponse.json({ notes });
    } catch (err) {
        return configErrorResponse(err);
    }
}
