import { NextResponse } from "next/server";
import { fetchIntakeSummaries, fetchReportsBase, type IntakeSummaryRow } from "@/lib/server-db";
import { getSessionFromCookies, isStaffOrAdminRole } from "@/lib/api-session";
import { computeClusterUrgency, type UrgencyScore } from "@/lib/urgency";
import { detectAnomaly, type AnomalyResult } from "@/lib/anomaly";
import {
    AGE_GROUPS,
    BARANGAY_AREAS,
    INTAKE_SOURCES,
    getAgeGroup,
    type AgeGroupKey,
    type GenderBucket,
    type PopulationReport,
} from "@/types";
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

function emptyGenderCounts(): Record<GenderBucket, number> {
    return { male: 0, female: 0, other: 0, not_specified: 0 };
}

/** Counts are per report; reports without age/gender are counted as "not specified", never estimated. */
function buildPopulationReport(reportIds: string[], intake: Map<string, IntakeSummaryRow>): PopulationReport {
    const gender = emptyGenderCounts();
    const ageByGender = Object.fromEntries(
        [...AGE_GROUPS.map((group) => group.key), "not_specified"].map((key) => [key, emptyGenderCounts()]),
    ) as PopulationReport["age_by_gender"];
    const sources = Object.fromEntries(INTAKE_SOURCES.map((source) => [source, 0])) as PopulationReport["sources"];
    const areas = Object.fromEntries(
        [...BARANGAY_AREAS, "not_specified"].map((area) => [area, 0]),
    ) as PopulationReport["areas"];

    let withAge = 0;
    let withGender = 0;
    let ageSum = 0;
    for (const id of reportIds) {
        const row = intake.get(id);
        const reporterGender = row?.reporter_gender;
        const genderBucket: GenderBucket =
            reporterGender === "male" || reporterGender === "female" || reporterGender === "other"
                ? reporterGender
                : "not_specified";
        gender[genderBucket] += 1;
        if (genderBucket !== "not_specified") withGender += 1;

        const age = row?.reporter_age ?? null;
        const ageGroup: AgeGroupKey | "not_specified" = age === null ? "not_specified" : getAgeGroup(age);
        ageByGender[ageGroup][genderBucket] += 1;
        if (age !== null) {
            withAge += 1;
            ageSum += age;
        }

        const source = row?.source ?? "web";
        if (source in sources) sources[source] += 1;
        const area = row?.area ?? "not_specified";
        if (area in areas) areas[area] += 1;
    }

    return {
        total_reports: reportIds.length,
        with_age: withAge,
        with_gender: withGender,
        average_age: withAge > 0 ? Math.round((ageSum / withAge) * 10) / 10 : null,
        gender,
        age_by_gender: ageByGender,
        sources,
        areas,
    };
}

export async function POST() {
    try {
        const [mockReports, intake, session] = await Promise.all([
            fetchReportsBase(),
            fetchIntakeSummaries(),
            getSessionFromCookies(),
        ]);
        // Reports encoded without a map pin sit on a placeholder point; keep them out of hotspots.
        const locatedReports = intake
            ? mockReports.filter((r) => intake.get(r.id)?.location_known !== false)
            : mockReports;
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
        const points = locatedReports.map((r) => [r.latitude * LAT_TO_M, r.longitude * LNG_TO_M]);
        const dbscan = new DBSCAN.DBSCAN();
        const clusterIndices = dbscan.run(points, 50, 3);
        const rankedClusters: RankedCluster[] = [];
        for (const indices of clusterIndices) {
            const clusterReports = indices.map((i: number) => locatedReports[i]);
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
                urgency: computeClusterUrgency(clusterReports.map((r) => ({ severity: r.severity ?? 1, created_at: r.created_at }))),
                anomaly: detectAnomaly(clusterReports),
                reports: clusterReports.map((r) => ({ severity: r.severity ?? 1, category: r.category, created_at: r.created_at })),
            });
        }
        rankedClusters.sort((a, b) => b.urgency.score - a.urgency.score);
        const categoryDistribution: Record<string, number> = {};
        for (const r of mockReports) categoryDistribution[r.category] = (categoryDistribution[r.category] || 0) + 1;
        // Demographics are only for barangay staff/admins; null means the intake table isn't readable yet.
        const population = isStaffOrAdminRole(session?.role)
            ? { population: intake ? buildPopulationReport(mockReports.map((r) => r.id), intake) : null }
            : {};
        return NextResponse.json({
            trend_data: trendData,
            ranked_clusters: rankedClusters,
            category_distribution: categoryDistribution,
            anomaly_count: rankedClusters.filter((c) => c.anomaly.isAnomaly).length,
            total_reports: mockReports.length,
            ...population,
        });
    } catch (err) {
        return serverErrorResponse(err);
    }
}
