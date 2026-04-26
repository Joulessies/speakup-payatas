export interface Report {
  id?: string;
  reporter_hash: string;
  category: ReportCategory;
  description: string;
  latitude: number;
  longitude: number;
  severity: number;
  photo_url?: string;
  status?: "pending" | "verified" | "resolved";
  created_at?: string;
  synced_at?: string;
}

export interface OfflineReport extends Report {
  offline_id?: number;
  is_synced: number;
}

export interface ClusterResult {
  latitude: number;
  longitude: number;
  count: number;
  category_breakdown: Record<string, number>;
}

export type ReportCategory =
  | "flooding"
  | "fire"
  | "crime"
  | "infrastructure"
  | "health"
  | "environmental"
  | "other";

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
  flooding: "Flooding",
  fire: "Fire",
  crime: "Crime",
  infrastructure: "Infrastructure",
  health: "Health Hazard",
  environmental: "Environmental",
  other: "Other",
};
