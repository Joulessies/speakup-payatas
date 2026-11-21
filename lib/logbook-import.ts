import * as XLSX from "xlsx";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { PAYATAS_CENTER, PAYATAS_AREAS } from "@/lib/payatas-boundary";
import {
    resolveCategory,
    BARANGAY_AREAS,
    INTAKE_SOURCES,
    NATURE_OF_CONCERN_OPTIONS,
    EOC_STATUSES,
    type BarangayArea,
    type EocStatus,
    type Gender,
    type IntakeSource,
    type NatureOfConcern,
    type ReportCategory,
    type ReportStatus,
} from "@/types";
import { INTAKE_DETAILS_TABLE } from "@/lib/server-db";

export interface ImportResult {
    success: boolean;
    imported: number;
    skipped: number;
    totalRows: number;
    errors: string[];
}

interface ParsedRecord {
    createdAt: string;
    eocStaff: string | null;
    nature: NatureOfConcern;
    source: IntakeSource;
    name: string | null;
    sex: Gender | null;
    age: number | null;
    address: string | null;
    area: BarangayArea;
    contact: string | null;
    concern: string;
    category: ReportCategory;
    severity: number;
    department: string | null;
    eocStatus: EocStatus;
    reportStatus: ReportStatus;
    remarks: string | null;
    responders: string | null;
    latitude: number;
    longitude: number;
}

function parseExcelDate(val: unknown): string {
    if (val instanceof Date && !isNaN(val.getTime())) {
        return val.toISOString();
    }
    if (typeof val === "number") {
        // Excel serial date to JS Date
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        if (!isNaN(date.getTime())) return date.toISOString();
    }
    if (typeof val === "string" && val.trim()) {
        const parsed = new Date(val.trim());
        if (!isNaN(parsed.getTime())) return parsed.toISOString();
    }
    return new Date().toISOString();
}

function parseNatureOfConcern(val: unknown): NatureOfConcern {
    if (!val) return "report";
    const str = String(val).toLowerCase().trim();
    if (str.includes("inquir") || str.includes("inquiry")) return "inquiry";
    if (str.includes("complain") || str.includes("complaint")) return "complaint";
    return "report";
}

function parseIntakeSource(val: unknown): IntakeSource {
    if (!val) return "walk_ins";
    const str = String(val).toLowerCase().trim();
    if (str.includes("facebook") || str.includes("fb")) return "facebook_page";
    if (str.includes("phone") || str.includes("call")) return "phone_call";
    if (str.includes("text") || str.includes("sms")) return "text_messages";
    if (str.includes("referral") || str.includes("endorse")) return "referral";
    if (str.includes("web") || str.includes("online") || str.includes("speakup")) return "web";
    return "walk_ins";
}

function parseBarangayArea(val: unknown): BarangayArea {
    if (!val) return "others";
    const str = String(val).toLowerCase().trim();
    if (str.includes("area a") || str === "a") return "area_a";
    if (str.includes("area b") || str === "b") return "area_b";
    if (str.includes("lupang pangako") || str.includes("pangako")) return "lupang_pangako";
    if (str.includes("group 13") || str.includes("grp 13") || str.includes("group-13")) return "group_13";
    return "others";
}

function getAreaCoordinates(area: BarangayArea): { lat: number; lng: number } {
    switch (area) {
        case "area_a":
            return { lat: 14.7080, lng: 121.0960 };
        case "area_b":
            return { lat: 14.7060, lng: 121.1020 };
        case "lupang_pangako":
            return { lat: 14.7085, lng: 121.1070 };
        case "group_13":
            return { lat: 14.7010, lng: 121.0870 };
        default:
            return { lat: PAYATAS_CENTER.lat, lng: PAYATAS_CENTER.lng };
    }
}

function parseGender(val: unknown): Gender | null {
    if (!val) return null;
    const str = String(val).toLowerCase().trim();
    if (str.startsWith("m") || str.includes("lalaki")) return "male";
    if (str.startsWith("f") || str.includes("babae")) return "female";
    if (str.includes("prefer") || str.includes("not to say")) return "prefer_not_to_say";
    return "other";
}

function parseSeverity(val: unknown): number {
    if (typeof val === "number" && val >= 1 && val <= 5) return Math.round(val);
    if (!val) return 3;
    const str = String(val).toUpperCase().trim();
    if (str.includes("HIGH") || str.includes("CRITICAL") || str === "5" || str === "4") return 5;
    if (str.includes("LOW") || str === "1" || str === "2") return 1;
    return 3;
}

function parseEocStatus(val: unknown): { eocStatus: EocStatus; reportStatus: ReportStatus } {
    if (!val) return { eocStatus: "pending", reportStatus: "pending" };
    const str = String(val).toUpperCase().trim();
    if (str.includes("RESPONDED") || str.includes("RESOLVED") || str.includes("CLOSED")) {
        return { eocStatus: "responded", reportStatus: "resolved" };
    }
    if (str.includes("MISSION ORDER")) {
        return { eocStatus: "pending_with_mission_order", reportStatus: "in_progress" };
    }
    if (str.includes("TRANSFER") || str.includes("IN PROGRESS") || str.includes("ENDORSED")) {
        return { eocStatus: "transferred", reportStatus: "in_progress" };
    }
    return { eocStatus: "pending", reportStatus: "pending" };
}

export async function importLogbookFromExcel(
    buffer: Buffer,
    options: { staffUsername?: string } = {}
): Promise<ImportResult> {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const recordsToInsert: ParsedRecord[] = [];
    const errors: string[] = [];
    let totalParsedRows = 0;
    let skippedRows = 0;

    // Scan sheets (skip hidden/utility sheets)
    for (const sheetName of workbook.SheetNames) {
        if (/analytics|summary|chart|kpi/i.test(sheetName)) continue;

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) continue;

        const rawData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false });
        if (!rawData || rawData.length === 0) continue;

        // Locate header row by looking for common column names
        let headerRowIndex = -1;
        const colMap: Record<string, number> = {};

        for (let i = 0; i < Math.min(10, rawData.length); i++) {
            const row = rawData[i] as unknown[];
            if (!Array.isArray(row)) continue;

            const rowTexts = row.map((cell) => String(cell ?? "").trim().toUpperCase());
            const hasDate = rowTexts.some((c) => c.includes("DATE") || c.includes("PETSA"));
            const hasConcern = rowTexts.some((c) => c.includes("CONCERN") || c.includes("REKLAMO") || c.includes("DESCRIPTION"));

            if (hasDate || hasConcern) {
                headerRowIndex = i;
                rowTexts.forEach((text, colIdx) => {
                    if (text.includes("DATE")) colMap.date = colIdx;
                    else if (text.includes("STAFF") || text.includes("ENCODER")) colMap.staff = colIdx;
                    else if (text.includes("NATURE")) colMap.nature = colIdx;
                    else if (text.includes("SOURCE")) colMap.source = colIdx;
                    else if (text.includes("NAME") && !text.includes("QUARTER")) colMap.name = colIdx;
                    else if (text.includes("SEX") || text.includes("GENDER")) colMap.sex = colIdx;
                    else if (text.includes("AGE") || text.includes("EDAD")) colMap.age = colIdx;
                    else if (text.includes("ADDRESS") || text.includes("TIRAHAN")) colMap.address = colIdx;
                    else if (text.includes("AREA")) colMap.area = colIdx;
                    else if (text.includes("CONTACT") || text.includes("PHONE") || text.includes("MOBILE")) colMap.contact = colIdx;
                    else if (text.includes("CONCERN") && !text.includes("TYPE") && !text.includes("NATURE") && !text.includes("SOURCE") && !text.includes("DEPT")) colMap.concern = colIdx;
                    else if (text.includes("TYPE OF CONCERN") || text.includes("CATEGORY")) colMap.category = colIdx;
                    else if (text.includes("URGENCY") || text.includes("SEVERITY")) colMap.urgency = colIdx;
                    else if (text.includes("DEPT") || text.includes("DEPARTMENT")) colMap.department = colIdx;
                    else if (text.includes("STATUS")) colMap.status = colIdx;
                    else if (text.includes("REMARK")) colMap.remarks = colIdx;
                    else if (text.includes("RESPONDER")) colMap.responders = colIdx;
                    else if (text.includes("LATITUDE") || text.includes("LAT")) colMap.latitude = colIdx;
                    else if (text.includes("LONGITUDE") || text.includes("LNG")) colMap.longitude = colIdx;
                });
                break;
            }
        }

        // Default to standard 17-column order if header row wasn't explicitly found
        if (headerRowIndex === -1) {
            headerRowIndex = 0;
            colMap.date = 0;
            colMap.staff = 1;
            colMap.nature = 2;
            colMap.source = 3;
            colMap.name = 4;
            colMap.sex = 5;
            colMap.age = 6;
            colMap.address = 7;
            colMap.area = 8;
            colMap.contact = 9;
            colMap.concern = 10;
            colMap.category = 11;
            colMap.urgency = 12;
            colMap.department = 13;
            colMap.status = 14;
            colMap.remarks = 15;
            colMap.responders = 16;
        }

        for (let r = headerRowIndex + 1; r < rawData.length; r++) {
            const row = rawData[r] as unknown[];
            if (!Array.isArray(row) || row.length === 0) continue;

            const concernText = String(row[colMap.concern ?? 10] ?? "").trim();
            const categoryText = String(row[colMap.category ?? 11] ?? "").trim();
            const nameText = String(row[colMap.name ?? 4] ?? "").trim();
            const dateVal = row[colMap.date ?? 0];

            // Ignore blank rows or template placeholder rows
            if (!concernText && !categoryText && !nameText && !dateVal) {
                continue;
            }

            // If concern is blank but category is present, construct a readable concern description
            let description = concernText;
            if (!description) {
                if (categoryText) {
                    description = `Report filed under ${categoryText}`;
                } else {
                    skippedRows++;
                    continue;
                }
            }

            totalParsedRows++;

            const area = parseBarangayArea(row[colMap.area ?? 8]);
            const defaultCoords = getAreaCoordinates(area);
            const rawLat = Number(row[colMap.latitude]);
            const rawLng = Number(row[colMap.longitude]);
            const latitude = !isNaN(rawLat) && rawLat !== 0 ? rawLat : defaultCoords.lat;
            const longitude = !isNaN(rawLng) && rawLng !== 0 ? rawLng : defaultCoords.lng;

            const ageNum = parseInt(String(row[colMap.age ?? 6]), 10);
            const age = !isNaN(ageNum) && ageNum >= 1 && ageNum <= 120 ? ageNum : null;

            const category = resolveCategory(categoryText) || "other";
            const severity = parseSeverity(row[colMap.urgency ?? 12]);
            const { eocStatus, reportStatus } = parseEocStatus(row[colMap.status ?? 14]);

            recordsToInsert.push({
                createdAt: parseExcelDate(dateVal),
                eocStaff: String(row[colMap.staff ?? 1] ?? "").trim() || null,
                nature: parseNatureOfConcern(row[colMap.nature ?? 2]),
                source: parseIntakeSource(row[colMap.source ?? 3]),
                name: nameText || null,
                sex: parseGender(row[colMap.sex ?? 5]),
                age,
                address: String(row[colMap.address ?? 7] ?? "").trim() || "Payatas, Quezon City",
                area,
                contact: String(row[colMap.contact ?? 9] ?? "").trim() || null,
                concern: description,
                category,
                severity,
                department: String(row[colMap.department ?? 13] ?? "").trim() || "BDRRM OFFICE",
                eocStatus,
                reportStatus,
                remarks: String(row[colMap.remarks ?? 15] ?? "").trim() || null,
                responders: String(row[colMap.responders ?? 16] ?? "").trim() || null,
                latitude,
                longitude,
            });
        }
    }

    if (recordsToInsert.length === 0) {
        return {
            success: true,
            imported: 0,
            skipped: skippedRows,
            totalRows: totalParsedRows,
            errors: ["No valid report rows were found in the uploaded Excel file."],
        };
    }

    const supabase = getSupabaseAdmin();
    let importedCount = 0;
    const now = Date.now();

    // Process in batches of 50 to avoid query limits
    const batchSize = 50;
    for (let i = 0; i < recordsToInsert.length; i += batchSize) {
        const batch = recordsToInsert.slice(i, i + batchSize);

        const reportsPayload = batch.map((r, idx) => {
            const rowId = randomUUID();
            const receiptId = `SPK-IMP-${now.toString(36).toUpperCase().slice(-4)}${randomBytes(2).toString("hex").toUpperCase()}`;
            const reporterHash = createHash("sha256").update(rowId).digest("hex");

            return {
                id: rowId,
                receipt_id: receiptId,
                reporter_hash: reporterHash,
                category: r.category,
                description: r.concern,
                latitude: r.latitude,
                longitude: r.longitude,
                severity: r.severity,
                status: r.reportStatus,
                verification_status: "valid",
                verified_at: r.createdAt,
                created_at: r.createdAt,
                submitted_at: r.createdAt,
                is_flagged: false,
                action_history: [
                    {
                        id: randomUUID(),
                        status: r.reportStatus,
                        note: `Imported from Excel logbook by ${options.staffUsername || "EOC Staff"}.`,
                        actor: options.staffUsername || "EOC Staff",
                        created_at: r.createdAt,
                    },
                ],
            };
        });

        const { data: insertedReports, error: reportsError } = await supabase
            .from("reports")
            .insert(reportsPayload)
            .select("id");

        if (reportsError) {
            errors.push(`Batch insert failed: ${reportsError.message}`);
            continue;
        }

        // Insert matching details in report_intake_details
        const detailsPayload = batch.map((r, idx) => ({
            report_id: reportsPayload[idx].id,
            source: r.source,
            nature_of_concern: r.nature,
            area: r.area,
            concern_department: r.department,
            location_known: true,
            reporter_name: r.name,
            reporter_contact: r.contact,
            reporter_address: r.address,
            reporter_age: r.age,
            reporter_gender: r.sex,
            responders: r.responders,
            remarks: r.remarks,
            eoc_staff: r.eocStaff,
            eoc_status: r.eocStatus,
            encoded_by: options.staffUsername || "Excel Import",
        }));

        const { error: detailsError } = await supabase
            .from(INTAKE_DETAILS_TABLE)
            .insert(detailsPayload);

        if (detailsError) {
            // Gracefully retry without eoc_staff/eoc_status if those columns don't exist in the database
            const fallback = detailsPayload.map((d) => {
                const clone = { ...d };
                delete (clone as Record<string, unknown>).eoc_staff;
                delete (clone as Record<string, unknown>).eoc_status;
                return clone;
            });
            await supabase.from(INTAKE_DETAILS_TABLE).insert(fallback);
        }

        importedCount += insertedReports?.length ?? batch.length;
    }

    return {
        success: importedCount > 0,
        imported: importedCount,
        skipped: skippedRows,
        totalRows: totalParsedRows,
        errors,
    };
}
