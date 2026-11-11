import { readFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import {
    BARANGAY_AREAS,
    BARANGAY_AREA_LABELS,
    CATEGORY_LABELS,
    CONCERN_DEPARTMENTS,
    EOC_STATUS_LABELS,
    EOC_STATUSES,
    GENDER_LABELS,
    INTAKE_SOURCE_LABELS,
    NATURE_OF_CONCERN_LABELS,
    REPORT_CATEGORIES,
    isGender,
    isReportCategory,
    parseReporterAge,
    type BarangayArea,
    type EocStatus,
    type Gender,
    type IntakeSource,
    type NatureOfConcern,
    type ReportCategory,
    type ReportStatus,
} from "@/types";

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

export type LogbookEntry = {
    source: Exclude<IntakeSource, "web">;
    nature: NatureOfConcern;
    category: ReportCategory;
    description: string;
    receivedAt: Date;
    severity: number;
    eocStatus: EocStatus;
    eocStaff: string | null;
    area: BarangayArea | null;
    department: string | null;
    name: string | null;
    contact: string | null;
    address: string | null;
    age: number | null;
    gender: Gender | null;
    responders: string | null;
    remarks: string | null;
};

export type LogbookRowError = { row: number; message: string };

const MAX_IMPORT_ROWS = 500;

function norm(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cellText(value: unknown): string {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return "";
    return String(value).trim();
}

export function manilaDayRange(date: string): { start: string; end: string } | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const start = new Date(`${date}T00:00:00+08:00`);
    const end = new Date(`${date}T23:59:59.999+08:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
    return { start: start.toISOString(), end: end.toISOString() };
}

export function formatManilaDateTime(iso: string): string {
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
}

export function urgencyLabel(severity: number): "Low" | "Medium" | "High" {
    if (severity >= 4) return "High";
    if (severity <= 2) return "Low";
    return "Medium";
}

export function eocStatusFromReport(status: ReportStatus | string | null | undefined, stored: EocStatus | null): EocStatus {
    if (stored && (EOC_STATUSES as readonly string[]).includes(stored)) return stored;
    if (status === "resolved") return "responded";
    if (status === "in_progress" || status === "verified") return "transferred";
    return "pending";
}

function parseLogDate(value: unknown): Date | null {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === "number" && value > 20000 && value < 80000) {
        const parsed = XLSX.SSF.parse_date_code(value);
        if (!parsed) return null;
        return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, Math.floor(parsed.S));
    }
    const text = cellText(value);
    if (!text) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(text);
    if (iso) {
        const [, year, month, day, hour, minute] = iso;
        return new Date(Number(year), Number(month) - 1, Number(day), Number(hour ?? 0), Number(minute ?? 0));
    }
    const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(text);
    if (slash) {
        const [, month, day, year, hour, minute] = slash;
        return new Date(Number(year), Number(month) - 1, Number(day), Number(hour ?? 0), Number(minute ?? 0));
    }
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function matchChoice<T extends string>(value: string, options: readonly T[], labels: Record<T, string>, aliases: Record<string, T> = {}): T | null {
    const key = norm(value);
    if (!key) return null;
    if (aliases[key]) return aliases[key];
    for (const option of options) {
        if (norm(option) === key || norm(labels[option]) === key) return option;
    }
    return null;
}

const NATURE_ALIASES: Record<string, NatureOfConcern> = {
    inquries: "inquiry",
    inquiry: "inquiry",
    inquiries: "inquiry",
    complaint: "complaint",
    complaints: "complaint",
    report: "report",
    reports: "report",
};

const SOURCE_ALIASES: Record<string, Exclude<IntakeSource, "web">> = {
    "facebook page": "facebook_page",
    facebook: "facebook_page",
    messenger: "facebook_page",
    "phone call": "phone_call",
    call: "phone_call",
    "text messages": "text_messages",
    "text message": "text_messages",
    sms: "text_messages",
    referral: "referral",
    "walk ins": "walk_ins",
    "walk in": "walk_ins",
};

const AREA_ALIASES: Record<string, BarangayArea> = {
    "area a": "area_a",
    "area b": "area_b",
    "lupang pangako": "lupang_pangako",
    "group 13": "group_13",
    others: "others",
    other: "others",
};

const STATUS_ALIASES: Record<string, EocStatus> = {
    pending: "pending",
    transferred: "transferred",
    transfered: "transferred",
    "pending with mission order": "pending_with_mission_order",
    responded: "responded",
    resolved: "responded",
};

const CATEGORY_ALIASES: Record<string, ReportCategory> = {
    "public disturbance noise": "noise_nuisance",
    "noise nuisance": "noise_nuisance",
    "fire hazard": "fire_hazard",
    "safety concern": "safety_concern",
    "drainage flooding": "drainage_flooding",
    "sanitation health": "sanitation_health",
    "social welfare cocnerns": "social_welfare",
    "harmful acts": "safety_concern",
    "traffic problems": "road_traffic",
    "traffic accidents": "road_accidents",
    "fire alerts": "fire_hazard",
    "health problems": "medical_health",
    "noise complaints": "noise_nuisance",
    lupon: "legal_mediation",
    other: "other",
    others: "other",
};

function matchDepartment(value: string): string | null {
    const key = norm(value);
    if (!key) return null;
    if (key === "secretary" || key === "secreatry") return "Secretary";
    if (key === "bdrrm") return "BDRRM";
    if (key === "bdrrm office") return "BDRRM Office";
    if (key === "others" || key === "other") return "OTHERS";
    return CONCERN_DEPARTMENTS.find((department) => norm(department) === key) ?? null;
}

function matchUrgency(value: string): number | null {
    const key = norm(value);
    if (key === "low") return 1;
    if (key === "medium" || key === "med" || key === "moderate") return 3;
    if (key === "high" || key === "critical" || key === "crit") return 5;
    return null;
}

function matchSex(value: string): Gender | null {
    const key = norm(value);
    if (key === "m" || key === "male") return "male";
    if (key === "f" || key === "female") return "female";
    if (isGender(key)) return key;
    if (key === "prefer not to say") return "prefer_not_to_say";
    return null;
}

export function parseLogbookWorkbook(data: Buffer): { entries: { sheetRow: number; entry: LogbookEntry }[]; errors: LogbookRowError[] } {
    const book = XLSX.read(data, { type: "buffer", cellDates: true });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) return { entries: [], errors: [{ row: 1, message: "The workbook has no sheet." }] };
    const matrix = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
        header: 1,
        raw: true,
        defval: "",
        blankrows: false,
    });
    const headerIndex = matrix.findIndex((row) => row.some((cell) => norm(cellText(cell)) === "concern" || norm(cellText(cell)) === "date and time"));
    if (headerIndex < 0) {
        return { entries: [], errors: [{ row: 1, message: "Could not find the header row. Use the blank sheet from this page." }] };
    }
    const headers = matrix[headerIndex].map((cell) => norm(cellText(cell)));
    const column = (name: string) => headers.indexOf(norm(name));
    const concernCol = column("CONCERN");
    if (concernCol < 0) {
        return { entries: [], errors: [{ row: headerIndex + 1, message: "The Concern column is missing." }] };
    }

    const entries: { sheetRow: number; entry: LogbookEntry }[] = [];
    const errors: LogbookRowError[] = [];
    let considered = 0;
    for (let index = headerIndex + 1; index < matrix.length; index += 1) {
        const row = matrix[index];
        const rowNumber = index + 1;
        const read = (name: string) => {
            const at = column(name);
            return at < 0 ? "" : row[at];
        };
        const concern = cellText(read("CONCERN"));
        if (!concern) continue;
        considered += 1;
        if (considered > MAX_IMPORT_ROWS) {
            errors.push({ row: rowNumber, message: `Only the first ${MAX_IMPORT_ROWS} concerns are imported.` });
            break;
        }
        const category = matchChoice(cellText(read("TYPE OF CONCERN")), REPORT_CATEGORIES, CATEGORY_LABELS, CATEGORY_ALIASES)
            ?? (isReportCategory(norm(cellText(read("TYPE OF CONCERN"))).replace(/ /g, "_"))
                ? norm(cellText(read("TYPE OF CONCERN"))).replace(/ /g, "_") as ReportCategory
                : null);
        const source = matchChoice(cellText(read("SOURCE OF CONCERN")), ["facebook_page", "phone_call", "text_messages", "referral", "walk_ins"] as const, INTAKE_SOURCE_LABELS, SOURCE_ALIASES);
        if (!category) {
            errors.push({ row: rowNumber, message: "Type of concern is missing or not one of the barangay types." });
            continue;
        }
        if (!source) {
            errors.push({ row: rowNumber, message: "Source of concern is missing or not recognized." });
            continue;
        }
        const nature = matchChoice(cellText(read("NATURE OF CONCERN")), ["inquiry", "complaint", "report"] as const, NATURE_OF_CONCERN_LABELS, NATURE_ALIASES) ?? "report";
        const urgency = matchUrgency(cellText(read("URGENCY"))) ?? 3;
        const status = matchChoice(cellText(read("STATUS")), EOC_STATUSES, EOC_STATUS_LABELS, STATUS_ALIASES) ?? "pending";
        const areaText = cellText(read("AREA"));
        const area = areaText ? matchChoice(areaText, BARANGAY_AREAS, BARANGAY_AREA_LABELS, AREA_ALIASES) : null;
        if (areaText && !area) {
            errors.push({ row: rowNumber, message: "Area is not Area A, Area B, Lupang Pangako, Group 13, or Others." });
            continue;
        }
        const departmentText = cellText(read("CONCERN DEPARTMENT"));
        const department = departmentText ? matchDepartment(departmentText) : null;
        if (departmentText && !department) {
            errors.push({ row: rowNumber, message: "Concern department is not on the barangay list." });
            continue;
        }
        const sexText = cellText(read("SEX"));
        const gender = sexText ? matchSex(sexText) : null;
        if (sexText && !gender) {
            errors.push({ row: rowNumber, message: "Sex must be Male or Female." });
            continue;
        }
        const ageText = cellText(read("AGE"));
        const age = ageText ? parseReporterAge(ageText) : null;
        if (ageText && age === null) {
            errors.push({ row: rowNumber, message: "Age must be a whole number from 1 to 120." });
            continue;
        }
        const receivedAt = parseLogDate(read("DATE AND TIME")) ?? new Date();
        entries.push({
            sheetRow: rowNumber,
            entry: {
            source,
            nature,
            category,
            description: concern.slice(0, 5000),
            receivedAt,
            severity: urgency,
            eocStatus: status,
            eocStaff: cellText(read("EOC STAFF")).slice(0, 120) || null,
            area,
            department,
            name: cellText(read("NAME")).slice(0, 200) || null,
            contact: cellText(read("CONTACT NUMBER")).slice(0, 100) || null,
            address: cellText(read("ADDRESS")).slice(0, 300) || null,
            age,
            gender,
            responders: cellText(read("RESPONDERS")).slice(0, 300) || null,
            remarks: cellText(read("Remarks")).slice(0, 2000) || null,
            },
        });
    }
    return { entries, errors };
}

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

const NATURE_EXCEL: Record<NatureOfConcern, string> = {
    inquiry: "INQURIES",
    complaint: "COMPLAINTS",
    report: "REPORT",
};
const SOURCE_EXCEL: Record<Exclude<IntakeSource, "web">, string> = {
    facebook_page: "FACEBOOK PAGE",
    phone_call: "PHONE CALL",
    text_messages: "TEXT MESSAGES",
    referral: "REFERRAL",
    walk_ins: "WALK INS",
};
const AREA_EXCEL: Record<BarangayArea, string> = {
    area_a: "AREA A",
    area_b: "AREA B",
    lupang_pangako: "LUPANG PANGAKO",
    group_13: "GROUP 13",
    others: "OTHERS",
};
const STATUS_EXCEL: Record<EocStatus, string> = {
    pending: "PENDING",
    transferred: "TRANSFERED",
    pending_with_mission_order: "PENDING WITH MISSION ORDER",
    responded: "RESPONDED",
};
const CATEGORY_EXCEL: Partial<Record<ReportCategory, string>> = {
    safety_concern: "VIOLENCE AND PUBLIC SAFETY",
    threats_harassment: "THREATS AND HARASSMENT",
    fire_hazard: "FIRE AND DISASTER ALERT",
    medical_health: "MEDICAL AND HEALTH",
    road_traffic: "ROAD AND TRAFFIC",
    road_accidents: "ROAD ACCIDENTS",
    noise_nuisance: "PUBLIC DISTURBANCE",
    electrical_concerns: "ELECTRICAL CONCERNS",
    animal_concerns: "ANIMAL RELATED CONCERNS",
    family_domestic: "FAMILY AND DOMESTIC CONCERNS",
    substance_concerns: "SUBSTANCE RELATED CONCERNS",
    social_welfare: "SOCIAL WELFARE COCNERNS",
    legal_mediation: "LEGAL AND BARANGAY MEDIATION",
    infrastructure: "INFRASTRUCTURE AND PUBLIC WORKS",
    clearance_concerns: "CLEARANCE CONCERNS",
    service_assistance: "SERVICE AND ASSISTANCE REQUESTS",
    environmental: "ENVIRONMENTAL CONCERNS",
    inquiries: "INQUIRIES",
    garbage_concerns: "GARBAGE CONCERNS",
    other: "OTHERS",
};
const DEPARTMENT_EXCEL: Record<string, string> = {
    "ASH / VAW": "ASH / VAW",
    BADAC: "BADAC",
    BCPC: "BCPC",
    "BDRRM Office": "BDRRM OFFICE",
    BHERT: "BHERT",
    "Alpha Base": "ALPHA BASE",
    "Bravo Base": "BRAVO BASE",
    "LP Base": "LP BASE",
    "Group 13 Base": "GROUP 13 BASE",
    "Clearance Department": "CLEARANCE DEPARTMENT",
    "CRO Office": "CRO OFFICE",
    "Environmental Protection": "ENVIRONMENTAL PROTECTION",
    "Fire Brigade": "FIRE BRIGADE",
    "Gender and Development": "GENDER AND DEVELOPMENT",
    "Lupon Tagapamayapa": "LUPON TAGAPAMAYAPA",
    Maynilad: "MAYNILAD",
    Meralco: "MERALCO",
    PDAO: "PDAO",
    "Police Station 13": "POLICE STATION 13",
    "Sector 5": "SECTOR 5",
    "Traffic Base": "TRAFFIC BASE",
    Secretary: "SECREATRY",
    BDRRM: "BDRRM",
    OTHERS: "OTHERS",
};

export function logbookTemplatePath() {
    return path.join(process.cwd(), "reference", "payatas-speak-up-logbook.xlsx");
}

export function readLogbookTemplate() {
    return readFile(logbookTemplatePath());
}

export async function buildLogbookSheet(rows: LogbookExportRow[]): Promise<Buffer> {
    const template = await readLogbookTemplate();
    if (rows.length === 0) return template;
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(template);
    const sheet = workbook.worksheets[0];
    const lastRow = Math.max(sheet.rowCount, rows.length + 1, 450);
    for (let rowNumber = 2; rowNumber <= lastRow; rowNumber += 1) {
        for (let column = 1; column <= 17; column += 1) {
            sheet.getCell(rowNumber, column).value = null;
        }
    }
    rows.forEach((row, index) => {
        const values = [
            formatManilaDateTime(row.created_at),
            row.eoc_staff ?? "",
            row.nature ? NATURE_EXCEL[row.nature] : "",
            SOURCE_EXCEL[row.source],
            row.name ?? "",
            row.sex ? GENDER_LABELS[row.sex].toUpperCase() : "",
            row.age ?? "",
            row.address ?? "",
            row.area ? AREA_EXCEL[row.area] : "",
            row.contact ?? "",
            row.concern,
            CATEGORY_EXCEL[row.category] ?? (CATEGORY_LABELS[row.category] ?? row.category).toUpperCase(),
            urgencyLabel(row.severity).toUpperCase(),
            row.department ? (DEPARTMENT_EXCEL[row.department] ?? row.department) : "",
            STATUS_EXCEL[row.eoc_status],
            row.remarks ?? "",
            row.responders ?? "",
        ];
        values.forEach((value, column) => {
            sheet.getCell(index + 2, column + 1).value = value === "" ? null : value;
        });
    });
    const output = await workbook.xlsx.writeBuffer();
    return Buffer.from(output);
}
