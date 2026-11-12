// =============================================================================
// Hugging Face Inference API Client — Server-side only
// =============================================================================
// Supports:
// 1. Hugging Face Serverless Inference API (Free, zero servers needed):
//    Add to .env.local:
//      HF_TOKEN="hf_your_hugging_face_token_here"
//      (Optional) HF_MODEL_ID="facebook/bart-large-mnli"
//
// 2. Hugging Face Spaces (Custom deployed container):
//    Add to .env.local:
//      HF_SPACE_URL="https://your-space.hf.space"
//
// 3. Fallback:
//    If tokens or network fail, automatically falls back to local Random Forest.
// =============================================================================

import { classifyReport } from "@/lib/classification";
import type { ReportCategory } from "@/types";

const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY || process.env.HF_API_KEY || "";
const HF_MODEL_ID = process.env.HF_MODEL_ID || "facebook/bart-large-mnli";
const HF_SPACE_URL = process.env.HF_SPACE_URL || process.env.NEXT_PUBLIC_HF_SPACE_URL || "https://joulessies-speakup-payatas-classifier.hf.space";

/** Timeout in ms for HF requests. Kept lean so stress bursts never freeze server. */
const HF_TIMEOUT_MS = 1_500;

/** Circuit breakers to prevent socket exhaustion during heavy traffic. */
let spaceDownUntil = 0;
let inferenceDownUntil = 0;

/** Candidate labels mapped to official SpeakUp Payatas categories. */
export const CANDIDATE_LABELS_MAP: { label: string; key: ReportCategory }[] = [
  { label: "drainage, flooding, clogged canal, or overflow", key: "drainage_flooding" },
  { label: "fire hazard, smoke, explosion, or disaster alert", key: "fire_hazard" },
  { label: "crime, physical violence, weapon, or public safety", key: "safety_concern" },
  { label: "threats, harassment, bullying, or stalking", key: "threats_harassment" },
  { label: "medical emergency, illness, injury, or ambulance", key: "medical_health" },
  { label: "traffic congestion, illegal parking, or road obstruction", key: "road_traffic" },
  { label: "vehicular accident, collision, or hit and run", key: "road_accidents" },
  { label: "loud noise, late night karaoke, or disturbance", key: "noise_nuisance" },
  { label: "electrical wire, sparking post, or blackout", key: "electrical_concerns" },
  { label: "stray, rabid, aggressive, or biting animal", key: "animal_concerns" },
  { label: "domestic abuse, family conflict, or child violence", key: "family_domestic" },
  { label: "illegal drugs, pusher, or substance abuse", key: "substance_concerns" },
  { label: "social welfare, financial aid, or senior assistance", key: "social_welfare" },
  { label: "legal mediation, hearing, or barangay lupon dispute", key: "legal_mediation" },
  { label: "infrastructure, pothole, damaged bridge, or public works", key: "infrastructure" },
  { label: "barangay clearance, certificate, or permit", key: "clearance_concerns" },
  { label: "service assistance, borrowing tents, chairs, or tables", key: "service_assistance" },
  { label: "environmental pollution, chemical spill, or tree cutting", key: "environmental" },
  { label: "uncollected garbage, trash, or waste pile", key: "garbage_concerns" },
  { label: "sanitation, sewage, foul odor, or dirty water", key: "sanitation_health" },
  { label: "general inquiry or office schedule question", key: "inquiries" },
  { label: "other general concern", key: "other" },
];

/** Category to primary responding department. */
export const CATEGORY_DEPT_MAP: Record<ReportCategory, string> = {
  safety_concern: "Police Station 13",
  threats_harassment: "Police Station 13",
  fire_hazard: "BDRRM Office",
  medical_health: "BHERT",
  road_traffic: "Traffic Base",
  road_accidents: "Traffic Base",
  noise_nuisance: "CRO Office",
  electrical_concerns: "Meralco",
  animal_concerns: "BHERT",
  family_domestic: "ASH / VAW",
  substance_concerns: "BADAC",
  social_welfare: "Secretary",
  legal_mediation: "Lupon Tagapamayapa",
  infrastructure: "Secretary",
  drainage_flooding: "BDRRM Office",
  clearance_concerns: "Clearance Department",
  service_assistance: "Secretary",
  environmental: "Environmental Protection",
  garbage_concerns: "Environmental Protection",
  sanitation_health: "BHERT",
  inquiries: "Secretary",
  other: "Secretary",
};

/** Area to local base patrol. */
export const AREA_BASE_MAP: Record<string, string> = {
  "AREA A": "Alpha Base",
  "AREA B": "Bravo Base",
  "LUPANG PANGAKO": "LP Base",
  "GROUP 13": "Group 13 Base",
};

/** Category to baseline urgency. */
export const CATEGORY_URGENCY_MAP: Record<ReportCategory, "LOW" | "MEDIUM" | "HIGH"> = {
  safety_concern: "HIGH",
  threats_harassment: "HIGH",
  fire_hazard: "HIGH",
  medical_health: "HIGH",
  road_accidents: "HIGH",
  family_domestic: "HIGH",
  substance_concerns: "HIGH",
  drainage_flooding: "MEDIUM",
  electrical_concerns: "MEDIUM",
  road_traffic: "MEDIUM",
  animal_concerns: "MEDIUM",
  sanitation_health: "MEDIUM",
  environmental: "MEDIUM",
  social_welfare: "MEDIUM",
  legal_mediation: "MEDIUM",
  garbage_concerns: "LOW",
  noise_nuisance: "LOW",
  infrastructure: "LOW",
  clearance_concerns: "LOW",
  service_assistance: "LOW",
  inquiries: "LOW",
  other: "LOW",
};

/** Shape returned by the Hugging Face prediction. */
export interface HFPrediction {
  category: ReportCategory;
  urgency: string;
  department: string;
  confidence: number;
  all_probabilities: Record<string, number>;
  source: string;
}

/**
 * Call Hugging Face Serverless Inference API (Zero-Shot Classification).
 */
async function callInferenceApi(
  description: string,
  area: string,
  signal: AbortSignal,
): Promise<HFPrediction | null> {
  if (Date.now() < inferenceDownUntil) {
    return null;
  }

  const url = `https://router.huggingface.co/hf-inference/models/${HF_MODEL_ID}`;
  const candidateLabels = CANDIDATE_LABELS_MAP.map((c) => c.label);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${HF_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: description,
        parameters: { candidate_labels: candidateLabels },
      }),
      signal,
    });

    if (!res.ok) {
      inferenceDownUntil = Date.now() + 30_000;
      return null;
    }

    const data = (await res.json()) as {
      labels: string[];
      scores: number[];
    };

    if (!data.labels || !data.scores || data.labels.length === 0) {
      return null;
    }

    // Top category
    const topLabel = data.labels[0];
    const matched = CANDIDATE_LABELS_MAP.find((c) => c.label === topLabel);
    const categoryKey: ReportCategory = matched ? matched.key : "other";
    const confidence = Math.round((data.scores[0] || 0) * 1000) / 1000;

    // Build probability map
    const allProbs: Record<string, number> = {};
    for (let i = 0; i < data.labels.length; i++) {
      const item = CANDIDATE_LABELS_MAP.find((c) => c.label === data.labels[i]);
      if (item) {
        allProbs[item.key] = Math.round((data.scores[i] || 0) * 1000) / 1000;
      }
    }

    // Routing and Urgency
    let department = CATEGORY_DEPT_MAP[categoryKey] || "Secretary";
    const normalizedArea = area.trim().toUpperCase();
    if (
      normalizedArea &&
      AREA_BASE_MAP[normalizedArea] &&
      ["safety_concern", "threats_harassment", "noise_nuisance"].includes(categoryKey)
    ) {
      department = AREA_BASE_MAP[normalizedArea];
    }

    const urgency = CATEGORY_URGENCY_MAP[categoryKey] || "MEDIUM";

    return {
      category: categoryKey,
      urgency,
      department,
      confidence,
      all_probabilities: allProbs,
      source: `Hugging Face Inference API (${HF_MODEL_ID})`,
    };
  } catch {
    inferenceDownUntil = Date.now() + 30_000;
    return null;
  }
}

/**
 * Call Hugging Face Space FastAPI endpoint if configured.
 */
async function callSpaceApi(
  description: string,
  area: string,
  signal: AbortSignal,
): Promise<HFPrediction | null> {
  if (Date.now() < spaceDownUntil) {
    return null;
  }

  try {
    const res = await fetch(`${HF_SPACE_URL}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: description, area }),
      signal,
    });

    if (!res.ok) {
      spaceDownUntil = Date.now() + 30_000;
      return null;
    }

    const data = (await res.json()) as {
      category: string;
      urgency: string;
      department: string;
      confidence: number;
      all_probabilities: Record<string, number>;
    };

    return {
      category: data.category as ReportCategory,
      urgency: data.urgency,
      department: data.department,
      confidence: data.confidence,
      all_probabilities: data.all_probabilities,
      source: "Hugging Face Space (Random Forest)",
    };
  } catch {
    spaceDownUntil = Date.now() + 30_000;
    return null;
  }
}

/**
 * Main function: queries Hugging Face Inference API or HF Space.
 * Falls back to null on failure so callers can use local AI classifier.
 */
export async function predictWithHF(
  description: string,
  area?: string,
): Promise<HFPrediction | null> {
  if (!HF_TOKEN && !HF_SPACE_URL) {
    return null;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HF_TIMEOUT_MS);
  const targetArea = area ?? "";

  try {
    // 1. Primary: Hugging Face Space (Custom Random Forest Classifier)
    if (HF_SPACE_URL) {
      const result = await callSpaceApi(description, targetArea, controller.signal);
      if (result) return result;
    }

    // 2. Secondary: Hugging Face Serverless Inference API (if token provided)
    if (HF_TOKEN) {
      const result = await callInferenceApi(description, targetArea, controller.signal);
      if (result) return result;
    }

    return null;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.warn("[HF] Request timed out after", HF_TIMEOUT_MS, "ms");
    } else {
      console.warn("[HF] Request error:", err instanceof Error ? err.message : err);
    }
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Convenience classifier wrapper that tries Hugging Face first, then falls back to local model.
 */
export async function classifyViaHF(
  description: string,
  area?: string,
): Promise<{
  category: ReportCategory;
  confidence: number;
  urgency: string | null;
  department: string | null;
  source: string;
}> {
  const hf = await predictWithHF(description, area);

  if (hf && hf.category && hf.confidence > 0) {
    return {
      category: hf.category,
      confidence: hf.confidence,
      urgency: hf.urgency,
      department: hf.department,
      source: hf.source,
    };
  }

  // Fallback: local Random Forest
  const localCategory = classifyReport(description);
  return {
    category: localCategory,
    confidence: 0,
    urgency: null,
    department: null,
    source: "local Random Forest fallback",
  };
}
