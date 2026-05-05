import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { ReportAction } from "@/types";

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
      "id, receipt_id, reporter_hash, category, description, latitude, longitude, severity, status, verification_status, verified_by, verified_at, ai_category, admin_category, is_flagged, flag_reason, submitted_at, created_at, action_history",
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
