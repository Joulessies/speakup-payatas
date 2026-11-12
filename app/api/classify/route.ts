import { NextResponse } from "next/server";
import { predictWithHF } from "@/lib/huggingface";
import { classifyReportWithConfidence } from "@/lib/classification";

/**
 * POST /api/classify
 *
 * Accepts `{ description, area? }` and returns the full AI prediction
 * (category, urgency, department, confidence) from the Hugging Face Space.
 *
 * Falls back to the local Random-Forest / keyword classifier when the
 * HF Space is unreachable or returns an error.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { description, area } = body as { description?: string; area?: string };

    if (!description || typeof description !== "string" || description.trim().length === 0) {
      return NextResponse.json({ error: "Missing or empty 'description'" }, { status: 400 });
    }

    // Try the HF Space first
    const hf = await predictWithHF(description.trim(), area);

    if (hf) {
      return NextResponse.json({
        category: hf.category,
        urgency: hf.urgency,
        department: hf.department,
        confidence: hf.confidence,
        all_probabilities: hf.all_probabilities,
        source: hf.source || "huggingface",
      });
    }

    // Fallback: local classifier
    const local = classifyReportWithConfidence(description.trim());
    return NextResponse.json({
      category: local.category,
      urgency: null,
      department: null,
      confidence: local.confidence,
      all_probabilities: null,
      source: local.model_type,
    });
  } catch (err) {
    if (err instanceof SyntaxError || (err instanceof Error && err.message.includes("JSON"))) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
