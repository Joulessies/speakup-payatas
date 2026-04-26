import { NextResponse } from "next/server";
import { DBSCAN } from "density-clustering";
import { mockReports, seedIfNeeded } from "../reports/route";

// Reference point for local meter projection (Payatas center)
const REF_LAT = 14.7055;
const REF_LNG = 121.099;
const DEG_TO_M_LAT = 111_320;
const DEG_TO_M_LNG = Math.cos((REF_LAT * Math.PI) / 180) * 111_320;

function toMeters(lat: number, lng: number): [number, number] {
  return [(lng - REF_LNG) * DEG_TO_M_LNG, (lat - REF_LAT) * DEG_TO_M_LAT];
}

export async function POST() {
  try {
    seedIfNeeded();

    const reports = mockReports;

    if (reports.length === 0) {
      return NextResponse.json({ clusters: [], total_reports: 0, noise_count: 0 });
    }

    // Convert to local meter-based coordinates for DBSCAN
    const dataset = reports.map((r) => toMeters(r.latitude, r.longitude));

    // DBSCAN: epsilon = 50 meters, minPoints = 3
    const dbscan = new DBSCAN();
    const clusterIndices = dbscan.run(dataset, 50, 3);

    // Compute cluster centers and metadata
    const clusters = clusterIndices.map((indices) => {
      let sumLat = 0;
      let sumLng = 0;
      const categoryBreakdown: Record<string, number> = {};

      for (const idx of indices) {
        const report = reports[idx];
        sumLat += report.latitude;
        sumLng += report.longitude;
        categoryBreakdown[report.category] =
          (categoryBreakdown[report.category] || 0) + 1;
      }

      return {
        latitude: sumLat / indices.length,
        longitude: sumLng / indices.length,
        count: indices.length,
        category_breakdown: categoryBreakdown,
      };
    });

    // Sort by density (most reports first)
    clusters.sort((a, b) => b.count - a.count);

    return NextResponse.json({
      clusters,
      total_reports: reports.length,
      noise_count: dbscan.noise.length,
    });
  } catch (err) {
    console.error("Cluster error:", err);
    return NextResponse.json({ error: "Clustering failed" }, { status: 500 });
  }
}
