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
    const body = await request.json().catch(() => null) as {
        report_id?: unknown;
        eoc_status?: unknown;
        department?: unknown;
        responders?: unknown;
        remarks?: unknown;
    } | null;

    const reportId = typeof body?.report_id === "string" ? body.report_id : "";
    if (!reportId) return badRequest("Missing report.");

    let status: EocStatus | null = null;
    if (body?.eoc_status !== undefined) {
        if (typeof body.eoc_status !== "string" || !(EOC_STATUSES as readonly string[]).includes(body.eoc_status)) {
            return badRequest("Unknown status.");
        }
        status = body.eoc_status as EocStatus;
    }

    try {
        const supabase = getSupabaseAdmin();
        const { data: report, error: readError } = await supabase
            .from("reports")
            .select("id, action_history")
            .eq("id", reportId)
            .maybeSingle();
        if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
        if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });

        if (status) {
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
        }

        const detailUpdates: Record<string, unknown> = {};
        if (status) detailUpdates.eoc_status = status;
        if (typeof body?.department === "string") detailUpdates.concern_department = body.department.trim();
        if (typeof body?.responders === "string") detailUpdates.responders = body.responders.trim();
        if (typeof body?.remarks === "string") detailUpdates.remarks = body.remarks.trim();

        if (Object.keys(detailUpdates).length > 0) {
            // Check if intake details record already exists
            const { data: existing } = await supabase
                .from(INTAKE_DETAILS_TABLE)
                .select("report_id")
                .eq("report_id", reportId)
                .maybeSingle();

            if (!existing) {
                await supabase
                    .from(INTAKE_DETAILS_TABLE)
                    .insert({
                        report_id: reportId,
                        source: "web",
                        ...detailUpdates,
                    });
            } else {
                await supabase
                    .from(INTAKE_DETAILS_TABLE)
                    .update(detailUpdates)
                    .eq("report_id", reportId);
            }
        }

        return NextResponse.json({ success: true, ...detailUpdates });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Could not update the record.";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
