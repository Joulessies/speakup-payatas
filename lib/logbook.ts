import * as XLSX from "xlsx";
import {
    BARANGAY_AREA_LABELS,
    CATEGORY_LABELS,
    CONCERN_DEPARTMENTS,
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

export type LogbookExportRow = {
    created_at: string;
    eoc_staff: string | null;
    nature: NatureOfConcern | null;
    source: Exclude<IntakeSource, "web">;
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
 */
export async function buildLogbookSheet(
    rows: LogbookExportRow[],
    options: { date?: string; template?: boolean } = {}
): Promise<Buffer> {
    const quarterName = getQuarterName(options.date || (rows[0] ? rows[0].created_at : undefined));
    const isBlankTemplate = options.template || rows.length === 0;

    const dataRows: (string | number | null)[][] = [
        [...LOGBOOK_HEADERS],
    ];

    if (isBlankTemplate) {
        // Output template rows with pre-defined option lists
        for (const refRow of TEMPLATE_REFERENCE_OPTIONS) {
            dataRows.push([...refRow]);
        }
    } else {
        // Output real incident logs
        for (const row of rows) {
            const humanNature = row.nature ? (NATURE_OF_CONCERN_LABELS[row.nature] ?? row.nature).toUpperCase() : "REPORT";
            const humanSource = row.source ? (INTAKE_SOURCE_LABELS[row.source] ?? row.source).toUpperCase() : "WALK INS";
            const humanArea = row.area ? (BARANGAY_AREA_LABELS[row.area] ?? row.area).toUpperCase() : "OTHERS";
            const humanCategory = row.category ? (CATEGORY_LABELS[row.category] ?? row.category).toUpperCase() : "OTHERS";
            const humanStatus = row.eoc_status ? (EOC_STATUS_LABELS[row.eoc_status] ?? row.eoc_status).toUpperCase() : "PENDING";

            dataRows.push([
                formatManilaDateTime(row.created_at),
                (row.eoc_staff || "ONLINE SYSTEM").toUpperCase(),
                humanNature,
                humanSource,
                (row.name || "ANONYMOUS").toUpperCase(),
                row.sex ? row.sex.toUpperCase() : "N/A",
                row.age ?? "",
                (row.address || "BARANGAY PAYATAS").toUpperCase(),
                humanArea,
                row.contact ?? "",
                row.concern ?? "",
                humanCategory,
                urgencyLabel(row.severity),
                (row.department || "BDRRM OFFICE").toUpperCase(),
                humanStatus,
                row.remarks ?? "",
                row.responders ?? "",
            ]);
        }
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    ws["!cols"] = [
        { wch: 18 }, // DATE AND TIME
        { wch: 20 }, // EOC STAFF
        { wch: 22 }, // NATURE OF CONCERN
        { wch: 22 }, // SOURCE OF CONCERN
        { wch: 24 }, // NAME
        { wch: 10 }, // SEX
        { wch: 8 },  // AGE
        { wch: 34 }, // ADDRESS
        { wch: 22 }, // AREA
        { wch: 18 }, // CONTACT NUMBER
        { wch: 50 }, // CONCERN
        { wch: 32 }, // TYPE OF CONCERN
        { wch: 14 }, // URGENCY
        { wch: 28 }, // CONCERN DEPARTMENT
        { wch: 26 }, // STATUS
        { wch: 32 }, // Remarks
        { wch: 24 }, // RESPONDERS
    ];

    // Main sheet matches the quarter from the official barangay logbook
    XLSX.utils.book_append_sheet(wb, ws, quarterName);

    // If exporting actual data, add a separate sheet with the official Dropdown Reference Lists
    if (!isBlankTemplate) {
        const refRows: (string | null)[][] = [
            [...LOGBOOK_HEADERS],
            ...TEMPLATE_REFERENCE_OPTIONS,
        ];
        const wsRef = XLSX.utils.aoa_to_sheet(refRows);
        wsRef["!cols"] = ws["!cols"];
        XLSX.utils.book_append_sheet(wb, wsRef, "DROPDOWN REFERENCE");
    }

    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
