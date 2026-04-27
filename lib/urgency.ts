const HALF_LIFE_HOURS = 72;
const DECAY = Math.LN2 / HALF_LIFE_HOURS;
export interface UrgencyScore {
    score: number;
    label: "critical" | "high" | "medium" | "low";
    factors: {
        severity: number;
        density: number;
        recency: number;
    };
}
export function computeUrgencyScore(severity: number, clusterReportCount: number, createdAt: string | Date): UrgencyScore {
    const now = Date.now();
    const created = new Date(createdAt).getTime();
    const hoursSince = Math.max(0, (now - created) / (1000 * 60 * 60));
    const severityFactor = severity / 5;
    const densityFactor = Math.min(clusterReportCount / 3, 3.0);
    const recencyFactor = Math.exp(-DECAY * hoursSince);
    const raw = severityFactor * densityFactor * recencyFactor;
    const score = Math.round(Math.min((raw / 3.0) * 100, 100));
    let label: UrgencyScore["label"];
    if (score >= 75)
        label = "critical";
    else if (score >= 50)
        label = "high";
    else if (score >= 25)
        label = "medium";
    else
        label = "low";
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
export function computeClusterUrgency(reports: {
    severity: number;
    created_at: string;
}[]): UrgencyScore {
    if (reports.length === 0) {
        return { score: 0, label: "low", factors: { severity: 0, density: 0, recency: 0 } };
    }
    let best: UrgencyScore = { score: 0, label: "low", factors: { severity: 0, density: 0, recency: 0 } };
    for (const r of reports) {
        const s = computeUrgencyScore(r.severity, reports.length, r.created_at);
        if (s.score > best.score)
            best = s;
    }
    return best;
}
