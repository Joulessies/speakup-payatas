// ── Report Categories (complaints only, NOT emergencies) ──
export type ReportCategory =
    | "drainage_flooding"
    | "fire_hazard"
    | "safety_concern"
    | "infrastructure"
    | "sanitation_health"
    | "noise_nuisance"
    | "environmental"
    | "other";

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
    drainage_flooding: "Drainage / Flooding",
    fire_hazard: "Fire Hazard / Risk",
    safety_concern: "Safety Concern",
    infrastructure: "Infrastructure",
    sanitation_health: "Sanitation / Health",
    noise_nuisance: "Noise / Nuisance",
    environmental: "Environmental",
    other: "Other",
};

export const CATEGORY_DESCRIPTIONS: Record<ReportCategory, string> = {
    drainage_flooding: "Clogged drains, flooding, water accumulation",
    fire_hazard: "Fire risks, exposed wiring, LPG leaks — NOT active fires",
    safety_concern: "Suspicious activity, vandalism — NOT crimes in progress",
    infrastructure: "Broken roads, streetlights, collapsed walls",
    sanitation_health: "Garbage, pests, contaminated water, dengue risk",
    noise_nuisance: "Excessive noise, disturbances, nuisance",
    environmental: "Pollution, erosion, illegal dumping",
    other: "Other non-emergency complaints",
};

// ── Report Interfaces ──
export interface ReportAction {
    id: string;
    status: ReportStatus;
    note: string;
    actor: string;
    created_at: string;
    photo_url?: string;
}

export type ReportStatus = "pending" | "verified" | "in_progress" | "resolved";
export type VerificationStatus = "unreviewed" | "valid" | "spam" | "duplicate";

export interface Report {
    id?: string;
    receipt_id?: string;
    reporter_hash: string;
    category: ReportCategory;
    description: string;
    latitude: number;
    longitude: number;
    severity: number;
    photo_url?: string;
    status?: ReportStatus;
    verification_status?: VerificationStatus;
    verified_by?: string;
    verified_at?: string;
    ai_category?: string;
    admin_category?: string;
    is_flagged?: boolean;
    flag_reason?: string;
    created_at?: string;
    submitted_at?: string;
    synced_at?: string;
    action_history?: ReportAction[];
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

// ── Internal Notes ──
export interface InternalNote {
    id: string;
    report_id: string;
    author: string;
    author_role: "admin" | "staff";
    content: string;
    created_at: string;
}

// ── Notifications ──
export type NotificationType =
    | "new_report"
    | "high_priority"
    | "status_update"
    | "verification"
    | "anomaly"
    | "spam_blocked";

export interface Notification {
    id: string;
    recipient_hash?: string;
    recipient_role?: "admin" | "staff" | "user";
    type: NotificationType;
    title: string;
    message: string;
    report_id?: string;
    read: boolean;
    created_at: string;
}

// ── Spam Blocking ──
export interface SpamBlock {
    reporter_hash: string;
    blocked_by: string;
    reason: string;
    blocked_at: string;
}

// ── Feedback ──
export interface Feedback {
    id: string;
    reporter_hash: string;
    report_id?: string;
    rating: 1 | 2 | 3 | 4 | 5;
    comment: string;
    created_at: string;
}

// ── Monthly Summary ──
export interface MonthlySummary {
    month: string;
    total_reports: number;
    resolved_count: number;
    resolution_rate: number;
    top_categories: { category: string; count: number }[];
    most_affected_areas: { latitude: number; longitude: number; count: number; top_category: string }[];
    avg_resolution_hours: number;
    spam_count: number;
    valid_count: number;
}
