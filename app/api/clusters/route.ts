import { NextResponse } from "next/server";
import { DBSCAN } from "density-clustering";
import { fetchReportsBase } from "@/lib/server-db";
const REF_LAT = 14.7055;
const REF_LNG = 121.099;
const DEG_TO_M_LAT = 111320;
const DEG_TO_M_LNG = Math.cos((REF_LAT * Math.PI) / 180) * 111320;
function toMeters(lat: number, lng: number): [
    number,
    number
] {
    return [(lng - REF_LNG) * DEG_TO_M_LNG, (lat - REF_LAT) * DEG_TO_M_LAT];
}
type WindowKey = "24h" | "7d" | "30d";
type ReportSummary = {
    id: string;
    receipt_id?: string;
    category: string;
    severity: number;
    created_at: string;
    latitude: number;
    longitude: number;
    status: string;
    description: string;
};
function getWindowMs(window: WindowKey): number {
    if (window === "24h")
        return 24 * 60 * 60 * 1000;
    if (window === "7d")
        return 7 * 24 * 60 * 60 * 1000;
    return 30 * 24 * 60 * 60 * 1000;
}
function getBucketMs(window: WindowKey): number {
    if (window === "24h")
        return 2 * 60 * 60 * 1000;
    if (window === "7d")
        return 12 * 60 * 60 * 1000;
    return 24 * 60 * 60 * 1000;
}
function clusterReports(reports: ReportSummary[]) {
    if (reports.length === 0) {
        return { clusters: [], noise_count: 0 };
    }
    const dataset = reports.map((r) => toMeters(r.latitude, r.longitude));
    const dbscan = new DBSCAN();
    const clusterIndices = dbscan.run(dataset, 50, 3);
    const clusters = clusterIndices.map((indices) => {
        let sumLat = 0;
        let sumLng = 0;
        let weightedScore = 0;
        const categoryBreakdown: Record<string, number> = {};
        const clusterReports = indices.map((idx) => reports[idx]);
        for (const report of clusterReports) {
            sumLat += report.latitude;
            sumLng += report.longitude;
            weightedScore += Math.max(1, report.severity ?? 1);
            categoryBreakdown[report.category] =
                (categoryBreakdown[report.category] || 0) + 1;
        }
        clusterReports.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        return {
            latitude: sumLat / indices.length,
            longitude: sumLng / indices.length,
            count: indices.length,
            weighted_score: weightedScore,
            category_breakdown: categoryBreakdown,
            reports: clusterReports,
        };
    });
    clusters.sort((a, b) => b.weighted_score - a.weighted_score);
    return {
        clusters,
        noise_count: dbscan.noise.length,
    };
}
export async function POST(request: Request) {
    try {
        const mockReports = await fetchReportsBase();
        let body: {
            window?: WindowKey;
            includePlayback?: boolean;
        } = {};
        try {
            body = await request.json();
        }
        catch {
        }
        const selectedWindow: WindowKey = body.window === "24h" || body.window === "30d" ? body.window : "7d";
        const now = Date.now();
        const windowMs = getWindowMs(selectedWindow);
        const since = new Date(now - windowMs).toISOString();
        const reports = mockReports
            .filter((r) => r.created_at >= since)
            .map((r) => ({
            id: r.id,
            receipt_id: r.receipt_id,
            category: r.category,
            severity: r.severity ?? 1,
            created_at: r.created_at,
            latitude: r.latitude,
            longitude: r.longitude,
            status: r.status,
            description: r.description ?? "",
        }));
        if (reports.length === 0) {
            return NextResponse.json({
                clusters: [],
                total_reports: 0,
                noise_count: 0,
                heat_points: [],
                playback_frames: [],
            });
        }
        const { clusters, noise_count } = clusterReports(reports);
        const heat_points = reports.map((r) => [r.latitude, r.longitude, Math.max(1, r.severity)] as [
            number,
            number,
            number
        ]);
        let playback_frames: {
            key: string;
            label: string;
            clusters: ReturnType<typeof clusterReports>["clusters"];
            total_reports: number;
            noise_count: number;
            heat_points: [
                number,
                number,
                number
            ][];
        }[] = [];
        if (body.includePlayback) {
            const bucketMs = getBucketMs(selectedWindow);
            const frameCount = Math.max(1, Math.ceil(windowMs / bucketMs));
            playback_frames = Array.from({ length: frameCount }, (_, index) => {
                const frameStart = now - windowMs + index * bucketMs;
                const frameEnd = Math.min(now, frameStart + bucketMs);
                const frameReports = reports.filter((r) => {
                    const ts = new Date(r.created_at).getTime();
                    return ts >= frameStart && ts <= frameEnd;
                });
                const clustered = clusterReports(frameReports);
                const label = new Date(frameEnd).toLocaleString("en-PH", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                });
                return {
                    key: `${frameStart}-${frameEnd}`,
                    label,
                    clusters: clustered.clusters,
                    total_reports: frameReports.length,
                    noise_count: clustered.noise_count,
                    heat_points: frameReports.map((r) => [r.latitude, r.longitude, Math.max(1, r.severity)] as [
                        number,
                        number,
                        number
                    ]),
                };
            });
        }
        return NextResponse.json({
            clusters,
            total_reports: reports.length,
            noise_count,
            heat_points,
            playback_frames,
        });
    }
    catch (err) {
        console.error("Cluster error:", err);
        return NextResponse.json({ error: "Clustering failed" }, { status: 500 });
    }
}
