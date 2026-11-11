import { EOC_STATUSES, type BarangayArea, type EocStatus, type Gender, type IntakeSource, type NatureOfConcern, type ReportCategory, type ReportStatus } from "@/types";

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
