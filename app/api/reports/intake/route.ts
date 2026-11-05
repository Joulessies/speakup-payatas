import { NextResponse } from "next/server";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { classifyReport } from "@/lib/classification";
import { requireStaffSession } from "@/lib/api-session";
import { isWithinPayatas, PAYATAS_CENTER } from "@/lib/payatas-boundary";
import { addNotification, INTAKE_DETAILS_TABLE, MISSING_MIGRATION_MESSAGE } from "@/lib/server-db";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import {
  BARANGAY_AREAS,
  CATEGORY_LABELS,
  CONCERN_DEPARTMENTS,
  INTAKE_SOURCE_LABELS,
  INTAKE_SOURCES,
  NATURE_OF_CONCERN_OPTIONS,
  REPORTER_AGE_MAX,
  REPORTER_AGE_MIN,
  isGender,
  isReportCategory,
  parseReporterAge,
  type ReportAction,
  type ReportIntakeDetails,
  type ReportStatus,
} from "@/types";

const INITIAL_STATUSES: readonly ReportStatus[] = ["pending", "in_progress", "resolved"];
const MAX_BACKDATE_MS = 366 * 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

function jsonFromCaught(err: unknown) {
  const message = err instanceof Error ? err.message : "Server configuration error";
  return NextResponse.json({ error: message }, { status: 503 });
}

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** Staff/admin encode a concern received by SMS, Messenger, phone, walk-in, or referral. */
export async function POST(request: Request) {
  const auth = await requireStaffSession();
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest("Invalid request body");
  }

  const { source, nature_of_concern, category, area, concern_department, reporter_gender, status } = body;
  if (!isOneOf(INTAKE_SOURCES, source) || source === "web") {
    return badRequest("Choose where the concern was received.");
  }
  if (!isOneOf(NATURE_OF_CONCERN_OPTIONS, nature_of_concern)) {
    return badRequest("Choose the nature of the concern.");
  }
  if (!isReportCategory(category)) {
    return badRequest("Choose the type of concern.");
  }
  const description = optionalText(body.description, 5000);
  if (!description) {
    return badRequest("Describe the concern.");
  }
  if (!isBlank(area) && !isOneOf(BARANGAY_AREAS, area)) {
    return badRequest("Unknown area.");
  }
  if (!isBlank(concern_department) && !isOneOf(CONCERN_DEPARTMENTS, concern_department)) {
    return badRequest("Unknown concern department.");
  }
  if (!isBlank(reporter_gender) && !isGender(reporter_gender)) {
    return badRequest("Unknown gender.");
  }
  const reporterAge = parseReporterAge(body.reporter_age);
  if (!isBlank(body.reporter_age) && reporterAge === null) {
    return badRequest(`Age must be a whole number from ${REPORTER_AGE_MIN} to ${REPORTER_AGE_MAX}.`);
  }
  const severity = isBlank(body.severity) ? 3 : Number(body.severity);
  if (!Number.isInteger(severity) || severity < 1 || severity > 5) {
    return badRequest("Urgency must be from 1 to 5.");
  }
  const initialStatus = isBlank(status) ? "pending" : status;
  if (!isOneOf(INITIAL_STATUSES, initialStatus)) {
    return badRequest("Unknown status.");
  }

  const now = Date.now();
  let receivedAt = now;
  if (!isBlank(body.received_at)) {
    const parsed = new Date(String(body.received_at)).getTime();
    if (Number.isNaN(parsed)) {
      return badRequest("Invalid date received.");
    }
    if (parsed > now + CLOCK_SKEW_MS) {
      return badRequest("Date received can't be in the future.");
    }
    if (now - parsed > MAX_BACKDATE_MS) {
      return badRequest("Date received must be within the past year.");
    }
    receivedAt = parsed;
  }

  const { latitude, longitude } = body;
  const hasPin =
    typeof latitude === "number" &&
    typeof longitude === "number" &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);
  if (hasPin && !isWithinPayatas(latitude, longitude)) {
    return badRequest("The pinned location is outside Barangay Payatas.");
  }

  try {
    const supabase = getSupabaseAdmin();
    const receivedIso = new Date(receivedAt).toISOString();
    const nowIso = new Date(now).toISOString();
    const sourceLabel = INTAKE_SOURCE_LABELS[source];

    const actionHistory: ReportAction[] = [
      {
        id: randomUUID(),
        status: "pending",
        note: `Concern received via ${sourceLabel} and encoded by barangay staff.`,
        actor: "Resident",
        created_at: receivedIso,
      },
    ];
    if (initialStatus !== "pending") {
      actionHistory.push({
        id: randomUUID(),
        status: initialStatus,
        note: `Status set to ${initialStatus.replace("_", " ")} when the concern was encoded.`,
        actor: auth.role === "admin" ? "Admin" : "Staff",
        created_at: nowIso,
      });
    }

    const { data: report, error: reportError } = await supabase
      .from("reports")
      .insert({
        receipt_id: `SPK-${now.toString(36).toUpperCase().slice(-4)}${randomBytes(2).toString("hex").toUpperCase()}`,
        // Not linked to any device; residents without the app can't track by hash anyway.
        reporter_hash: createHash("sha256").update(randomUUID()).digest("hex"),
        category,
        description,
        latitude: hasPin ? latitude : PAYATAS_CENTER.lat,
        longitude: hasPin ? longitude : PAYATAS_CENTER.lng,
        severity,
        status: initialStatus,
        verification_status: "valid",
        verified_at: nowIso,
        is_flagged: false,
        ai_category: classifyReport(description),
        created_at: receivedIso,
        submitted_at: receivedIso,
        action_history: actionHistory,
      })
      .select("id, receipt_id, created_at")
      .single();

    if (reportError || !report) {
      const message = reportError?.message?.includes("reports_category_check")
        ? MISSING_MIGRATION_MESSAGE
        : (reportError?.message ?? "Failed to save the report.");
      return NextResponse.json({ error: message }, { status: 500 });
    }

    const { error: detailsError } = await supabase.from(INTAKE_DETAILS_TABLE).insert({
      report_id: report.id,
      source,
      nature_of_concern,
      area: isBlank(area) ? null : area,
      concern_department: isBlank(concern_department) ? null : concern_department,
      location_known: hasPin,
      reporter_name: optionalText(body.reporter_name, 200),
      reporter_contact: optionalText(body.reporter_contact, 100),
      reporter_address: optionalText(body.reporter_address, 300),
      reporter_age: reporterAge,
      reporter_gender: isBlank(reporter_gender) ? null : reporter_gender,
      responders: optionalText(body.responders, 300),
      remarks: optionalText(body.remarks, 2000),
      encoded_by: auth.username,
    });

    if (detailsError) {
      // Without its details row, an unpinned report would show up as a hotspot at the placeholder location.
      await supabase.from("reports").delete().eq("id", report.id);
      return NextResponse.json(
        { error: isMissingTable(detailsError) ? MISSING_MIGRATION_MESSAGE : detailsError.message },
        { status: isMissingTable(detailsError) ? 503 : 500 },
      );
    }

    const isHighPriority = severity >= 4;
    for (const role of ["admin", "staff"] as const) {
      await addNotification({
        recipient_role: role,
        type: isHighPriority ? "high_priority" : "encoded_report",
        title: `${isHighPriority ? "High-Priority Report" : "Report Encoded"} via ${sourceLabel}`,
        message: `${CATEGORY_LABELS[category]} (encoded by ${auth.username}) - ${description.slice(0, 60)}`,
        report_id: report.id,
      });
    }

    return NextResponse.json({ success: true, report }, { status: 201 });
  } catch (err) {
    return jsonFromCaught(err);
  }
}

/** Private intake details for one report (complainant, source, demographics). Staff/admin only. */
export async function GET(request: Request) {
  const auth = await requireStaffSession();
  if (!auth.ok) return auth.response;

  const reportId = new URL(request.url).searchParams.get("report_id");
  if (!reportId) {
    return badRequest("Missing report_id");
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from(INTAKE_DETAILS_TABLE)
      .select("*")
      .eq("report_id", reportId)
      .maybeSingle();
    if (error) {
      if (isMissingTable(error)) {
        return NextResponse.json({ details: null });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ details: (data as ReportIntakeDetails | null) ?? null });
  } catch (err) {
    return jsonFromCaught(err);
  }
}
