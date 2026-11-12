import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { rateLimit } from "@/lib/rate-limit";
import { moderateContent } from "@/lib/moderation";
import { classifyReport } from "@/lib/classification";
import { predictWithHF } from "@/lib/huggingface";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { addNotification, fetchIntakeSummaries, INTAKE_DETAILS_TABLE, normalizeActionHistory } from "@/lib/server-db";
import { getReportsListLimitCap } from "@/lib/api-session";
import { AUTH_COOKIE_NAME, verifyAuthToken } from "@/lib/auth";
import { accountReporterHashFromSession } from "@/lib/reporter-identity";
import { getUserByEmail, getUserByPhoneLast10 } from "@/lib/app-users";
import {
  CATEGORY_LABELS,
  isGender,
  isReportCategory,
  parseReporterAge,
  resolveCategory,
  type ReportAction,
  type ReportStatus,
  type VerificationStatus,
} from "@/types";

type WorkflowStatus = ReportStatus;

function jsonFromCaught(err: unknown, status = 503) {
  const message = err instanceof Error ? err.message : "Server configuration error";
  return NextResponse.json({ error: message }, { status });
}

function categoryLabel(category: string): string {
  const key = resolveCategory(category);
  return key ? CATEGORY_LABELS[key] : category.replace(/_/g, " ");
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
    const accountHash = await accountReporterHashFromSession();
    const { receipt_id, category, description, latitude, longitude, severity, photo_url } = body;
    const reporter_hash = accountHash || body.reporter_hash;
    if (!reporter_hash || !category || latitude == null || longitude == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!isReportCategory(category)) {
      return NextResponse.json({ error: "Unknown report category" }, { status: 400 });
    }

    // Optional demographics for the population report; invalid values are dropped rather than rejecting the report.
    const reporterAge = parseReporterAge(body.reporter_age);
    const reporterGender = isGender(body.reporter_gender) ? body.reporter_gender : null;

    // Inline data URLs can grow unbounded; cap the size so a misuse can't bloat the row.
    const cleanedPhotoUrl = typeof photo_url === "string" && photo_url.trim().length > 0
      ? (photo_url.length > 2_000_000 ? null : photo_url.trim())
      : null;

    if (await isBlocked(reporter_hash)) {
      return NextResponse.json(
        { error: "Your account has been blocked due to repeated spam. Please contact the barangay office." },
        { status: 403 },
      );
    }

    // Check if the user's logged-in account is suspended
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
      const session = await verifyAuthToken(token);
      if (session) {
        const user = session.username.includes("@")
          ? await getUserByEmail(session.username)
          : await getUserByPhoneLast10(session.username.replace(/\D/g, "").slice(-10));

        if (user?.suspended_until) {
          const suspendedUntil = new Date(user.suspended_until);
          if (suspendedUntil.getTime() > Date.now()) {
            return NextResponse.json({
              error: `Your account is suspended until ${suspendedUntil.toLocaleString()} due to community guidelines violation.`
            }, { status: 403 });
          }
        }
      }
    } catch (e) {
      // Ignore session errors and proceed with anonymous submit
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

    // Hugging Face Random Forest Classification (with local fallback)
    let aiCategory = classifyReport(description || "");
    let hfPrediction: Awaited<ReturnType<typeof predictWithHF>> = null;
    try {
      hfPrediction = await predictWithHF(description || "");
      if (hfPrediction?.category) {
        aiCategory = hfPrediction.category;
      }
    } catch (_hfErr) {
      // Local fallback already assigned
    }

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
        ai_category: aiCategory,
        submitted_at: now,
        action_history: actionHistory,
        photo_url: cleanedPhotoUrl,
      })
      .select("id, created_at")
      .single();

    if (error || !data) {
      if (error?.message?.includes("reports_category_check")) {
        return NextResponse.json(
          { error: "This category isn't available yet. Please choose another category or try again later." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error?.message ?? "Failed to create report" }, { status: 500 });
    }

    // --- Hugging Face AI enrichment (urgency + department routing) ---
    if (hfPrediction && data.id) {
      try {
        const enrichment: Record<string, unknown> = {};
        if (hfPrediction.urgency)    enrichment.ai_urgency    = hfPrediction.urgency;
        if (hfPrediction.department) enrichment.ai_department = hfPrediction.department;
        if (Object.keys(enrichment).length > 0) {
          await getSupabaseAdmin()
            .from("reports")
            .update(enrichment)
            .eq("id", data.id);
        }
      } catch (_hfErr) {
        // Enrichment is best-effort; never block response
      }
    }

    // Demographics are optional; never fail the report because of them.
    if (reporterAge !== null || reporterGender !== null) {
      const { error: demographicsError } = await getSupabaseAdmin().from(INTAKE_DETAILS_TABLE).insert({
        report_id: data.id,
        source: "web",
        reporter_age: reporterAge,
        reporter_gender: reporterGender,
      });
      if (demographicsError) {
        console.warn("Could not save reporter demographics:", demographicsError.message);
      }
    }

    await addNotification({
      recipient_role: "admin",
      type: (severity ?? 1) >= 4 ? "high_priority" : "new_report",
      title: (severity ?? 1) >= 4 ? "High-Priority Report" : "New Report",
      message: `${categoryLabel(category)} - ${(description || "No description").slice(0, 60)}`,
      report_id: data.id,
    });
    await addNotification({
      recipient_role: "staff",
      type: (severity ?? 1) >= 4 ? "high_priority" : "new_report",
      title: (severity ?? 1) >= 4 ? "High-Priority Report" : "New Report",
      message: `${categoryLabel(category)} - ${(description || "No description").slice(0, 60)}`,
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
    const startDate = searchParams.get("start_date");
    const endDate = searchParams.get("end_date");

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
    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = data ?? [];
    const intake = await fetchIntakeSummaries(rows.map((report) => report.id as string));
    const reports = rows.map((report) => {
      const details = intake?.get(report.id);
      // This endpoint is public: reporter demographics and contact details stay out.
      return {
        ...report,
        action_history: Array.isArray(report.action_history) ? report.action_history : [],
        intake_source: details && details.source !== "web" ? details.source : null,
        intake_area: details?.area ?? null,
        location_known: details?.location_known ?? true,
      };
    });
    return NextResponse.json({ reports });
  } catch (err) {
    return jsonFromCaught(err);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { report_id, status, verification_status, admin_category, note, actor, photo_url } = body as {
      report_id?: string;
      status?: WorkflowStatus;
      verification_status?: VerificationStatus;
      admin_category?: string;
      note?: string;
      actor?: string;
      photo_url?: string;
    };
    if (!report_id) {
      return NextResponse.json({ error: "Missing report_id" }, { status: 400 });
    }

    // Inline data URLs can grow unbounded; cap the size so a misuse can't bloat the row.
    const cleanedPhotoUrl = typeof photo_url === "string" && photo_url.trim().length > 0
      ? (photo_url.length > 2_000_000 ? null : photo_url.trim())
      : null;

    const { data: rawReport, error: fetchError } = await getSupabaseAdmin()
      .from("reports")
      .select("*")
      .eq("id", report_id)
      .single();

    if (fetchError || !rawReport) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }
    const report = { ...rawReport, action_history: normalizeActionHistory(rawReport.action_history) };

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
        ...(cleanedPhotoUrl ? { photo_url: cleanedPhotoUrl } : {}),
      });
      await addNotification({
        recipient_hash: report.reporter_hash,
        recipient_role: "user",
        type: "status_update",
        title: "Report Status Updated",
        message: `Your ${categoryLabel(report.category)} report is now "${status.replace("_", " ")}".`,
        report_id: report.id,
      });
    }

    if (verification_status) {
      const validVerification: VerificationStatus[] = ["unreviewed", "valid", "spam", "duplicate"];
      if (!validVerification.includes(verification_status)) {
        return NextResponse.json({ error: "Invalid verification_status" }, { status: 400 });
      }
      updates.verification_status = verification_status;
      // Only set verified_by if it's a valid UUID, otherwise set to null
      if (actor && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(actor)) {
        updates.verified_by = actor;
      } else {
        updates.verified_by = null;
      }
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
