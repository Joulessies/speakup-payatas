import ExcelJS from "exceljs";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
    getQuarterName,
    LOGBOOK_COLUMN_CONFIGS,
    sanitizeExcelCell,
} from "@/lib/logbook";
import {
    CATEGORY_LABELS,
    BARANGAY_AREA_LABELS,
    resolveCategory,
    type BarangayArea,
} from "@/types";
import {
    applyGovernmentBanner,
    applyTableHeaders,
    styleDataRow,
    createKpiCard,
    createSummaryTable,
    type ColumnConfig,
    EXCEL_PALETTE,
} from "@/lib/excel-styles";

export interface ExportReportsOptions {
    status?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
}

interface RawReport {
    id: string;
    receipt_id?: string | null;
    category: string;
    description?: string | null;
    latitude: number;
    longitude: number;
    severity?: number | null;
    status?: string | null;
    verification_status?: string | null;
    photo_url?: string | null;
    created_at: string;
    reporter_hash?: string;
    verified_at?: string | null;
    verified_by?: string | null;
}

interface RawIntakeDetail {
    report_id: string;
    source?: string | null;
    nature_of_concern?: string | null;
    area?: string | null;
    reporter_name?: string | null;
    reporter_contact?: string | null;
    reporter_age?: number | null;
    reporter_gender?: string | null;
    reporter_address?: string | null;
    concern_department?: string | null;
    remarks?: string | null;
    responders?: string | null;
    encoded_by?: string | null;
    eoc_staff?: string | null;
    eoc_status?: string | null;
}

function formatManilaDateTime(isoString: string): string {
    try {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        }).formatToParts(new Date(isoString));
        const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
        return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
    } catch {
        return isoString;
    }
}

function getUrgencyText(severity: number | null | undefined): string {
    const s = severity ?? 1;
    if (s >= 4) return "HIGH";
    if (s >= 3) return "MEDIUM";
    return "LOW";
}

function getHumanCategory(cat: string): string {
    const resolved = resolveCategory(cat);
    if (resolved && CATEGORY_LABELS[resolved]) {
        return CATEGORY_LABELS[resolved];
    }
    return cat.replace(/_/g, " ").toUpperCase();
}

function getHumanStatus(status: string | null | undefined): string {
    if (!status) return "PENDING";
    const s = status.toLowerCase();
    if (s === "resolved") return "RESOLVED";
    if (s === "in_progress") return "IN PROGRESS";
    if (s === "verified") return "VERIFIED";
    return "PENDING";
}

function getEocStatus(eoc: string | null | undefined, reportStatus: string | null | undefined): string {
    if (eoc) {
        if (eoc === "responded") return "RESPONDED";
        if (eoc === "transferred") return "TRANSFERED";
        if (eoc === "pending_with_mission_order") return "PENDING WITH MISSION ORDER";
        return "PENDING";
    }
    const rs = (reportStatus || "").toLowerCase();
    if (rs === "resolved") return "RESPONDED";
    if (rs === "in_progress" || rs === "verified") return "TRANSFERED";
    return "PENDING";
}

function getHumanSource(src: string | null | undefined): string {
    if (!src) return "SpeakUp Website";
    if (src === "facebook_page") return "Facebook Page";
    if (src === "phone_call") return "Phone Call";
    if (src === "text_messages") return "Text Messages";
    if (src === "walk_ins") return "Walk-in Intake";
    if (src === "referral") return "Referral";
    if (src === "web") return "SpeakUp Website";
    return src.replace(/_/g, " ").toUpperCase();
}

function getHumanArea(area: string | null | undefined): string {
    if (!area) return "Unspecified Area";
    if (BARANGAY_AREA_LABELS[area as BarangayArea]) {
        return BARANGAY_AREA_LABELS[area as BarangayArea];
    }
    return area.replace(/_/g, " ").toUpperCase();
}

export const MASTER_COLUMN_CONFIGS: ColumnConfig[] = [
    { header: "Report ID", width: 38, align: "center" },
    { header: "Reference Number", width: 18, align: "center" },
    { header: "Date & Time (PHT)", width: 20, align: "center", type: "date" },
    { header: "Category", width: 28, align: "left" },
    { header: "Nature of Concern", width: 20, align: "center" },
    { header: "Description", width: 50, align: "left", wrapText: true },
    { header: "Urgency", width: 16, align: "center", type: "urgency" },
    { header: "Severity (1-5)", width: 14, align: "center", type: "number" },
    { header: "Status", width: 16, align: "center", type: "status" },
    { header: "Verification Status", width: 20, align: "center", type: "status" },
    { header: "Barangay Area", width: 22, align: "center" },
    { header: "Specific Address / Landmark", width: 36, align: "left", wrapText: true },
    { header: "Latitude", width: 14, align: "center" },
    { header: "Longitude", width: 14, align: "center" },
    { header: "Source of Concern", width: 20, align: "center" },
    { header: "Concern Department", width: 28, align: "left" },
    { header: "EOC Staff / Encoder", width: 22, align: "left" },
    { header: "Complainant Name", width: 24, align: "left" },
    { header: "Contact Number", width: 18, align: "center" },
    { header: "Age", width: 10, align: "center", type: "number" },
    { header: "Gender", width: 12, align: "center" },
    { header: "Responders", width: 24, align: "left" },
    { header: "Remarks / Actions Taken", width: 36, align: "left", wrapText: true },
    { header: "Evidence Photo", width: 28, align: "center" },
];

/**
 * Builds a multi-sheet, executive-styled Excel workbook (.xlsx)
 * containing all reports data for Barangay Payatas administration.
 */
export async function buildReportsExcel(options: ExportReportsOptions = {}): Promise<{
    buffer: Buffer;
    filename: string;
    totalReports: number;
}> {
    const supabase = getSupabaseAdmin();

    let query = supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(options.limit ?? 20000);

    if (options.status && options.status !== "all") {
        query = query.eq("status", options.status);
    }
    if (options.category && options.category !== "all") {
        query = query.eq("category", options.category);
    }
    if (options.startDate) {
        query = query.gte("created_at", options.startDate);
    }
    if (options.endDate) {
        query = query.lte("created_at", options.endDate);
    }

    const { data: rawReports, error } = await query;
    if (error) {
        throw new Error(`Failed to query reports: ${error.message}`);
    }

    const reports: RawReport[] = rawReports ?? [];

    // Fetch corresponding intake details (complainant demographics, walk-in details, etc.)
    const reportIds = reports.map((r) => r.id);
    const intakeMap = new Map<string, RawIntakeDetail>();

    if (reportIds.length > 0) {
        const chunkSize = 500;
        for (let i = 0; i < reportIds.length; i += chunkSize) {
            const chunk = reportIds.slice(i, i + chunkSize);
            const { data: details } = await supabase
                .from("report_intake_details")
                .select("*")
                .in("report_id", chunk);

            if (details) {
                for (const d of details as RawIntakeDetail[]) {
                    intakeMap.set(d.report_id, d);
                }
            }
        }
    }

    // Analytics counters
    const categoryCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = { PENDING: 0, VERIFIED: 0, "IN PROGRESS": 0, RESOLVED: 0 };
    const areaCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    let highUrgencyCount = 0;

    // Initialize Workbook
    const wb = new ExcelJS.Workbook();
    wb.creator = "Barangay Payatas SpeakUp System";
    wb.lastModifiedBy = "EOC Operations";
    wb.created = new Date();
    wb.modified = new Date();

    // ── SHEET 1: Master Reports (Full Database Export) ──
    const wsMaster = wb.addWorksheet("Master Reports", {
        properties: { tabColor: { argb: EXCEL_PALETTE.EMERALD_700 } },
    });

    const filterText = `Status: ${options.status || "All"} | Category: ${options.category || "All"}`;
    applyGovernmentBanner(wsMaster, {
        title: "BARANGAY PAYATAS • QUEZON CITY • MASTER INCIDENT DATABASE EXPORT",
        subtitle: "SpeakUp Payatas Central Incident Management System • Complete Database Records",
        meta: `Exported on (PHT): ${formatManilaDateTime(new Date().toISOString())}   |   Filter: ${filterText}   |   Total Records: ${reports.length}`,
        totalCols: MASTER_COLUMN_CONFIGS.length,
    });

    applyTableHeaders(wsMaster, 5, MASTER_COLUMN_CONFIGS);

    // ── SHEET 2: Official Barangay Logbook (17 Standard Columns) ──
    const logbookQuarter = getQuarterName(options.startDate || options.endDate);
    const wsLogbook = wb.addWorksheet(`${logbookQuarter} Logbook`, {
        properties: { tabColor: { argb: "FF0F766E" } },
    });

    applyGovernmentBanner(wsLogbook, {
        title: "BARANGAY PAYATAS • QUEZON CITY • EOC INCIDENT LOGBOOK",
        subtitle: `Official Barangay Logbook Format (${logbookQuarter}) • Emergency Operations Center`,
        meta: `Exported on (PHT): ${formatManilaDateTime(new Date().toISOString())}   |   Total Incidents: ${reports.length}   |   Standard EOC Layout`,
        totalCols: LOGBOOK_COLUMN_CONFIGS.length,
    });

    applyTableHeaders(wsLogbook, 5, LOGBOOK_COLUMN_CONFIGS);

    // Populate data for Sheets 1 & 2
    reports.forEach((r, idx) => {
        const detail = intakeMap.get(r.id);
        const manilaDt = formatManilaDateTime(r.created_at);
        const humanCat = getHumanCategory(r.category);
        const humanStat = getHumanStatus(r.status);
        const urgency = getUrgencyText(r.severity);
        const humanSource = getHumanSource(detail?.source);
        const humanArea = getHumanArea(detail?.area);

        // Track stats
        categoryCounts[humanCat] = (categoryCounts[humanCat] || 0) + 1;
        statusCounts[humanStat] = (statusCounts[humanStat] || 0) + 1;
        areaCounts[humanArea] = (areaCounts[humanArea] || 0) + 1;
        sourceCounts[humanSource] = (sourceCounts[humanSource] || 0) + 1;
        if (urgency === "HIGH") highUrgencyCount += 1;

        // Master Row
        const masterRowValues = [
            r.id,
            r.receipt_id || `PAY-${r.id.slice(0, 8).toUpperCase()}`,
            manilaDt,
            humanCat,
            detail?.nature_of_concern ? detail.nature_of_concern.toUpperCase() : "REPORT",
            r.description || "(No description provided)",
            urgency,
            r.severity ?? 1,
            humanStat,
            r.verification_status ? r.verification_status.toUpperCase() : "PENDING",
            humanArea,
            detail?.reporter_address || "Payatas, Quezon City",
            r.latitude,
            r.longitude,
            humanSource,
            detail?.concern_department || "Barangay Operations",
            detail?.eoc_staff || detail?.encoded_by || "System",
            detail?.reporter_name || "Anonymous Resident",
            detail?.reporter_contact || "N/A",
            detail?.reporter_age ?? null,
            detail?.reporter_gender ? detail.reporter_gender.toUpperCase() : "N/A",
            detail?.responders || "Unassigned",
            detail?.remarks || "",
            sanitizeExcelCell(r.photo_url) || "N/A",
        ];

        const rowMaster = wsMaster.addRow(masterRowValues.map(sanitizeExcelCell));
        styleDataRow(rowMaster, idx, MASTER_COLUMN_CONFIGS, masterRowValues);

        // Official Logbook Row
        const logbookRowValues = [
            manilaDt,
            detail?.eoc_staff || detail?.encoded_by || "Online System",
            detail?.nature_of_concern ? detail.nature_of_concern.toUpperCase() : "REPORT",
            humanSource.toUpperCase(),
            detail?.reporter_name || "ANONYMOUS",
            detail?.reporter_gender ? detail.reporter_gender.toUpperCase() : "N/A",
            detail?.reporter_age ?? "",
            detail?.reporter_address || "BARANGAY PAYATAS",
            humanArea.toUpperCase(),
            detail?.reporter_contact || "",
            r.description || "",
            humanCat.toUpperCase(),
            urgency,
            (detail?.concern_department || "BDRRM OFFICE").toUpperCase(),
            getEocStatus(detail?.eoc_status, r.status),
            detail?.remarks || "",
            detail?.responders || "",
        ];

        const rowLogbook = wsLogbook.addRow(logbookRowValues.map(sanitizeExcelCell));
        styleDataRow(rowLogbook, idx, LOGBOOK_COLUMN_CONFIGS, logbookRowValues);
    });

    // ── SHEET 3: Summary Analytics (Executive Dashboard) ──
    const wsSummary = wb.addWorksheet("Summary Analytics", {
        properties: { tabColor: { argb: "FF2563EB" } },
    });

    // Set spacer columns
    wsSummary.getColumn(1).width = 4; // Col A spacer
    wsSummary.getColumn(5).width = 4; // Col E spacer between side-by-side tables

    applyGovernmentBanner(wsSummary, {
        title: "BARANGAY PAYATAS • INCIDENT ANALYTICS & EXECUTIVE SUMMARY",
        subtitle: "Quezon City Emergency Operations Center (EOC) • SpeakUp Central Records",
        meta: `Generated on (PHT): ${formatManilaDateTime(new Date().toISOString())}   |   Total Reports: ${reports.length}   |   Confidential Administrative Summary`,
        totalCols: 8,
    });

    // KPI Cards (Rows 5 & 6)
    const resolvedCount = statusCounts.RESOLVED || 0;
    const resRate = reports.length ? Math.round((resolvedCount / reports.length) * 100) : 0;

    createKpiCard(wsSummary, "B5", "C6", reports.length, "Total Reports", {
        valColor: EXCEL_PALETTE.EMERALD_900,
        bgColor: EXCEL_PALETTE.EMERALD_50,
        borderColor: "FF86EFAC",
    });

    createKpiCard(wsSummary, "D5", "D6", highUrgencyCount, "High Urgency", {
        valColor: "FFDC2626",
        bgColor: "FFFEF2F2",
        borderColor: "FFFECACA",
    });

    createKpiCard(wsSummary, "F5", "F6", resolvedCount, "Resolved Incidents", {
        valColor: "FF16A34A",
        bgColor: EXCEL_PALETTE.EMERALD_50,
        borderColor: "FFBBF7D0",
    });

    createKpiCard(wsSummary, "G5", "H6", `${resRate}%`, "Resolution Rate", {
        valColor: "FF2563EB",
        bgColor: "FFEFF6FF",
        borderColor: "FFBFDBFE",
    });

    // Row 7: Spacer
    wsSummary.getRow(7).height = 14;

    // Tables 1 & 2 side by side at Row 8
    const statusRows: [string, number, string][] = [
        ["Resolved", statusCounts.RESOLVED || 0, reports.length ? `${Math.round(((statusCounts.RESOLVED || 0) / reports.length) * 100)}%` : "0%"],
        ["In Progress", statusCounts["IN PROGRESS"] || 0, reports.length ? `${Math.round(((statusCounts["IN PROGRESS"] || 0) / reports.length) * 100)}%` : "0%"],
        ["Verified", statusCounts.VERIFIED || 0, reports.length ? `${Math.round(((statusCounts.VERIFIED || 0) / reports.length) * 100)}%` : "0%"],
        ["Pending Verification", statusCounts.PENDING || 0, reports.length ? `${Math.round(((statusCounts.PENDING || 0) / reports.length) * 100)}%` : "0%"],
    ];

    const nextRow1 = createSummaryTable(wsSummary, {
        startRow: 8,
        startCol: 2, // Col B
        title: "Incident Status Breakdown",
        headers: ["STATUS", "TOTAL", "PERCENTAGE"],
        colWidths: [22, 12, 14],
        rows: statusRows,
        totalCount: reports.length,
    });

    const areaEntries = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]);
    const areaRows: [string, number, string][] = areaEntries.map(([area, count]) => [
        area,
        count,
        reports.length ? `${Math.round((count / reports.length) * 100)}%` : "0%",
    ]);

    const nextRow2 = createSummaryTable(wsSummary, {
        startRow: 8,
        startCol: 6, // Col F
        title: "Barangay Area Distribution",
        headers: ["BARANGAY AREA", "TOTAL", "PERCENTAGE"],
        colWidths: [24, 12, 14],
        rows: areaRows,
        totalCount: reports.length,
    });

    // Row after Tables 1 & 2
    const startRowBatch2 = Math.max(nextRow1, nextRow2) + 2;

    // Tables 3 & 4 side by side
    const catEntries = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    const catRows: [string, number, string][] = catEntries.map(([cat, count]) => [
        cat,
        count,
        reports.length ? `${Math.round((count / reports.length) * 100)}%` : "0%",
    ]);

    createSummaryTable(wsSummary, {
        startRow: startRowBatch2,
        startCol: 2, // Col B
        title: "Top Categories of Concern",
        headers: ["CATEGORY", "TOTAL", "PERCENTAGE"],
        colWidths: [28, 12, 14],
        rows: catRows,
        totalCount: reports.length,
    });

    const sourceEntries = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
    const sourceRows: [string, number, string][] = sourceEntries.map(([src, count]) => [
        src,
        count,
        reports.length ? `${Math.round((count / reports.length) * 100)}%` : "0%",
    ]);

    createSummaryTable(wsSummary, {
        startRow: startRowBatch2,
        startCol: 6, // Col F
        title: "Intake Source Breakdown",
        headers: ["SOURCE CHANNEL", "TOTAL", "PERCENTAGE"],
        colWidths: [24, 12, 14],
        rows: sourceRows,
        totalCount: reports.length,
    });

    // Generate binary buffer
    const buffer = await wb.xlsx.writeBuffer();

    const todayDate = new Date().toISOString().slice(0, 10);
    const filename = `Payatas_Reports_Master_Export_${todayDate}.xlsx`;

    return {
        buffer: Buffer.from(buffer),
        filename,
        totalReports: reports.length,
    };
}
