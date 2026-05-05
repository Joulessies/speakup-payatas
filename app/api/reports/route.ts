import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { moderateContent } from "@/lib/moderation";
import { classifyReport } from "@/lib/classification";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { fetchReportsBase } from "@/lib/server-db";
import { getReportsListLimitCap } from "@/lib/api-session";
import type { Notification, ReportAction, ReportStatus, VerificationStatus } from "@/types";

type WorkflowStatus = ReportStatus;

function jsonFromCaught(err: unknown, status = 503) {
  const message = err instanceof Error ? err.message : "Server configuration error";
  return NextResponse.json({ error: message }, { status });
}

async function addNotification(params: {
  recipient_hash?: string;
  recipient_role?: "admin" | "staff" | "user";
  type: Notification["type"];
  title: string;
  message: string;
  report_id?: string;
}) {
  await getSupabaseAdmin().from("notifications").insert({
    recipient_hash: params.recipient_hash,
    recipient_role: params.recipient_role,
    type: params.type,
    title: params.title,
    message: params.message,
    report_id: params.report_id,
    read: false,
  });
}

async function isBlocked(reporterHash: string): Promise<boolean> {
  const { data, error } = await getSupabaseAdmin()
    .from("spam_blocks")
    .select("reporter_hash")
    .eq("reporter_hash", reporterHash)
    .maybeSingle();
  if (error) {
    return false;
  }
  return Boolean(data?.reporter_hash);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { reporter_hash, receipt_id, category, description, latitude, longitude, severity } = body;
    if (!reporter_hash || !category || latitude == null || longitude == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (await isBlocked(reporter_hash)) {
      return NextResponse.json(
        { error: "Your account has been blocked due to repeated spam. Please contact the barangay office." },
        { status: 403 },
      );
    }

    const { allowed, remaining } = rateLimit(reporter_hash, 5);
    if (!allowed) {
      return NextResponse.json({ error: "Too many reports. Please try again later.", remaining }, { status: 429 });
    }

    const modResult = moderateContent(description || "");
    const now = new Date().toISOString();
    const actionHistory: ReportAction[] = [
      {
        id: crypto.randomUUID(),
        status: "pending",
        note: "Report submitted.",
        actor: "Resident",
        created_at: now,
      },
    ];

    const { data, error } = await getSupabaseAdmin()
      .from("reports")
      .insert({
        receipt_id: typeof receipt_id === "string" ? receipt_id : null,
        reporter_hash,
        category,
        description: description || "",
        latitude,
        longitude,
        severity: severity ?? 1,
        status: "pending",
        verification_status: "unreviewed",
        is_flagged: modResult.flagged,
        flag_reason: modResult.flagged ? modResult.reasons.join("; ") : null,
        ai_category: classifyReport(description || ""),
        submitted_at: now,
        action_history: actionHistory,
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? "Failed to create report" }, { status: 500 });
    }

    await addNotification({
      recipient_role: "admin",
      type: (severity ?? 1) >= 4 ? "high_priority" : "new_report",
      title: (severity ?? 1) >= 4 ? "High-Priority Report" : "New Report",
      message: `${category.replace(/_/g, " ")} - ${(description || "No description").slice(0, 60)}`,
      report_id: data.id,
    });
    await addNotification({
      recipient_role: "staff",
      type: (severity ?? 1) >= 4 ? "high_priority" : "new_report",
      title: (severity ?? 1) >= 4 ? "High-Priority Report" : "New Report",
      message: `${category.replace(/_/g, " ")} - ${(description || "No description").slice(0, 60)}`,
      report_id: data.id,
    });
    if (modResult.flagged) {
      await addNotification({
        recipient_role: "admin",
        type: "new_report",
        title: "Auto-flagged Report",
        message: `Flagged: ${modResult.reasons.join(", ")}`,
        report_id: data.id,
      });
    }

    return NextResponse.json({ success: true, report: data, flagged: modResult.flagged }, { status: 201 });
  } catch (err) {
    if (err instanceof SyntaxError || (err instanceof Error && err.message.includes("JSON"))) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    return jsonFromCaught(err);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const verification = searchParams.get("verification");
    const limit = Number(searchParams.get("limit") ?? "30");
    const reporterHash = searchParams.get("reporter_hash");

    const cap = await getReportsListLimitCap();
    const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(limit, cap)) : Math.min(30, cap);

    let query = getSupabaseAdmin()
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(boundedLimit);

    if (status) query = query.eq("status", status);
    if (verification) query = query.eq("verification_status", verification);
    if (reporterHash) query = query.ilike("reporter_hash", `${reporterHash}%`);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const reports = (data ?? []).map((report) => ({
      ...report,
      action_history: Array.isArray(report.action_history) ? report.action_history : [],
    }));
    return NextResponse.json({ reports });
  } catch (err) {
    return jsonFromCaught(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { report_id, status, verification_status, admin_category, note, actor } = body as {
      report_id?: string;
      status?: WorkflowStatus;
      verification_status?: VerificationStatus;
      admin_category?: string;
      note?: string;
      actor?: string;
    };
    if (!report_id) {
      return NextResponse.json({ error: "Missing report_id" }, { status: 400 });
    }

    const reports = await fetchReportsBase();
    const report = reports.find((r) => r.id === report_id);
    if (!report) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    const actionHistory = [...(report.action_history ?? [])];
    const now = new Date().toISOString();

    if (status) {
      const validStatus: WorkflowStatus[] = ["pending", "verified", "in_progress", "resolved"];
      if (!validStatus.includes(status)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 });
      }
      updates.status = status;
      actionHistory.push({
        id: crypto.randomUUID(),
        status,
        note: note?.trim() || `Status changed to ${status.replace("_", " ")}.`,
        actor: actor?.trim() || "Admin",
        created_at: now,
      });
      await addNotification({
        recipient_hash: report.reporter_hash,
        recipient_role: "user",
        type: "status_update",
        title: "Report Status Updated",
        message: `Your ${report.category.replace(/_/g, " ")} report is now "${status.replace("_", " ")}".`,
        report_id: report.id,
      });
    }

    if (verification_status) {
      const validVerification: VerificationStatus[] = ["unreviewed", "valid", "spam", "duplicate"];
      if (!validVerification.includes(verification_status)) {
        return NextResponse.json({ error: "Invalid verification_status" }, { status: 400 });
      }
      updates.verification_status = verification_status;
      updates.verified_by = actor?.trim() || "Admin";
      updates.verified_at = now;

      if (verification_status === "spam") {
        const { count: spamCount } = await getSupabaseAdmin()
          .from("reports")
          .select("id", { count: "exact", head: true })
          .eq("reporter_hash", report.reporter_hash)
          .eq("verification_status", "spam");

        const effectiveSpamCount = (spamCount ?? 0) + (report.verification_status === "spam" ? 0 : 1);
        if (effectiveSpamCount >= 3 && !(await isBlocked(report.reporter_hash))) {
          await getSupabaseAdmin().from("spam_blocks").insert({
            reporter_hash: report.reporter_hash,
            blocked_by: actor?.trim() || "System",
            reason: `Auto-blocked after ${effectiveSpamCount} spam reports`,
          });
          await addNotification({
            recipient_role: "admin",
            type: "spam_blocked",
            title: "Reporter Auto-Blocked",
            message: `Hash ${report.reporter_hash.slice(0, 8)}... blocked after ${effectiveSpamCount} spam reports.`,
          });
        }
      }

      await addNotification({
        recipient_hash: report.reporter_hash,
        recipient_role: "user",
        type: "verification",
        title: "Report Reviewed",
        message: `Your report has been marked as "${verification_status}".`,
        report_id: report.id,
      });
    }

    if (admin_category) {
      updates.admin_category = admin_category;
    }

    updates.action_history = actionHistory;

    const { data, error } = await getSupabaseAdmin()
      .from("reports")
      .update(updates)
      .eq("id", report_id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, report: data });
  } catch (err) {
    if (err instanceof SyntaxError || (err instanceof Error && err.message.includes("JSON"))) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    return jsonFromCaught(err);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const reportId = searchParams.get("id");
    if (!reportId) {
      return NextResponse.json({ error: "Missing report id" }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin().from("reports").delete().eq("id", reportId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return jsonFromCaught(err);
  }
}
