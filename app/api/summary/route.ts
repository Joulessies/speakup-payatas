import { NextResponse } from "next/server";
import { fetchReportsBase } from "@/lib/server-db";
import DBSCAN from "density-clustering";

const LAT_TO_M = 111320;
const LNG_TO_M = 111320 * Math.cos((14.7 * Math.PI) / 180);

function serverErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Summary failed";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET() {
    try {
        const mockReports = await fetchReportsBase();
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthReports = mockReports.filter((r) => new Date(r.created_at) >= monthStart);
        const resolvedReports = monthReports.filter((r) => r.status === "resolved");
        const spamReports = monthReports.filter((r) => r.verification_status === "spam");
        const validReports = monthReports.filter((r) => r.verification_status === "valid");

        const catCounts: Record<string, number> = {};
        for (const r of monthReports) catCounts[r.category] = (catCounts[r.category] || 0) + 1;
        const topCategories = Object.entries(catCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([category, count]) => ({ category, count }));

        const points = monthReports.map((r) => [r.latitude * LAT_TO_M, r.longitude * LNG_TO_M]);
        const dbscan = new DBSCAN.DBSCAN();
        const clusterIndices = points.length >= 3 ? dbscan.run(points, 50, 2) : [];
        const areas = clusterIndices.map((indices: number[]) => {
            const reports = indices.map((i: number) => monthReports[i]);
            const lat = reports.reduce((s, r) => s + r.latitude, 0) / reports.length;
            const lng = reports.reduce((s, r) => s + r.longitude, 0) / reports.length;
            const cats: Record<string, number> = {};
            for (const r of reports) cats[r.category] = (cats[r.category] || 0) + 1;
            const topCat = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || "mixed";
            return { latitude: lat, longitude: lng, count: reports.length, top_category: topCat };
        }).sort((a: { count: number }, b: { count: number }) => b.count - a.count).slice(0, 5);

        let totalHours = 0;
        let countResolved = 0;
        for (const r of resolvedReports) {
            const resolvedAction = r.action_history.find((a) => a.status === "resolved");
            if (resolvedAction) {
                const hrs = (new Date(resolvedAction.created_at).getTime() - new Date(r.created_at).getTime()) / 3600000;
                totalHours += hrs;
                countResolved++;
            }
        }

        return NextResponse.json({
            month: monthStr,
            total_reports: monthReports.length,
            resolved_count: resolvedReports.length,
            resolution_rate: monthReports.length > 0 ? Math.round((resolvedReports.length / monthReports.length) * 100) : 0,
            top_categories: topCategories,
            most_affected_areas: areas,
            avg_resolution_hours: countResolved > 0 ? Math.round(totalHours / countResolved) : 0,
            spam_count: spamReports.length,
            valid_count: validReports.length,
        });
    } catch (err) {
        return serverErrorResponse(err);
    }
}
