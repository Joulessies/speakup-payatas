import * as XLSX from "xlsx";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
    CATEGORY_LABELS,
    BARANGAY_AREA_LABELS,
    INTAKE_SOURCE_LABELS,
    NATURE_OF_CONCERN_LABELS,
    GENDER_LABELS,
    EOC_STATUS_LABELS,
    resolveCategory,
    type ReportCategory,
    type BarangayArea,
    type IntakeSource,
    type NatureOfConcern,
    type Gender,
    type EocStatus,
    type ReportStatus,
} from "@/types";

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
    concern_department?: string | null;
    reporter_name?: string | null;
    reporter_contact?: string | null;
    reporter_address?: string | null;
    reporter_age?: number | null;
    reporter_gender?: string | null;
    responders?: string | null;
    remarks?: string | null;
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

/**
 * Builds a multi-sheet, beautifully structured Excel workbook (.xlsx)
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
        // Chunk reportIds in sets of 500 to avoid query size limits
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

    // ── SHEET 1: Master Reports (Full Database Export) ──
    const masterHeaders = [
        "Report ID",
        "Reference Number",
        "Date & Time (PHT)",
        "Category",
        "Nature of Concern",
        "Description",
        "Urgency",
        "Severity (1-5)",
        "Status",
        "Verification Status",
        "Barangay Area",
        "Specific Address / Landmark",
        "Latitude",
        "Longitude",
        "Source of Concern",
        "Concern Department",
        "EOC Staff / Encoder",
        "Complainant Name",
        "Contact Number",
        "Age",
        "Gender",
        "Responders",
        "Remarks / Actions Taken",
        "Evidence Photo URL",
    ];

    const masterRows: (string | number | null)[][] = [masterHeaders];

    // Analytics counters
    const categoryCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = { PENDING: 0, VERIFIED: 0, "IN PROGRESS": 0, RESOLVED: 0 };
    const areaCounts: Record<string, number> = {};
    const sourceCounts: Record<string, number> = {};
    let highUrgencyCount = 0;

    // ── SHEET 2: Official Barangay Logbook (17 Standard Columns) ──
    const logbookHeaders = [
        "DATE AND TIME",
        "EOC STAFF",
        "NATURE OF CONCERN",
        "SOURCE OF CONCERN",
        "NAME",
        "SEX",
        "AGE",
        "ADDRESS",
        "AREA",
        "CONTACT NUMBER",
        "CONCERN",
        "TYPE OF CONCERN",
        "URGENCY",
        "CONCERN DEPARTMENT",
        "STATUS",
        "Remarks",
        "RESPONDERS",
    ];

    const logbookRows: (string | number | null)[][] = [logbookHeaders];

    for (const r of reports) {
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
        masterRows.push([
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
            r.photo_url || "N/A",
        ]);

        // Official Logbook Row
        logbookRows.push([
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
        ]);
    }

    // ── SHEET 3: Summary & Analytics ──
    const summaryRows: (string | number | null)[][] = [
        ["BARANGAY PAYATAS - REPORTS & INCIDENTS SUMMARY REPORT"],
        ["Generated on (PHT):", formatManilaDateTime(new Date().toISOString())],
        ["Total Reports:", reports.length],
        ["High Urgency Emergencies:", highUrgencyCount],
        [""],
        ["STATUS BREAKDOWN", "TOTAL", "PERCENTAGE"],
        ["Resolved", statusCounts.RESOLVED || 0, reports.length ? `${Math.round(((statusCounts.RESOLVED || 0) / reports.length) * 100)}%` : "0%"],
        ["In Progress", statusCounts["IN PROGRESS"] || 0, reports.length ? `${Math.round(((statusCounts["IN PROGRESS"] || 0) / reports.length) * 100)}%` : "0%"],
        ["Verified", statusCounts.VERIFIED || 0, reports.length ? `${Math.round(((statusCounts.VERIFIED || 0) / reports.length) * 100)}%` : "0%"],
        ["Pending Verification", statusCounts.PENDING || 0, reports.length ? `${Math.round(((statusCounts.PENDING || 0) / reports.length) * 100)}%` : "0%"],
        [""],
        ["TOP CATEGORIES OF CONCERN", "TOTAL", "PERCENTAGE"],
        ...Object.entries(categoryCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => [
                cat,
                count,
                reports.length ? `${Math.round((count / reports.length) * 100)}%` : "0%",
            ]),
        [""],
        ["AREA DISTRIBUTION", "TOTAL", "PERCENTAGE"],
        ...Object.entries(areaCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([area, count]) => [
                area,
                count,
                reports.length ? `${Math.round((count / reports.length) * 100)}%` : "0%",
            ]),
        [""],
        ["INTAKE SOURCE BREAKDOWN", "TOTAL", "PERCENTAGE"],
        ...Object.entries(sourceCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([src, count]) => [
                src,
                count,
                reports.length ? `${Math.round((count / reports.length) * 100)}%` : "0%",
            ]),
    ];

    // Build Workbook
    const wb = XLSX.utils.book_new();

    // Sheet 1: Master Reports
    const wsMaster = XLSX.utils.aoa_to_sheet(masterRows);
    wsMaster["!cols"] = [
        { wch: 38 }, // Report ID
        { wch: 18 }, // Reference Number
        { wch: 18 }, // Date & Time
        { wch: 28 }, // Category
        { wch: 18 }, // Nature
        { wch: 45 }, // Description
        { wch: 12 }, // Urgency
        { wch: 14 }, // Severity
        { wch: 14 }, // Status
        { wch: 18 }, // Verification Status
        { wch: 22 }, // Area
        { wch: 32 }, // Specific Address
        { wch: 12 }, // Latitude
        { wch: 12 }, // Longitude
        { wch: 20 }, // Source
        { wch: 26 }, // Department
        { wch: 20 }, // EOC Staff
        { wch: 22 }, // Name
        { wch: 16 }, // Contact
        { wch: 8 },  // Age
        { wch: 10 }, // Gender
        { wch: 20 }, // Responders
        { wch: 30 }, // Remarks
        { wch: 35 }, // Photo URL
    ];
    XLSX.utils.book_append_sheet(wb, wsMaster, "Master Reports");

    // Sheet 2: Barangay Logbook
    const wsLogbook = XLSX.utils.aoa_to_sheet(logbookRows);
    wsLogbook["!cols"] = [
        { wch: 18 }, // DATE AND TIME
        { wch: 20 }, // EOC STAFF
        { wch: 20 }, // NATURE OF CONCERN
        { wch: 20 }, // SOURCE OF CONCERN
        { wch: 22 }, // NAME
        { wch: 10 }, // SEX
        { wch: 8 },  // AGE
        { wch: 32 }, // ADDRESS
        { wch: 22 }, // AREA
        { wch: 16 }, // CONTACT NUMBER
        { wch: 45 }, // CONCERN
        { wch: 28 }, // TYPE OF CONCERN
        { wch: 12 }, // URGENCY
        { wch: 26 }, // CONCERN DEPARTMENT
        { wch: 22 }, // STATUS
        { wch: 30 }, // Remarks
        { wch: 22 }, // RESPONDERS
    ];
    XLSX.utils.book_append_sheet(wb, wsLogbook, "Barangay EOC Logbook");

    // Sheet 3: Summary Analytics
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
    wsSummary["!cols"] = [{ wch: 38 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary Analytics");

    // Generate binary buffer
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const todayDate = new Date().toISOString().slice(0, 10);
    const filename = `Payatas_Reports_Master_Export_${todayDate}.xlsx`;

    return {
        buffer,
        filename,
        totalReports: reports.length,
    };
}
