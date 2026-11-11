import { createHash, randomBytes, randomUUID } from "node:crypto";
import { classifyReport } from "@/lib/classification";
import { PAYATAS_CENTER } from "@/lib/payatas-boundary";
import { INTAKE_DETAILS_TABLE, MISSING_MIGRATION_MESSAGE } from "@/lib/server-db";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { EOC_STATUS_LABELS, INTAKE_SOURCE_LABELS, reportStatusForEoc, type ReportAction } from "@/types";
import type { LogbookEntry } from "@/lib/logbook";

export async function saveEncodedConcern(entry: LogbookEntry, actor: { role: "admin" | "staff"; username: string }) {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const receivedIso = entry.receivedAt.toISOString();
    const nowIso = now.toISOString();
    const workflowStatus = reportStatusForEoc(entry.eocStatus);
    const actionHistory: ReportAction[] = [
        {
            id: randomUUID(),
            status: "pending",
            note: `Concern received via ${INTAKE_SOURCE_LABELS[entry.source]} and encoded by barangay staff.`,
            actor: "Resident",
            created_at: receivedIso,
        },
    ];
    if (workflowStatus !== "pending") {
        actionHistory.push({
            id: randomUUID(),
            status: workflowStatus,
            note: `Status set to ${EOC_STATUS_LABELS[entry.eocStatus]} when the concern was encoded.`,
            actor: actor.role === "admin" ? "Admin" : "Staff",
            created_at: nowIso,
        });
    }

    const { data: report, error: reportError } = await supabase
        .from("reports")
        .insert({
            receipt_id: `SPK-${Date.now().toString(36).toUpperCase().slice(-4)}${randomBytes(2).toString("hex").toUpperCase()}`,
            reporter_hash: createHash("sha256").update(randomUUID()).digest("hex"),
            category: entry.category,
            description: entry.description,
            latitude: PAYATAS_CENTER.lat,
            longitude: PAYATAS_CENTER.lng,
            severity: entry.severity,
            status: workflowStatus,
            verification_status: "valid",
            verified_at: nowIso,
            is_flagged: false,
            ai_category: classifyReport(entry.description),
            created_at: receivedIso,
            submitted_at: receivedIso,
            action_history: actionHistory,
        })
        .select("id, receipt_id")
        .single();

    if (reportError || !report) {
        throw new Error(reportError?.message?.includes("reports_category_check") ? MISSING_MIGRATION_MESSAGE : (reportError?.message ?? "Failed to save the report."));
    }

    const { error: detailsError } = await supabase.from(INTAKE_DETAILS_TABLE).insert({
        report_id: report.id,
        source: entry.source,
        nature_of_concern: entry.nature,
        area: entry.area,
        concern_department: entry.department,
        location_known: false,
        reporter_name: entry.name,
        reporter_contact: entry.contact,
        reporter_address: entry.address,
        reporter_age: entry.age,
        reporter_gender: entry.gender,
        responders: entry.responders,
        remarks: entry.remarks,
        eoc_staff: entry.eocStaff,
        eoc_status: entry.eocStatus,
        encoded_by: actor.username,
    });

    if (detailsError) {
        await supabase.from("reports").delete().eq("id", report.id);
        if (/eoc_staff|eoc_status/i.test(detailsError.message) || detailsError.code === "42703" || detailsError.code === "PGRST204") {
            throw new Error(MISSING_MIGRATION_MESSAGE);
        }
        throw new Error(detailsError.message);
    }

    return { id: report.id as string, receipt_id: report.receipt_id as string | null };
}
