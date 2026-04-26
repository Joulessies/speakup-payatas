import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import type { ReportAction } from "@/types";

// In-memory store for mock reports (resets on server restart)
type WorkflowStatus = "pending" | "verified" | "in_progress" | "resolved";

interface MockReport {
  id: string;
  reporter_hash: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  severity: number;
  status: WorkflowStatus;
  created_at: string;
  action_history: ReportAction[];
}

const mockReports: MockReport[] = [];

// Seed some sample data around Payatas
const SEED_DATA = [
  { lat: 14.7045, lng: 121.0985, category: "flooding", severity: 4, description: "Flooded street near Payatas Road" },
  { lat: 14.7052, lng: 121.0992, category: "flooding", severity: 3, description: "Water level rising at drainage canal" },
  { lat: 14.7048, lng: 121.0988, category: "flooding", severity: 5, description: "Knee-deep flood blocking path" },
  { lat: 14.7060, lng: 121.0990, category: "flooding", severity: 3, description: "Clogged drainage causing overflow" },
  { lat: 14.7100, lng: 121.1020, category: "infrastructure", severity: 4, description: "Collapsed retaining wall on hillside" },
  { lat: 14.7105, lng: 121.1025, category: "infrastructure", severity: 3, description: "Cracked road near barangay hall" },
  { lat: 14.7098, lng: 121.1018, category: "infrastructure", severity: 5, description: "Broken streetlight on main road" },
  { lat: 14.7102, lng: 121.1022, category: "crime", severity: 4, description: "Theft reported near market area" },
  { lat: 14.6980, lng: 121.0950, category: "health", severity: 5, description: "Dengue cases in the area" },
  { lat: 14.6985, lng: 121.0955, category: "health", severity: 4, description: "Contaminated water supply" },
  { lat: 14.6978, lng: 121.0948, category: "health", severity: 3, description: "Open garbage dump attracting pests" },
  { lat: 14.6982, lng: 121.0952, category: "environmental", severity: 4, description: "Illegal waste burning" },
  { lat: 14.7070, lng: 121.1060, category: "fire", severity: 5, description: "Small fire in informal settlement" },
  { lat: 14.7075, lng: 121.1065, category: "fire", severity: 4, description: "Exposed electrical wiring sparking" },
  { lat: 14.7072, lng: 121.1062, category: "fire", severity: 5, description: "LPG tank leak reported" },
  { lat: 14.7068, lng: 121.1058, category: "fire", severity: 3, description: "Burnt area needs clearing" },
  { lat: 14.7120, lng: 121.0970, category: "crime", severity: 3, description: "Suspicious activity at night" },
  { lat: 14.7125, lng: 121.0975, category: "crime", severity: 4, description: "Vandalism on public property" },
  { lat: 14.7118, lng: 121.0968, category: "crime", severity: 2, description: "Noise disturbance from construction" },
  { lat: 14.7010, lng: 121.1000, category: "environmental", severity: 3, description: "River pollution from runoff" },
  { lat: 14.7015, lng: 121.1005, category: "environmental", severity: 4, description: "Landslide risk on steep slope" },
  { lat: 14.7008, lng: 121.0998, category: "environmental", severity: 5, description: "Soil erosion near houses" },
];

let seeded = false;

function seedIfNeeded() {
  if (seeded) return;
  seeded = true;
  for (const s of SEED_DATA) {
    mockReports.push({
      id: crypto.randomUUID(),
      reporter_hash: "mock_" + Math.random().toString(36).slice(2, 10),
      category: s.category,
      description: s.description,
      latitude: s.lat,
      longitude: s.lng,
      severity: s.severity,
      status: "pending",
      created_at: new Date(
        Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      action_history: [
        {
          id: crypto.randomUUID(),
          status: "pending",
          note: "Report submitted by resident.",
          actor: "System",
          created_at: new Date().toISOString(),
        },
      ],
    });
  }
}

export async function POST(request: Request) {
  seedIfNeeded();

  try {
    const body = await request.json();
    const { reporter_hash, category, description, latitude, longitude, severity } = body;

    if (!reporter_hash || !category || !latitude || !longitude) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // No geofence check in mock mode

    // Rate limiting: max 5 reports per hash per hour
    const { allowed, remaining } = rateLimit(reporter_hash, 5);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many reports. Please try again later.", remaining },
        { status: 429 },
      );
    }

    const report = {
      id: crypto.randomUUID(),
      reporter_hash,
      category,
      description: description || "",
      latitude,
      longitude,
      severity: severity ?? 1,
      status: "pending",
      created_at: new Date().toISOString(),
      action_history: [
        {
          id: crypto.randomUUID(),
          status: "pending" as const,
          note: "Report submitted.",
          actor: "Resident",
          created_at: new Date().toISOString(),
        },
      ],
    };

    mockReports.push(report);

    return NextResponse.json(
      { success: true, report: { id: report.id, created_at: report.created_at } },
      { status: 201 },
    );
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  seedIfNeeded();
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limit = Number(searchParams.get("limit") ?? "30");

  const validStatus = new Set(["pending", "verified", "in_progress", "resolved"]);
  const filtered = mockReports
    .filter((r) => (status && validStatus.has(status) ? r.status === status : true))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, Number.isFinite(limit) ? Math.max(1, Math.min(limit, 100)) : 30);

  return NextResponse.json({ reports: filtered });
}

export async function PATCH(request: Request) {
  seedIfNeeded();
  try {
    const body = await request.json();
    const { report_id, status, note, actor } = body as {
      report_id?: string;
      status?: WorkflowStatus;
      note?: string;
      actor?: string;
    };

    if (!report_id || !status) {
      return NextResponse.json(
        { error: "Missing report_id or status" },
        { status: 400 },
      );
    }

    const validStatus: WorkflowStatus[] = ["pending", "verified", "in_progress", "resolved"];
    if (!validStatus.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const report = mockReports.find((r) => r.id === report_id);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    report.status = status;
    report.action_history.push({
      id: crypto.randomUUID(),
      status,
      note: note?.trim() || `Status changed to ${status.replace("_", " ")}.`,
      actor: actor?.trim() || "Admin",
      created_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, report });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

// Also expose the mock data for the clusters route
export { mockReports, seedIfNeeded };
