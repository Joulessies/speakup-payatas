import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/api-session";
import { getSupabaseAdmin } from "@/lib/supabase-server";

export async function POST(request: Request) {
    const gate = await requireAdminSession();
    if (!gate.ok) {
        return gate.response;
    }

    try {
        const body = await request.json();
        const { user_id, offense_number } = body as { user_id?: string; offense_number?: 1 | 2 | 3 };

        if (!user_id || !offense_number || ![1, 2, 3].includes(offense_number)) {
            return NextResponse.json({ error: "Missing or invalid user_id or offense_number" }, { status: 400 });
        }

        const supabase = getSupabaseAdmin();
        const { data: user, error: fetchErr } = await supabase
            .from("app_users")
            .select("*")
            .eq("id", user_id)
            .maybeSingle();

        if (fetchErr || !user) {
            return NextResponse.json({ error: "User not found" }, { status: 404 });
        }

        if (user.role !== "user") {
            return NextResponse.json({ error: "Cannot suspend administrators or staff accounts" }, { status: 400 });
        }

        // Calculate suspension duration
        let suspendedUntil: string | null = null;
        const now = new Date();

        if (offense_number === 1) {
            suspendedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
        } else if (offense_number === 2) {
            suspendedUntil = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
        } else if (offense_number === 3) {
            suspendedUntil = new Date(now.getTime() + 100 * 365.25 * 24 * 60 * 60 * 1000).toISOString(); // Permanent
        }

        const { error: updateErr } = await supabase
            .from("app_users")
            .update({
                suspended_until: suspendedUntil,
                suspension_offense: offense_number
            })
            .eq("id", user_id);

        if (updateErr) {
            return NextResponse.json({ error: updateErr.message }, { status: 500 });
        }

        // Create warning notification for the user
        const durationText = offense_number === 1 ? "24 hours" : offense_number === 2 ? "3 days" : "permanently";
        await supabase.from("notifications").insert({
            recipient_role: "user",
            recipient_hash: user.id,
            type: "status_update",
            title: "Account Suspended",
            message: `Your account has been suspended for ${durationText} due to a guidelines violation.`,
            read: false
        });

        return NextResponse.json({ success: true, suspended_until: suspendedUntil });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Internal server error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
