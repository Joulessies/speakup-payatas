/**
 * Urgency Auto-Scoring Algorithm
 *
 * Formula: urgency = severity_factor × density_factor × recency_factor
 *
 * - severity_factor:  severity / 5                     → 0.2 to 1.0
 * - density_factor:   min(cluster_report_count / 3, 3) → 0.33 to 3.0
 * - recency_factor:   e^(-λt)  where λ = ln(2)/72h    → 1.0 (now) to ~0 (old)
 *
 * Result is normalized to 0–100.
 */

const HALF_LIFE_HOURS = 72; // score halves every 72 hours
const DECAY = Math.LN2 / HALF_LIFE_HOURS;

export interface UrgencyScore {
  score: number; // 0–100
  label: "critical" | "high" | "medium" | "low";
  factors: {
    severity: number;
    density: number;
    recency: number;
  };
}

export function computeUrgencyScore(
  severity: number,
  clusterReportCount: number,
  createdAt: string | Date,
): UrgencyScore {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  const hoursSince = Math.max(0, (now - created) / (1000 * 60 * 60));

  const severityFactor = severity / 5;
  const densityFactor = Math.min(clusterReportCount / 3, 3.0);
  const recencyFactor = Math.exp(-DECAY * hoursSince);

  // Raw score: max possible = 1.0 × 3.0 × 1.0 = 3.0
  const raw = severityFactor * densityFactor * recencyFactor;
  const score = Math.round(Math.min((raw / 3.0) * 100, 100));

  let label: UrgencyScore["label"];
  if (score >= 75) label = "critical";
  else if (score >= 50) label = "high";
  else if (score >= 25) label = "medium";
  else label = "low";

  return {
    score,
    label,
    factors: {
      severity: Math.round(severityFactor * 100) / 100,
      density: Math.round(densityFactor * 100) / 100,
      recency: Math.round(recencyFactor * 100) / 100,
    },
  };
}

/**
 * Compute a composite urgency score for an entire cluster.
 * Uses the highest individual urgency, boosted by density.
 */
export function computeClusterUrgency(
  reports: { severity: number; created_at: string }[],
): UrgencyScore {
  if (reports.length === 0) {
    return { score: 0, label: "low", factors: { severity: 0, density: 0, recency: 0 } };
  }

  // Find the most urgent report in the cluster
  let best: UrgencyScore = { score: 0, label: "low", factors: { severity: 0, density: 0, recency: 0 } };
  for (const r of reports) {
    const s = computeUrgencyScore(r.severity, reports.length, r.created_at);
    if (s.score > best.score) best = s;
  }

  return best;
}
