import { getSupabaseAdmin } from "@/lib/supabase-server";
import { eocStatusFromReport, manilaDayRange, type LogbookExportRow } from "@/lib/logbook";
import type { BarangayArea, EocStatus, Gender, IntakeSource, NatureOfConcern, ReportCategory, ReportStatus } from "@/types";

export type ConcernLogRecord = LogbookExportRow & {
    id: string;
    receipt_id: string | null;
};

type ReportRow = {
    id: string;
    receipt_id: string | null;
    category: string;
    description: string | null;
    severity: number | null;
    status: string | null;
    created_at: string;
};

type DetailRow = {
    report_id: string;
    source: string;
    nature_of_concern: string | null;
    area: string | null;
    concern_department: string | null;
    reporter_name: string | null;
    reporter_contact: string | null;
    reporter_address: string | null;
    reporter_age: number | null;
    reporter_gender: string | null;
    responders: string | null;
    remarks: string | null;
    eoc_staff: string | null;
    eoc_status: string | null;
};

export async function loadConcernLog(date: string): Promise<ConcernLogRecord[]> {
    const range = manilaDayRange(date);
    if (!range) return [];
    const supabase = getSupabaseAdmin();
    const { data: reports, error } = await supabase
        .from("reports")
        .select("id, receipt_id, category, description, severity, status, created_at")
        .gte("created_at", range.start)
        .lte("created_at", range.end)
        .order("created_at", { ascending: false })
        .limit(1000);
    if (error) throw new Error(error.message);
    const reportRows = (reports ?? []) as ReportRow[];
    if (reportRows.length === 0) return [];

    const { data: details, error: detailsError } = await supabase
        .from("report_intake_details")
        .select("report_id, source, nature_of_concern, area, concern_department, reporter_name, reporter_contact, reporter_address, reporter_age, reporter_gender, responders, remarks, eoc_staff, eoc_status")
        .in("report_id", reportRows.map((report) => report.id))
        .neq("source", "web");
    if (detailsError) throw new Error(detailsError.message);

    const byReport = new Map(((details ?? []) as DetailRow[]).map((detail) => [detail.report_id, detail]));
    return reportRows.flatMap((report) => {
        const detail = byReport.get(report.id);
        if (!detail || detail.source === "web") return [];
        return [{
            id: report.id,
            receipt_id: report.receipt_id,
            created_at: report.created_at,
            eoc_staff: detail.eoc_staff,
            nature: detail.nature_of_concern as NatureOfConcern | null,
            source: detail.source as Exclude<IntakeSource, "web">,
            name: detail.reporter_name,
            sex: detail.reporter_gender as Gender | null,
            age: detail.reporter_age,
            address: detail.reporter_address,
            area: detail.area as BarangayArea | null,
            contact: detail.reporter_contact,
            concern: report.description ?? "",
            category: report.category as ReportCategory,
            severity: report.severity ?? 3,
            department: detail.concern_department,
            eoc_status: eocStatusFromReport(report.status as ReportStatus | null, detail.eoc_status as EocStatus | null),
            remarks: detail.remarks,
            responders: detail.responders,
        }];
    });
}
