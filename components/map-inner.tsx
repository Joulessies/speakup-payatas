"use client";
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, Polygon, } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { PAYATAS_CENTER, PAYATAS_BOUNDARY } from "@/lib/payatas-boundary";
import type { ClusterResult } from "@/types";
function getClusterColor(count: number): string {
    if (count >= 15)
        return "#ef4444";
    if (count >= 10)
        return "#f97316";
    if (count >= 5)
        return "#eab308";
    return "#22c55e";
}
function getClusterRadius(count: number): number {
    return Math.min(8 + count * 2.5, 40);
}
export default function MapInner() {
    const [clusters, setClusters] = useState<ClusterResult[]>([]);
    const [totalReports, setTotalReports] = useState(0);
    const [noiseCount, setNoiseCount] = useState(0);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/clusters", { method: "POST" });
                const data = await res.json();
                setClusters(data.clusters ?? []);
                setTotalReports(data.total_reports ?? 0);
                setNoiseCount(data.noise_count ?? 0);
            }
            catch (err) {
                console.error("Failed to fetch clusters:", err);
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    const boundaryLatLng = PAYATAS_BOUNDARY.map(([lng, lat]) => [lat, lng] as [
        number,
        number
    ]);
    return (<div className="relative w-full h-full">
      
      <div className="absolute top-4 left-4 z-[1000] bg-black/80 backdrop-blur-sm text-white rounded-xl px-4 py-3 space-y-1 text-sm border border-white/10">
        <p className="font-semibold text-base tracking-tight">
          SpeakUp Payatas
        </p>
        {loading ? (<p className="text-white/60">Loading clusters…</p>) : (<>
            <p>
              <span className="text-white/60">Reports:</span> {totalReports}
            </p>
            <p>
              <span className="text-white/60">Hotspots:</span>{" "}
              {clusters.length}
            </p>
            <p>
              <span className="text-white/60">Scattered:</span> {noiseCount}
            </p>
          </>)}
      </div>

      
      <div className="absolute bottom-6 left-4 z-[1000] bg-black/80 backdrop-blur-sm text-white rounded-xl px-4 py-3 space-y-1.5 text-xs border border-white/10">
        <p className="font-medium text-sm">Density</p>
        {[
            { color: "#22c55e", label: "Low (< 5)" },
            { color: "#eab308", label: "Medium (5-9)" },
            { color: "#f97316", label: "High (10-14)" },
            { color: "#ef4444", label: "Critical (15+)" },
        ].map((item) => (<div key={item.color} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}/>
            {item.label}
          </div>))}
      </div>

      <MapContainer center={[PAYATAS_CENTER.lat, PAYATAS_CENTER.lng]} zoom={15} className="w-full h-full" zoomControl={false}>
        <TileLayer attribution='&copy; <a href="https://carto.com/">CARTO</a>' url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"/>

        
        <Polygon positions={boundaryLatLng} pathOptions={{
            color: "#6366f1",
            weight: 2,
            fillColor: "#6366f1",
            fillOpacity: 0.05,
            dashArray: "6 4",
        }}/>

        
        {clusters.map((cluster, i) => (<CircleMarker key={i} center={[cluster.latitude, cluster.longitude]} radius={getClusterRadius(cluster.count)} pathOptions={{
                fillColor: getClusterColor(cluster.count),
                fillOpacity: 0.7,
                color: "#fff",
                weight: 1.5,
            }}>
            <Popup>
              <div className="text-sm space-y-1 min-w-[140px]">
                <p className="font-semibold">
                  {cluster.count} report{cluster.count !== 1 ? "s" : ""}
                </p>
                {Object.entries(cluster.category_breakdown).map(([cat, count]) => (<p key={cat} className="text-xs text-gray-600">
                      {cat}: {count}
                    </p>))}
                <p className="text-xs text-gray-400 font-mono">
                  {cluster.latitude.toFixed(5)}, {cluster.longitude.toFixed(5)}
                </p>
              </div>
            </Popup>
          </CircleMarker>))}
      </MapContainer>
    </div>);
}
