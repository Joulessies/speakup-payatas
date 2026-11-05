import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { Notification, ReportAction, ReportIntakeDetails } from "@/types";

export async function addNotification(params: {
  recipient_hash?: string;
  recipient_role?: "admin" | "staff" | "user";
  type: Notification["type"];
  title: string;
  message: string;
  report_id?: string;
}) {
  try {
    await getSupabaseAdmin().from("notifications").insert({
      recipient_hash: params.recipient_hash,
      recipient_role: params.recipient_role,
      type: params.type,
      title: params.title,
      message: params.message,
      report_id: params.report_id,
      read: false,
    });
  } catch {
    // Fail-safe
  }
}

export const INTAKE_DETAILS_TABLE = "report_intake_details";

export const MISSING_MIGRATION_MESSAGE =
  "The database is missing the intake/demographics update. Run sql/011_add_population_and_intake_fields.sql in the Supabase SQL Editor.";

export type IntakeSummaryRow = Pick<
  ReportIntakeDetails,
  "report_id" | "source" | "area" | "location_known" | "reporter_age" | "reporter_gender"
>;

export type DbReport = {
  id: string;
  receipt_id?: string | null;
  reporter_hash: string;
  category: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  severity?: number | null;
  status: string;
  verification_status?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  ai_category?: string | null;
  admin_category?: string | null;
  is_flagged?: boolean | null;
  flag_reason?: string | null;
  photo_url?: string | null;
  submitted_at?: string | null;
  created_at: string;
  action_history?: ReportAction[] | null;
};

export function normalizeActionHistory(value: unknown): ReportAction[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as { id?: unknown }).id === "string" &&
        typeof (item as { status?: unknown }).status === "string" &&
        typeof (item as { note?: unknown }).note === "string" &&
        typeof (item as { actor?: unknown }).actor === "string" &&
        typeof (item as { created_at?: unknown }).created_at === "string",
    )
    .map((item) => item as ReportAction);
}

export async function fetchReportsBase() {
  const { data, error } = await getSupabaseAdmin()
    .from("reports")
    .select(
      "id, receipt_id, reporter_hash, category, description, latitude, longitude, severity, status, verification_status, verified_by, verified_at, ai_category, admin_category, is_flagged, flag_reason, photo_url, submitted_at, created_at, action_history",
    );

  if (error) {
    throw new Error(error.message);
  }

  const reports = (data ?? []).map((row) => ({
    ...(row as DbReport),
    action_history: normalizeActionHistory((row as DbReport).action_history),
  }));

  return reports;
}

// PostgREST caps each response (1000 rows by default), so whole-table reads go page by page.
const PAGE_SIZE = 1000;
// Keeps `report_id=in.(...)` request URLs well under proxy length limits.
const ID_BATCH_SIZE = 150;

/**
 * Source, area, location flag and demographics keyed by report id (no names or contact details).
 * Pass `reportIds` to load only those reports. Returns null if the table can't be read
 * (e.g. migration 011 not run).
 */
export async function fetchIntakeSummaries(
  reportIds?: readonly string[],
): Promise<Map<string, IntakeSummaryRow> | null> {
  const columns = "report_id, source, area, location_known, reporter_age, reporter_gender";
  const rows: IntakeSummaryRow[] = [];
  if (reportIds) {
    for (let i = 0; i < reportIds.length; i += ID_BATCH_SIZE) {
      const { data, error } = await getSupabaseAdmin()
        .from(INTAKE_DETAILS_TABLE)
        .select(columns)
        .in("report_id", reportIds.slice(i, i + ID_BATCH_SIZE));
      if (error) return null;
      rows.push(...((data ?? []) as IntakeSummaryRow[]));
    }
  } else {
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await getSupabaseAdmin()
        .from(INTAKE_DETAILS_TABLE)
        .select(columns)
        .order("report_id")
        .range(from, from + PAGE_SIZE - 1);
      if (error) return null;
      rows.push(...((data ?? []) as IntakeSummaryRow[]));
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return new Map(rows.map((row) => [row.report_id, row]));
}

/**
 * Reports encoded without a map pin. They carry placeholder coordinates, so
 * hotspot clustering must skip them.
 */
export async function fetchUnlocatedReportIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await getSupabaseAdmin()
      .from(INTAKE_DETAILS_TABLE)
      .select("report_id")
      .eq("location_known", false)
      .order("report_id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) {
      // Before migration 011 there are no encoded reports to exclude.
      return ids;
    }
    for (const row of data ?? []) ids.add(row.report_id as string);
    if (!data || data.length < PAGE_SIZE) return ids;
  }
}
