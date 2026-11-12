import * as XLSX from "xlsx";
import {
    EOC_STATUSES,
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

export function urgencyLabel(severity: number): "Low" | "Medium" | "High" {
    if (severity >= 4) return "High";
    if (severity <= 2) return "Low";
    return "Medium";
}

/**
 * Builds an official Barangay Logbook sheet (.xlsx) using pure SheetJS
 */
export async function buildLogbookSheet(rows: LogbookExportRow[]): Promise<Buffer> {
    const dataRows: (string | number | null)[][] = [
        [...LOGBOOK_HEADERS],
    ];

    for (const row of rows) {
        dataRows.push([
            formatManilaDateTime(row.created_at),
            row.eoc_staff ?? "",
            row.nature ? row.nature.toUpperCase() : "",
            row.source ? row.source.replace(/_/g, " ").toUpperCase() : "",
            row.name ?? "",
            row.sex ? row.sex.toUpperCase() : "",
            row.age ?? "",
            row.address ?? "",
            row.area ? row.area.replace(/_/g, " ").toUpperCase() : "",
            row.contact ?? "",
            row.concern ?? "",
            row.category ? row.category.replace(/_/g, " ").toUpperCase() : "",
            urgencyLabel(row.severity).toUpperCase(),
            row.department ?? "",
            row.eoc_status ? row.eoc_status.replace(/_/g, " ").toUpperCase() : "PENDING",
            row.remarks ?? "",
            row.responders ?? "",
        ]);
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(dataRows);
    ws["!cols"] = [
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
    XLSX.utils.book_append_sheet(wb, ws, "Barangay Logbook");
    return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
