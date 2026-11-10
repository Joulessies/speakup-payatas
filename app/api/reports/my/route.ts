import { NextResponse } from "next/server";
import { normalizeActionHistory } from "@/lib/server-db";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { accountReporterHashFromSession } from "@/lib/reporter-identity";

function serverErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load reports";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const deviceHash = searchParams.get("reporter_hash")?.trim() || "";
        const accountHash = await accountReporterHashFromSession();
        const supabase = getSupabaseAdmin();

        // Reports filed on this browser before the account was linked still use the device code.
        // Move them onto the account so the same resident sees them on every browser.
        if (accountHash && deviceHash.length >= 8 && deviceHash !== accountHash) {
            await supabase.from("reports").update({ reporter_hash: accountHash }).eq("reporter_hash", deviceHash);
        }

        const hashes = [accountHash, deviceHash].filter((hash) => hash && hash.length >= 8);
        if (hashes.length === 0) {
            return NextResponse.json({ error: "reporter_hash required (min 8 chars)" }, { status: 400 });
        }

        const { data, error } = await supabase
            .from("reports")
            .select("id, receipt_id, category, description, severity, status, verification_status, submitted_at, created_at, action_history")
            .in("reporter_hash", hashes)
            .order("created_at", { ascending: false });

        if (error) throw new Error(error.message);

        const myReports = (data ?? []).map((r) => ({
            id: r.id,
            receipt_id: r.receipt_id,
            category: r.category,
            description: r.description,
            severity: r.severity,
            status: r.status,
            verification_status: r.verification_status,
            submitted_at: r.submitted_at,
            created_at: r.created_at,
            action_history: normalizeActionHistory(r.action_history),
        }));

        const grouped: Record<string, typeof myReports> = {};
        for (const r of myReports) {
            const dateKey = r.created_at.slice(0, 10);
            if (!grouped[dateKey]) grouped[dateKey] = [];
            grouped[dateKey].push(r);
        }

        return NextResponse.json({ reports: myReports, grouped, total: myReports.length });
    } catch (err) {
        return serverErrorResponse(err);
    }
}
