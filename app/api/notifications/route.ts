import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function configErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get("role");
        const reporter_hash = searchParams.get("reporter_hash")?.trim();
        const unread_only = searchParams.get("unread_only") === "true";
        const limit = Number(searchParams.get("limit") ?? "20");

        let query = getSupabaseAdmin().from("notifications").select("*").order("created_at", { ascending: false });
        
        // Strict Role & Hash Scoping
        if (role === "admin") {
            query = query.or("recipient_role.eq.admin,recipient_role.is.null");
        } else if (role === "staff") {
            query = query.eq("recipient_role", "staff");
        } else {
            // Default to resident (user) role, strictly requiring exact reporter_hash match
            if (!reporter_hash) {
                return NextResponse.json({ notifications: [], unread_count: 0 });
            }
            query = query.eq("recipient_role", "user").eq("recipient_hash", reporter_hash);
        }

        if (unread_only) {
            query = query.eq("read", false);
        }

        const boundedLimit = Math.max(1, Math.min(limit, 50));
        const { data, error } = await query.limit(boundedLimit);
        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Unread Count Query with the exact same strict scoping
        let unreadQuery = getSupabaseAdmin().from("notifications").select("id", { count: "exact", head: true }).eq("read", false);
        if (role === "admin") {
            unreadQuery = unreadQuery.or("recipient_role.eq.admin,recipient_role.is.null");
        } else if (role === "staff") {
            unreadQuery = unreadQuery.eq("recipient_role", "staff");
        } else {
            if (!reporter_hash) {
                return NextResponse.json({ notifications: data ?? [], unread_count: 0 });
            }
            unreadQuery = unreadQuery.eq("recipient_role", "user").eq("recipient_hash", reporter_hash);
        }

        const { count, error: countError } = await unreadQuery;
        if (countError) {
            return NextResponse.json({ error: countError.message }, { status: 500 });
        }

        return NextResponse.json({ notifications: data ?? [], unread_count: count ?? 0 });
    } catch (err) {
        return configErrorResponse(err);
    }
}

export async function PATCH(request: Request) {
    try {
        const body = await request.json();
        const { notification_ids, mark_all_read, role, reporter_hash } = body as {
            notification_ids?: string[];
            mark_all_read?: boolean;
            role?: string;
            reporter_hash?: string;
        };

        if (mark_all_read) {
            let markQuery = getSupabaseAdmin().from("notifications").update({ read: true });
            
            if (role === "admin") {
                markQuery = markQuery.or("recipient_role.eq.admin,recipient_role.is.null");
            } else if (role === "staff") {
                markQuery = markQuery.eq("recipient_role", "staff");
            } else {
                const cleanHash = reporter_hash?.trim();
                if (!cleanHash) {
                    return NextResponse.json({ error: "reporter_hash required" }, { status: 400 });
                }
                markQuery = markQuery.eq("recipient_role", "user").eq("recipient_hash", cleanHash);
            }
            
            const { error } = await markQuery;
            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        if (notification_ids && Array.isArray(notification_ids)) {
            let markQuery = getSupabaseAdmin().from("notifications").update({ read: true }).in("id", notification_ids);
            if (role === "admin") {
                markQuery = markQuery.or("recipient_role.eq.admin,recipient_role.is.null");
            } else if (role === "staff") {
                markQuery = markQuery.eq("recipient_role", "staff");
            } else {
                const cleanHash = reporter_hash?.trim();
                if (!cleanHash) {
                    return NextResponse.json({ error: "reporter_hash required" }, { status: 400 });
                }
                markQuery = markQuery.eq("recipient_role", "user").eq("recipient_hash", cleanHash);
            }
            
            const { error } = await markQuery;
            if (error) {
                return NextResponse.json({ error: error.message }, { status: 500 });
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Provide notification_ids or mark_all_read" }, { status: 400 });
    } catch (err) {
        if (err instanceof SyntaxError) {
            return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
        }
        return configErrorResponse(err);
    }
}
