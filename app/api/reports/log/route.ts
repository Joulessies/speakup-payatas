import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireStaffSession } from "@/lib/api-session";
import { loadConcernLog } from "@/lib/concern-log";
import { manilaDayRange } from "@/lib/logbook";
import { INTAKE_DETAILS_TABLE, MISSING_MIGRATION_MESSAGE } from "@/lib/server-db";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { EOC_STATUS_LABELS, EOC_STATUSES, reportStatusForEoc, type EocStatus, type ReportAction } from "@/types";

function badRequest(error: string) {
    return NextResponse.json({ error }, { status: 400 });
}

export async function GET(request: Request) {
    const auth = await requireStaffSession();
    if (!auth.ok) return auth.response;
    const date = new URL(request.url).searchParams.get("date") ?? "";
    if (!manilaDayRange(date)) return badRequest("Choose a valid date.");
    try {
        const rows = await loadConcernLog(date);
        return NextResponse.json({ rows });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Could not load the log.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PATCH(request: Request) {
    const auth = await requireStaffSession();
    if (!auth.ok) return auth.response;
    const body = await request.json().catch(() => null) as { report_id?: unknown; eoc_status?: unknown } | null;
    const reportId = typeof body?.report_id === "string" ? body.report_id : "";
    const eocStatus = body?.eoc_status;
    if (!reportId) return badRequest("Missing report.");
    if (typeof eocStatus !== "string" || !(EOC_STATUSES as readonly string[]).includes(eocStatus)) {
        return badRequest("Unknown status.");
    }
    const status = eocStatus as EocStatus;

    try {
        const supabase = getSupabaseAdmin();
        const { data: report, error: readError } = await supabase
            .from("reports")
            .select("id, action_history")
            .eq("id", reportId)
            .maybeSingle();
        if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
        if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

        const history = Array.isArray(report.action_history) ? [...report.action_history] : [];
        const action: ReportAction = {
            id: randomUUID(),
            status: reportStatusForEoc(status),
            note: `Status set to ${EOC_STATUS_LABELS[status]}.`,
            actor: auth.role === "admin" ? "Admin" : "Staff",
            created_at: new Date().toISOString(),
        };
        history.push(action);

        const { error: reportError } = await supabase
            .from("reports")
            .update({ status: reportStatusForEoc(status), action_history: history })
            .eq("id", reportId);
        if (reportError) return NextResponse.json({ error: reportError.message }, { status: 500 });

        const { error: detailError } = await supabase
            .from(INTAKE_DETAILS_TABLE)
            .update({ eoc_status: status })
            .eq("report_id", reportId);
        if (detailError) {
            const missingColumn = /eoc_status/i.test(detailError.message);
            return NextResponse.json(
                { error: missingColumn ? MISSING_MIGRATION_MESSAGE : detailError.message },
                { status: missingColumn ? 503 : 500 },
            );
        }
        return NextResponse.json({ success: true, eoc_status: status });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Could not update the status.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
