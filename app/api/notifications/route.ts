import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-server";

function configErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Server configuration error";
    return NextResponse.json({ error: message }, { status: 503 });
}

interface NotificationItem {
    id: string;
    recipient_hash?: string;
    recipient_role?: string;
    type: string;
    title: string;
    message: string;
    report_id?: string;
    read: boolean;
    created_at: string;
}

const memoryNotifications: NotificationItem[] = [
    {
        id: "notif-welcome-1",
        type: "info",
        title: "Welcome to SpeakUp Payatas",
        message: "You can submit civic reports, track progress, and view community transparency updates.",
        read: false,
        created_at: new Date().toISOString(),
    }
];

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { recipient_hash, recipient_role, type, title, message, report_id } = body;
        if (!title || !message) {
            return NextResponse.json({ error: "Missing required notification fields" }, { status: 400 });
        }

        const newNotif: NotificationItem = {
            id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            recipient_hash: recipient_hash?.trim(),
            recipient_role: recipient_role || "user",
            type: type || "info",
            title,
            message,
            report_id,
            read: false,
            created_at: new Date().toISOString(),
        };

        memoryNotifications.unshift(newNotif);

        try {
            await getSupabaseAdmin().from("notifications").insert({
                recipient_hash: newNotif.recipient_hash,
                recipient_role: newNotif.recipient_role,
                type: newNotif.type,
                title: newNotif.title,
                message: newNotif.message,
                report_id: newNotif.report_id,
                read: false,
            });
        } catch {
            // Memory store fallback succeeds silently
        }

        return NextResponse.json({ success: true, notification: newNotif }, { status: 201 });
    } catch {
        return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const role = searchParams.get("role");
        const reporter_hash = searchParams.get("reporter_hash")?.trim();
        const unread_only = searchParams.get("unread_only") === "true";
        const limit = Number(searchParams.get("limit") ?? "20");

        try {
            let query = getSupabaseAdmin().from("notifications").select("*").order("created_at", { ascending: false });
            
            if (role === "admin") {
                query = query.or("recipient_role.eq.admin,recipient_role.is.null");
            } else if (role === "staff") {
                query = query.or("recipient_role.eq.staff,recipient_role.is.null");
            } else if (reporter_hash) {
                query = query.or(`recipient_hash.eq.${reporter_hash},recipient_role.is.null`);
            } else {
                query = query.or("recipient_role.eq.user,recipient_role.is.null");
            }

            if (unread_only) {
                query = query.eq("read", false);
            }

            const boundedLimit = Math.max(1, Math.min(limit, 50));
            const { data, error } = await query.limit(boundedLimit);

            if (!error && data && data.length > 0) {
                const unreadCount = data.filter(n => !n.read).length;
                return NextResponse.json({ notifications: data, unread_count: unreadCount });
            }
        } catch {
            // Fallback to memory store below
        }

        // Memory Store Fallback Filtering
        let list = [...memoryNotifications];
        if (role === "admin") {
            list = list.filter(n => !n.recipient_role || n.recipient_role === "admin");
        } else if (role === "staff") {
            list = list.filter(n => !n.recipient_role || n.recipient_role === "staff");
        } else if (reporter_hash) {
            list = list.filter(n => !n.recipient_hash || n.recipient_hash === reporter_hash || !n.recipient_role || n.recipient_role === "user");
        }

        if (unread_only) {
            list = list.filter(n => !n.read);
        }

        const bounded = list.slice(0, limit);
        const unread_count = list.filter(n => !n.read).length;
        return NextResponse.json({ notifications: bounded, unread_count });
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
            memoryNotifications.forEach(n => n.read = true);
            try {
                let markQuery = getSupabaseAdmin().from("notifications").update({ read: true });
                if (role === "admin") {
                    markQuery = markQuery.or("recipient_role.eq.admin,recipient_role.is.null");
                } else if (role === "staff") {
                    markQuery = markQuery.eq("recipient_role", "staff");
                } else if (reporter_hash) {
                    markQuery = markQuery.eq("recipient_hash", reporter_hash);
                }
                await markQuery;
            } catch {
                // Ignore DB error if memory updated
            }
            return NextResponse.json({ success: true });
        }

        if (notification_ids && Array.isArray(notification_ids)) {
            memoryNotifications.forEach(n => {
                if (notification_ids.includes(n.id)) n.read = true;
            });
            try {
                await getSupabaseAdmin().from("notifications").update({ read: true }).in("id", notification_ids);
            } catch {
                // Ignore DB error
            }
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ error: "Provide notification_ids or mark_all_read" }, { status: 400 });
    } catch (err) {
        return configErrorResponse(err);
    }
}
