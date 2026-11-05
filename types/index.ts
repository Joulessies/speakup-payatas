// ── Report Categories ──
// Follows the barangay's "Type of Concern" list. The keys of the original eight
// categories are kept (with updated labels) so existing reports stay valid; the
// database CHECK constraint in sql/011 must list the same keys.
export const REPORT_CATEGORIES = [
    "safety_concern",
    "threats_harassment",
    "fire_hazard",
    "medical_health",
    "road_traffic",
    "road_accidents",
    "noise_nuisance",
    "electrical_concerns",
    "animal_concerns",
    "family_domestic",
    "substance_concerns",
    "social_welfare",
    "legal_mediation",
    "infrastructure",
    "drainage_flooding",
    "clearance_concerns",
    "service_assistance",
    "environmental",
    "garbage_concerns",
    "sanitation_health",
    "inquiries",
    "other",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export function isReportCategory(value: unknown): value is ReportCategory {
    return typeof value === "string" && (REPORT_CATEGORIES as readonly string[]).includes(value);
}

export const CATEGORY_LABELS: Record<ReportCategory, string> = {
    safety_concern: "Violence and Public Safety",
    threats_harassment: "Threats and Harassment",
    fire_hazard: "Fire and Disaster Alert",
    medical_health: "Medical and Health",
    road_traffic: "Road and Traffic",
    road_accidents: "Road Accidents",
    noise_nuisance: "Public Disturbance / Noise",
    electrical_concerns: "Electrical Concerns",
    animal_concerns: "Animal Related Concerns",
    family_domestic: "Family and Domestic Concerns",
    substance_concerns: "Substance Related Concerns",
    social_welfare: "Social Welfare Concerns",
    legal_mediation: "Legal and Barangay Mediation",
    infrastructure: "Infrastructure and Public Works",
    drainage_flooding: "Drainage / Flooding",
    clearance_concerns: "Clearance Concerns",
    service_assistance: "Service and Assistance Requests",
    environmental: "Environmental Concerns",
    garbage_concerns: "Garbage Concerns",
    sanitation_health: "Sanitation / Health",
    inquiries: "Inquiries",
    other: "Others",
};

export const CATEGORY_DESCRIPTIONS: Record<ReportCategory, string> = {
    safety_concern: "Fights, vandalism, suspicious activity — call 911 for crimes in progress",
    threats_harassment: "Verbal or physical threats, harassment, bullying, intimidation",
    fire_hazard: "Fire risks, LPG leaks, disaster warnings — call 911 for active fires",
    medical_health: "Health assistance, medicine, check-ups — call 911 for medical emergencies",
    road_traffic: "Traffic congestion, illegal parking, blocked roads and alleys",
    road_accidents: "Vehicle or pedestrian accidents, accident-prone spots",
    noise_nuisance: "Excessive noise, videoke, public drinking, disturbances",
    electrical_concerns: "Sagging or tangled wires, sparking posts, illegal connections",
    animal_concerns: "Stray or aggressive animals, animal bites, dead animals",
    family_domestic: "Family disputes, domestic abuse, VAWC and child protection concerns",
    substance_concerns: "Illegal drug activity, substance abuse",
    social_welfare: "Assistance for seniors, PWDs, solo parents, and indigent families",
    legal_mediation: "Disputes for Lupon / Katarungang Pambarangay mediation",
    infrastructure: "Broken roads, streetlights, collapsed walls, public works",
    drainage_flooding: "Clogged drains, flooding, water accumulation",
    clearance_concerns: "Barangay clearance, certificates, and other documents",
    service_assistance: "Requests for barangay services, equipment, or assistance",
    environmental: "Pollution, open burning, erosion, illegal dumping",
    garbage_concerns: "Uncollected garbage, waste pile-ups, missed collection",
    sanitation_health: "Pests, contaminated water, dengue risk, unsanitary areas",
    inquiries: "Questions about barangay services, schedules, or offices",
    other: "Other non-emergency concerns",
};

export const CATEGORY_COLORS: Record<ReportCategory, string> = {
    safety_concern: "#ef4444",
    threats_harassment: "#db2777",
    fire_hazard: "#f97316",
    medical_health: "#f472b6",
    road_traffic: "#ca8a04",
    road_accidents: "#991b1b",
    noise_nuisance: "#a855f7",
    electrical_concerns: "#facc15",
    animal_concerns: "#92400e",
    family_domestic: "#c026d3",
    substance_concerns: "#7c3aed",
    social_welfare: "#0ea5e9",
    legal_mediation: "#4338ca",
    infrastructure: "#f59e0b",
    drainage_flooding: "#3b82f6",
    clearance_concerns: "#64748b",
    service_assistance: "#06b6d4",
    environmental: "#14b8a6",
    garbage_concerns: "#65a30d",
    sanitation_health: "#10b981",
    inquiries: "#818cf8",
    other: "#9ca3af",
};

/** Kept off the public transparency board: these can involve victims, minors, or health information. */
export const CONFIDENTIAL_CATEGORIES: readonly ReportCategory[] = [
    "threats_harassment",
    "medical_health",
    "family_domestic",
    "substance_concerns",
    "social_welfare",
    "legal_mediation",
];

// Short keys used by older mock data and charts.
const CATEGORY_ALIASES: Record<string, ReportCategory> = {
    flooding: "drainage_flooding",
    fire: "fire_hazard",
    crime: "safety_concern",
    infra: "infrastructure",
    health: "sanitation_health",
    noise: "noise_nuisance",
    environ: "environmental",
};

/** Maps a stored category string to a known category key, or null if it is not recognized. */
export function resolveCategory(value: string | null | undefined): ReportCategory | null {
    if (!value) return null;
    const key = value.toLowerCase().trim().replace(/[\s/-]+/g, "_");
    if (isReportCategory(key)) return key;
    return CATEGORY_ALIASES[key] ?? null;
}

// ── Reporter Demographics (population report) ──
export const GENDER_OPTIONS = ["male", "female", "other", "prefer_not_to_say"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
    male: "Male",
    female: "Female",
    other: "Other",
    prefer_not_to_say: "Prefer not to say",
};

export function isGender(value: unknown): value is Gender {
    return typeof value === "string" && (GENDER_OPTIONS as readonly string[]).includes(value);
}

export const REPORTER_AGE_MIN = 1;
export const REPORTER_AGE_MAX = 120;

/** Returns a whole-number age within bounds, or null for blank/invalid input. */
export function parseReporterAge(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const age = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isInteger(age) || age < REPORTER_AGE_MIN || age > REPORTER_AGE_MAX) return null;
    return age;
}

export const AGE_GROUPS = [
    { key: "minor", label: "Minors (below 18)", min: 0, max: 17 },
    { key: "youth", label: "Youth (18–30)", min: 18, max: 30 },
    { key: "adult", label: "Adults (31–59)", min: 31, max: 59 },
    { key: "senior", label: "Senior citizens (60+)", min: 60, max: Number.POSITIVE_INFINITY },
] as const;

export type AgeGroupKey = (typeof AGE_GROUPS)[number]["key"];

export function getAgeGroup(age: number): AgeGroupKey {
    return (AGE_GROUPS.find((group) => age >= group.min && age <= group.max) ?? AGE_GROUPS[AGE_GROUPS.length - 1]).key;
}

// ── Staff Intake (concerns received outside the website) ──
export const INTAKE_SOURCES = ["web", "facebook_page", "text_messages", "phone_call", "walk_ins", "referral"] as const;
export type IntakeSource = (typeof INTAKE_SOURCES)[number];

export const INTAKE_SOURCE_LABELS: Record<IntakeSource, string> = {
    web: "SpeakUp website",
    facebook_page: "Facebook Page / Messenger",
    text_messages: "Text message (SMS)",
    phone_call: "Phone call",
    walk_ins: "Walk-in",
    referral: "Referral",
};

export const NATURE_OF_CONCERN_OPTIONS = ["complaint", "report", "inquiry"] as const;
export type NatureOfConcern = (typeof NATURE_OF_CONCERN_OPTIONS)[number];

export const NATURE_OF_CONCERN_LABELS: Record<NatureOfConcern, string> = {
    complaint: "Complaint",
    report: "Report",
    inquiry: "Inquiry",
};

export const BARANGAY_AREAS = ["area_a", "area_b", "lupang_pangako", "group_13", "others"] as const;
export type BarangayArea = (typeof BARANGAY_AREAS)[number];

export const BARANGAY_AREA_LABELS: Record<BarangayArea, string> = {
    area_a: "Area A",
    area_b: "Area B",
    lupang_pangako: "Lupang Pangako",
    group_13: "Group 13",
    others: "Other areas",
};

export const CONCERN_DEPARTMENTS = [
    "ASH / VAW",
    "BADAC",
    "BCPC",
    "BDRRM Office",
    "BHERT",
    "Alpha Base",
    "Bravo Base",
    "LP Base",
    "Group 13 Base",
    "Clearance Department",
    "CRO Office",
    "Environmental Protection",
    "Fire Brigade",
    "Gender and Development",
    "Lupon Tagapamayapa",
    "Maynilad",
    "Meralco",
    "PDAO",
    "Police Station 13",
    "Sector 5",
    "Traffic Base",
    "Secretary",
    "Others",
] as const;

export type ConcernDepartment = (typeof CONCERN_DEPARTMENTS)[number];

/** Private per-report details; only staff and admins can read them. */
export interface ReportIntakeDetails {
    report_id: string;
    source: IntakeSource;
    nature_of_concern: NatureOfConcern | null;
    area: BarangayArea | null;
    concern_department: string | null;
    location_known: boolean;
    reporter_name: string | null;
    reporter_contact: string | null;
    reporter_address: string | null;
    reporter_age: number | null;
    reporter_gender: Gender | null;
    responders: string | null;
    remarks: string | null;
    encoded_by: string | null;
    created_at: string;
}

export type GenderBucket = "male" | "female" | "other" | "not_specified";

export interface PopulationReport {
    total_reports: number;
    with_age: number;
    with_gender: number;
    average_age: number | null;
    gender: Record<GenderBucket, number>;
    /** Rows are age groups, columns are genders. */
    age_by_gender: Record<AgeGroupKey | "not_specified", Record<GenderBucket, number>>;
    sources: Record<IntakeSource, number>;
    areas: Record<BarangayArea | "not_specified", number>;
}

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
    /** Optional, sent with the submission only; stored in the private intake table. */
    reporter_age?: number | null;
    reporter_gender?: Gender | null;
    /** Set by GET /api/reports for concerns encoded by staff; null for website submissions. */
    intake_source?: IntakeSource | null;
    intake_area?: BarangayArea | null;
    /** False when staff encoded the concern without a map pin; the coordinates are then a placeholder. */
    location_known?: boolean;
}

export interface OfflineReport extends Report {
    offline_id?: number;
    is_synced: number;
}

export interface ClusterReport {
    id: string;
    receipt_id?: string;
    category: string;
    severity: number;
    created_at: string;
    latitude: number;
    longitude: number;
    status: string;
    description: string;
}

export interface ClusterResult {
    latitude: number;
    longitude: number;
    count: number;
    category_breakdown: Record<string, number>;
    /** Member reports, newest first (returned by /api/clusters). */
    reports?: ClusterReport[];
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
    | "encoded_report"
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
