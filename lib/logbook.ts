import ExcelJS from "exceljs";
import {
    BARANGAY_AREA_LABELS,
    CATEGORY_LABELS,
    EOC_STATUS_LABELS,
    EOC_STATUSES,
    INTAKE_SOURCE_LABELS,
    NATURE_OF_CONCERN_LABELS,
    type BarangayArea,
    type EocStatus,
    type Gender,
    type IntakeSource,
    type NatureOfConcern,
    type ReportCategory,
    type ReportStatus,
} from "@/types";
import {
    applyGovernmentBanner,
    applyTableHeaders,
    styleDataRow,
    type ColumnConfig,
    EXCEL_PALETTE,
} from "@/lib/excel-styles";

export type LogbookExportRow = {
    created_at: string;
    eoc_staff: string | null;
    nature: NatureOfConcern | null;
    source: IntakeSource;
    name: string | null;
    sex: Gender | null;
    age: number | null;
    address: string | null;
    area: BarangayArea | null;
    contact: string | null;
    concern: string;
    category: ReportCategory;
    severity: number;
    department: string | null;
    eoc_status: EocStatus;
    remarks: string | null;
    responders: string | null;
};

export const LOGBOOK_HEADERS = [
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
] as const;

export const LOGBOOK_COLUMN_CONFIGS: ColumnConfig[] = [
    { header: "DATE AND TIME", width: 20, align: "center", type: "date" },
    { header: "EOC STAFF", width: 22, align: "left" },
    { header: "NATURE OF CONCERN", width: 22, align: "center" },
    { header: "SOURCE OF CONCERN", width: 20, align: "center" },
    { header: "NAME", width: 24, align: "left" },
    { header: "SEX", width: 12, align: "center" },
    { header: "AGE", width: 10, align: "center", type: "number" },
    { header: "ADDRESS", width: 36, align: "left", wrapText: true },
    { header: "AREA", width: 22, align: "center" },
    { header: "CONTACT NUMBER", width: 20, align: "center" },
    { header: "CONCERN", width: 52, align: "left", wrapText: true },
    { header: "TYPE OF CONCERN", width: 32, align: "left" },
    { header: "URGENCY", width: 16, align: "center", type: "urgency" },
    { header: "CONCERN DEPARTMENT", width: 28, align: "left" },
    { header: "STATUS", width: 22, align: "center", type: "status" },
    { header: "Remarks", width: 32, align: "left", wrapText: true },
    { header: "RESPONDERS", width: 26, align: "left" },
];

export function getQuarterName(dateStr?: string): string {
    const d = dateStr ? new Date(dateStr) : new Date();
    const month = d.getMonth();
    if (month >= 9) return "4TH QUARTER";
    if (month >= 6) return "3RD QUARTER";
    if (month >= 3) return "2ND QUARTER";
    return "1ST QUARTER";
}

export function manilaDayRange(date: string): { start: string; end: string } | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const start = new Date(`${date}T00:00:00+08:00`);
    const end = new Date(`${date}T23:59:59.999+08:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start: start.toISOString(), end: end.toISOString() };
}

export function eocStatusFromReport(status: ReportStatus | string | null | undefined, stored: EocStatus | null): EocStatus {
    if (stored && (EOC_STATUSES as readonly string[]).includes(stored)) return stored;
    if (status === "resolved") return "responded";
    if (status === "in_progress" || status === "verified") return "transferred";
    return "pending";
}

export function formatManilaDateTime(iso: string): string {
    try {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Manila",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hourCycle: "h23",
        }).formatToParts(new Date(iso));
        const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
        return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}`;
    } catch {
        return iso;
    }
}

export function urgencyLabel(severity: number): "LOW" | "MEDIUM" | "HIGH" {
    if (severity >= 4) return "HIGH";
    if (severity <= 2) return "LOW";
    return "MEDIUM";
}

/**
 * Ensures cell values comply with Microsoft Excel / OpenXML standards.
 * Excel has a strict hard limit of 32,767 characters per cell.
 * Base64 image data strings (which easily reach 100,000+ chars) are replaced with a clean label.
 */
export function sanitizeExcelCell(val: unknown): string | number | null {
    if (val === null || val === undefined) return "";
    if (typeof val === "number") return Number.isFinite(val) ? val : "";
    if (typeof val === "boolean") return val ? "TRUE" : "FALSE";

    const str = String(val);

    // If it's a base64 image data URI, don't dump hundreds of thousands of characters into an Excel cell!
    if (str.startsWith("data:image/")) {
        const mimeMatch = str.match(/^data:(image\/[a-zA-Z0-9+.-]+);/);
        const format = mimeMatch ? mimeMatch[1].replace("image/", "").toUpperCase() : "IMAGE";
        return `[Attached Photo: ${format}]`;
    }
    if (str.startsWith("data:")) {
        return `[Attached Data URI]`;
    }

    // Hard limit in Excel (.xlsx format) is 32,767 characters per cell
    const EXCEL_MAX_CHARS = 32700;
    if (str.length > EXCEL_MAX_CHARS) {
        return str.slice(0, EXCEL_MAX_CHARS) + "… [TRUNCATED: Exceeds Excel cell limit of 32,767 chars]";
    }

    return str;
}

// Official template reference rows (from PAYATAS_SPEAK_UP official logbook template)
const TEMPLATE_REFERENCE_OPTIONS: (string | null)[][] = [
    [null, null, "INQURIES", "FACEBOOK PAGE", null, null, null, null, "AREA A", null, null, "VIOLENCE AND PUBLIC SAFETY", "LOW", "ASH / VAW", "RESPONDED"],
    [null, null, "COMPLAINTS", "PHONE CALL", null, null, null, null, "AREA B", null, null, "THREATS AND HARASSMENT", "MEDIUM", "BADAC", "TRANSFERED"],
    [null, null, "REPORT", "TEXT MESSAGES", null, null, null, null, "LUPANG PANGAKO", null, null, "FIRE AND DISASTER ALERT", "HIGH", "BCPC", "PENDING "],
    [null, null, null, "REFERRAL", null, null, null, null, "GROUP 13", null, null, "MEDICAL AND HEALTH", null, "BDRRM OFFICE", "PENDING WITH MISSION ORDER"],
    [null, null, null, "WALK INS", null, null, null, null, "OTHERS", null, null, "ROAD AND TRAFFIC", null, "BHERT"],
    [null, null, null, null, null, null, null, null, null, null, null, "ROAD ACCIDENTS", null, "ALPHA BASE"],
    [null, null, null, null, null, null, null, null, null, null, null, "PUBLIC DISTURBANCE", null, "BRAVO BASE"],
    [null, null, null, null, null, null, null, null, null, null, null, "ELECTRICAL CONCERNS", null, "LP BASE"],
    [null, null, null, null, null, null, null, null, null, null, null, "ANIMAL RELATED CONCERNS", null, "GROUP 13 BASE"],
    [null, null, null, null, null, null, null, null, null, null, null, "FAMILY AND DOMESTIC CONCERNS", null, "CLEARANCE DEPARTMENT"],
    [null, null, null, null, null, null, null, null, null, null, null, "SUBSTANCE RELATED CONCERNS", null, "CRO OFFICE"],
    [null, null, null, null, null, null, null, null, null, null, null, "SOCIAL WELFARE COCNERNS", null, "ENVIRONMENTAL PROTECTION"],
    [null, null, null, null, null, null, null, null, null, null, null, "LEGAL AND BARANGAY MEDIATION", null, "FIRE BRIGADE"],
    [null, null, null, null, null, null, null, null, null, null, null, "INFRASTRUCTURE AND PUBLIC WORKS", null, "GENDER AND DEVELOPMENT"],
    [null, null, null, null, null, null, null, null, null, null, null, "CLEARANCE CONCERNS", null, "LUPON TAGAPAMAYAPA"],
    [null, null, null, null, null, null, null, null, null, null, null, "SERVICE AND ASSISTANCE REQUESTS", null, "MAYNILAD"],
    [null, null, null, null, null, null, null, null, null, null, null, "ENVIRONMENTAL CONCERNS", null, "MERALCO"],
    [null, null, null, null, null, null, null, null, null, null, null, "INQUIRIES", null, "PDAO"],
    [null, null, null, null, null, null, null, null, null, null, null, "GARBAGE CONCERNS", null, "POLICE STATION 13"],
    [null, null, null, null, null, null, null, null, null, null, null, null, null, "SECTOR 5"],
    [null, null, null, null, null, null, null, null, null, null, null, null, null, "TRAFFIC BASE"],
    [null, null, null, null, null, null, null, null, null, null, null, null, null, "SECREATRY"],
];

/**
 * Builds an official Barangay Logbook sheet (.xlsx) adhering 100% to PAYATAS_SPEAK_UP standards
 * with executive styling, freeze panes, auto-filter, and colored status pills.
 */
export async function buildLogbookSheet(
    rows: LogbookExportRow[],
    options: { date?: string; template?: boolean } = {}
): Promise<Buffer> {
    const quarterName = getQuarterName(options.date || (rows[0] ? rows[0].created_at : undefined));
    const isBlankTemplate = options.template || rows.length === 0;

    const wb = new ExcelJS.Workbook();
    wb.creator = "Barangay Payatas SpeakUp System";
    wb.lastModifiedBy = "EOC Operations";
    wb.created = new Date();
    wb.modified = new Date();

    const ws = wb.addWorksheet(quarterName, {
        properties: { tabColor: { argb: EXCEL_PALETTE.EMERALD_700 } },
    });

    // 1. Header Banner
    const logDateLabel = options.date ? `Date: ${options.date}` : `Generated: ${formatManilaDateTime(new Date().toISOString())}`;
    applyGovernmentBanner(ws, {
        title: "BARANGAY PAYATAS • QUEZON CITY • EOC INCIDENT LOGBOOK",
        subtitle: `Emergency Operations Center (EOC) • SpeakUp Payatas Official Daily Record (${quarterName})`,
        meta: `${logDateLabel}   |   Total Incidents Recorded: ${rows.length}   |   Barangay Operations Monitoring`,
        totalCols: LOGBOOK_COLUMN_CONFIGS.length,
    });

    // 2. Table Headers (Row 5)
    applyTableHeaders(ws, 5, LOGBOOK_COLUMN_CONFIGS);

    // 3. Data Rows
    if (isBlankTemplate) {
        // Output template rows with pre-defined option lists
        TEMPLATE_REFERENCE_OPTIONS.forEach((refRow, idx) => {
            const row = ws.addRow(refRow.map(sanitizeExcelCell));
            styleDataRow(row, idx, LOGBOOK_COLUMN_CONFIGS, refRow);
        });
    } else {
        // Output real incident logs
        rows.forEach((r, idx) => {
            const humanNature = r.nature ? (NATURE_OF_CONCERN_LABELS[r.nature] ?? r.nature).toUpperCase() : "REPORT";
            const humanSource = r.source === "web"
                ? "SPEAKUP WEBSITE"
                : r.source
                ? (INTAKE_SOURCE_LABELS[r.source] ?? r.source).toUpperCase()
                : "WALK INS";
            const humanArea = r.area ? (BARANGAY_AREA_LABELS[r.area] ?? r.area).toUpperCase() : "OTHERS";
            const humanCategory = r.category ? (CATEGORY_LABELS[r.category] ?? r.category).toUpperCase() : "OTHERS";
            const humanStatus = r.eoc_status ? (EOC_STATUS_LABELS[r.eoc_status] ?? r.eoc_status).toUpperCase() : "PENDING";

            const rowValues = [
                formatManilaDateTime(r.created_at),
                (r.eoc_staff || "ONLINE SYSTEM").toUpperCase(),
                humanNature,
                humanSource,
                (r.name || "ANONYMOUS").toUpperCase(),
                r.sex ? r.sex.toUpperCase() : "N/A",
                r.age ?? "",
                (r.address || "BARANGAY PAYATAS").toUpperCase(),
                humanArea,
                r.contact ?? "",
                r.concern ?? "",
                humanCategory,
                urgencyLabel(r.severity),
                (r.department || "BDRRM OFFICE").toUpperCase(),
                humanStatus,
                r.remarks ?? "",
                r.responders ?? "",
            ];

            const row = ws.addRow(rowValues.map(sanitizeExcelCell));
            styleDataRow(row, idx, LOGBOOK_COLUMN_CONFIGS, rowValues);
        });
    }

    // 4. Dropdown Reference Sheet
    if (!isBlankTemplate) {
        const wsRef = wb.addWorksheet("DROPDOWN REFERENCE", {
            properties: { tabColor: { argb: "FF0F766E" } },
        });

        applyGovernmentBanner(wsRef, {
            title: "BARANGAY PAYATAS • OFFICIAL LOGBOOK REFERENCE OPTIONS",
            subtitle: "Authorized Standard Values for Nature, Sources, Areas, Urgency, and Departments",
            meta: "Reference Guide • Adheres to Official Quezon City Barangay Payatas EOC Template",
            totalCols: LOGBOOK_COLUMN_CONFIGS.length,
        });

        applyTableHeaders(wsRef, 5, LOGBOOK_COLUMN_CONFIGS);

        TEMPLATE_REFERENCE_OPTIONS.forEach((refRow, idx) => {
            const row = wsRef.addRow(refRow.map(sanitizeExcelCell));
            styleDataRow(row, idx, LOGBOOK_COLUMN_CONFIGS, refRow);
        });
    }

    const buffer = await wb.xlsx.writeBuffer();
    return Buffer.from(buffer);
}
