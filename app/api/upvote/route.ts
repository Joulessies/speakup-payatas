import { NextResponse } from "next/server";
import { mockReports, seedIfNeeded } from "../reports/route";

// Track which hashes have upvoted which reports
const upvoteMap = new Map<string, Set<string>>(); // reportId -> Set<hash>

export async function POST(request: Request) {
  seedIfNeeded();

  try {
    const { report_id, reporter_hash } = await request.json();

    if (!report_id || !reporter_hash) {
      return NextResponse.json(
        { error: "Missing report_id or reporter_hash" },
        { status: 400 },
      );
    }

    const report = mockReports.find((r) => r.id === report_id);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    // Check if already upvoted
    if (!upvoteMap.has(report_id)) {
      upvoteMap.set(report_id, new Set());
    }

    const voters = upvoteMap.get(report_id)!;
    if (voters.has(reporter_hash)) {
      return NextResponse.json(
        { error: "Already confirmed", confirmations: voters.size },
        { status: 409 },
      );
    }

    voters.add(reporter_hash);

    return NextResponse.json({
      success: true,
      confirmations: voters.size,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

// GET: get confirmation count for a report
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reportId = searchParams.get("report_id");

  if (!reportId) {
    return NextResponse.json({ error: "Missing report_id" }, { status: 400 });
  }

  const count = upvoteMap.get(reportId)?.size ?? 0;
  return NextResponse.json({ confirmations: count });
}
