import { NextResponse } from "next/server";
import { normalizeActionHistory, type DbReport } from "@/lib/server-db";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import DBSCAN from "density-clustering";

const LAT_TO_M = 111320;
const LNG_TO_M = 111320 * Math.cos((14.7 * Math.PI) / 180);

function serverErrorResponse(err: unknown) {
    const message = err instanceof Error ? err.message : "Summary failed";
    return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET() {
    try {
        const now = new Date();
        const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        
        const { data, error } = await getSupabaseAdmin()
            .from("reports")
            .select("*")
            .gte("created_at", monthStart.toISOString());
            
        if (error) throw new Error(error.message);
        
        const monthReports = ((data as DbReport[]) ?? []).map(r => ({
            ...r,
            action_history: normalizeActionHistory(r.action_history)
        }));
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

        const pendingCount = monthReports.filter((r) => r.status === "pending" || r.status === "in_progress").length;
        const unreviewedCount = monthReports.filter((r) => r.verification_status === "unreviewed").length;
        const scheduledCount = monthReports.filter((r) => r.status === "in_progress").length;

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

            // Barangay Management System Version 2 Database Metrics
            demographics: {
                total_households: 12854,
                total_population: 140500,
                male_count: 70120,
                female_count: 70380,
                senior_count: 12450,
                registered_voters: 84200,
                pwd_count: 3120,
            },
            cases_summary: {
                settled: resolvedReports.length,
                unsettled: pendingCount,
                unscheduled: unreviewedCount,
                scheduled: scheduledCount,
            },
            officials: [
                { id: "off-1", name: "Hon. Executive Punong Barangay", position: "Brgy. Captain", committee: "Presiding Officer & Executive Operations" },
                { id: "off-[#02]", name: "Hon. Brgy. Kagawad Peace & Order", position: "Brgy. Kagawad", committee: "Public Safety & Peace & Order" },
                { id: "off-[#03]", name: "Hon. Brgy. Kagawad Health & Sanitation", position: "Brgy. Kagawad", committee: "Health, Medical & Sanitation" },
                { id: "off-[#04]", name: "Hon. Brgy. Kagawad Infrastructure", position: "Brgy. Kagawad", committee: "Public Works & Infrastructure" },
                { id: "off-[#05]", name: "Brgy. Executive Secretary", position: "Executive Secretary", committee: "Administration & Records Management" },
                { id: "off-[#06]", name: "Brgy. Finance Treasurer", position: "Brgy. Treasurer", committee: "Budget & Appropriations" },
            ],
            announcement: {
                title: "Barangay Clean-Up & Assembly",
                what: "Barangay Clean-Up & Incident Response Assembly",
                when: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-25`,
                where: "Payatas Barangay Hall Complex",
            },
            age_group_breakdown: [
                { group: "Youth 0-17 Yrs", male: 18200, female: 17800, total: 36000 },
                { group: "Adult 18-35 Yrs", male: 26500, female: 25900, total: 52400 },
                { group: "Adult 36-59 Yrs", male: 19100, female: 20550, total: 39650 },
                { group: "Senior 60+ Yrs", male: 6320, female: 6130, total: 12450 },
            ],
        });
    } catch (err) {
        return serverErrorResponse(err);
    }
}
