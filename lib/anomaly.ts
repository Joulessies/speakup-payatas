const SPIKE_WINDOW_HOURS = 24;
const SPIKE_THRESHOLD = 5;
const SPIKE_MULTIPLIER = 2.0;
export interface AnomalyResult {
    isAnomaly: boolean;
    recentCount: number;
    averageDailyRate: number;
    spikeRatio: number;
    reason: string | null;
}
export function detectAnomaly(reports: {
    created_at: string;
}[]): AnomalyResult {
    if (reports.length === 0) {
        return {
            isAnomaly: false,
            recentCount: 0,
            averageDailyRate: 0,
            spikeRatio: 0,
            reason: null,
        };
    }
    const now = Date.now();
    const windowMs = SPIKE_WINDOW_HOURS * 60 * 60 * 1000;
    const recentCount = reports.filter((r) => now - new Date(r.created_at).getTime() < windowMs).length;
    const timestamps = reports.map((r) => new Date(r.created_at).getTime());
    const oldest = Math.min(...timestamps);
    const spanDays = Math.max(1, (now - oldest) / (1000 * 60 * 60 * 24));
    const averageDailyRate = reports.length / spanDays;
    const spikeRatio = averageDailyRate > 0 ? recentCount / averageDailyRate : recentCount;
    let isAnomaly = false;
    let reason: string | null = null;
    if (recentCount >= SPIKE_THRESHOLD) {
        isAnomaly = true;
        reason = `${recentCount} reports in the last ${SPIKE_WINDOW_HOURS}h (threshold: ${SPIKE_THRESHOLD})`;
    }
    else if (averageDailyRate > 0 && spikeRatio >= SPIKE_MULTIPLIER) {
        isAnomaly = true;
        reason = `${spikeRatio.toFixed(1)}× above average daily rate of ${averageDailyRate.toFixed(1)}`;
    }
    return {
        isAnomaly,
        recentCount,
        averageDailyRate: Math.round(averageDailyRate * 100) / 100,
        spikeRatio: Math.round(spikeRatio * 100) / 100,
        reason,
    };
}
