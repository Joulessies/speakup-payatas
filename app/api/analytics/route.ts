import { NextResponse } from "next/server";
import { fetchReportsBase } from "@/lib/server-db";
import { computeClusterUrgency, type UrgencyScore } from "@/lib/urgency";
import { detectAnomaly, type AnomalyResult } from "@/lib/anomaly";
import DBSCAN from "density-clustering";

interface TrendPoint {
    date: string;
    count: number;
    categories: Record<string, number>;
}

interface RankedCluster {
    latitude: number;
    longitude: number;
    count: number;
    category_breakdown: Record<string, number>;
    urgency: UrgencyScore;
    anomaly: AnomalyResult;
    reports: { severity: number; category: string; created_at: string }[];
}

const LAT_TO_M = 111320;
const LNG_TO_M = 111320 * Math.cos((14.7 * Math.PI) / 180);

function serverErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Analytics failed";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function POST() {
    try {
        const mockReports = await fetchReportsBase();
        const now = new Date();
        const trendDays = 14;
        const trendData: TrendPoint[] = [];
        for (let i = trendDays - 1; i >= 0; i--) {
            const d = new Date(now);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().slice(0, 10);
            const dayReports = mockReports.filter((r) => r.created_at.slice(0, 10) === dateStr);
            const categories: Record<string, number> = {};
            for (const r of dayReports) categories[r.category] = (categories[r.category] || 0) + 1;
            trendData.push({ date: dateStr, count: dayReports.length, categories });
        }
        const points = mockReports.map((r) => [r.latitude * LAT_TO_M, r.longitude * LNG_TO_M]);
        const dbscan = new DBSCAN.DBSCAN();
        const clusterIndices = dbscan.run(points, 50, 3);
        const rankedClusters: RankedCluster[] = [];
        for (const indices of clusterIndices) {
            const clusterReports = indices.map((i: number) => mockReports[i]);
            let sumLat = 0, sumLng = 0;
            const categoryBreakdown: Record<string, number> = {};
            for (const r of clusterReports) {
                sumLat += r.latitude;
                sumLng += r.longitude;
                categoryBreakdown[r.category] = (categoryBreakdown[r.category] || 0) + 1;
            }
            rankedClusters.push({
                latitude: sumLat / clusterReports.length,
                longitude: sumLng / clusterReports.length,
                count: clusterReports.length,
                category_breakdown: categoryBreakdown,
                urgency: computeClusterUrgency(clusterReports),
                anomaly: detectAnomaly(clusterReports),
                reports: clusterReports.map((r) => ({ severity: r.severity, category: r.category, created_at: r.created_at })),
            });
        }
        rankedClusters.sort((a, b) => b.urgency.score - a.urgency.score);
        const categoryDistribution: Record<string, number> = {};
        for (const r of mockReports) categoryDistribution[r.category] = (categoryDistribution[r.category] || 0) + 1;
        return NextResponse.json({
            trend_data: trendData,
            ranked_clusters: rankedClusters,
            category_distribution: categoryDistribution,
            anomaly_count: rankedClusters.filter((c) => c.anomaly.isAnomaly).length,
            total_reports: mockReports.length,
        });
    } catch (err) {
        return serverErrorResponse(err);
    }
}
