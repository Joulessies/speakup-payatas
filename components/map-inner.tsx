"use client";

import { useEffect, useState } from "react";
import { Circle, GoogleMap, InfoWindow, Polygon } from "@react-google-maps/api";
import { PAYATAS_CENTER } from "@/lib/payatas-boundary";
import {
    clusterFillColor,
    clusterRadiusMeters,
    getGoogleMapsApiKey,
    googleMapPublicPageOptions,
    payatasBoundaryPath,
} from "@/lib/payatas-google-maps";
import { usePayatasGoogleMapsLoader } from "@/hooks/use-payatas-google-maps-loader";
import type { ClusterResult } from "@/types";
import { useTheme } from "./theme-provider";
import MapsMissingKey from "./maps-missing-key";

function MapInnerLoaded() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const { isLoaded, loadError } = usePayatasGoogleMapsLoader();
    const [clusters, setClusters] = useState<ClusterResult[]>([]);
    const [totalReports, setTotalReports] = useState(0);
    const [noiseCount, setNoiseCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [popupIndex, setPopupIndex] = useState<number | null>(null);
    const boundaryPath = payatasBoundaryPath();
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
    if (loadError) {
        return (<div className="flex h-full w-full items-center justify-center bg-muted/40">
          <p className="text-sm text-destructive">Could not load Google Maps.</p>
        </div>);
    }
    if (!isLoaded) {
        return <div className="h-full w-full bg-muted/30 animate-pulse"/>;
    }
    return (<div className="relative h-full w-full">
      
      <div className="absolute top-4 left-4 z-[1] rounded-xl border border-white/10 bg-black/80 px-4 py-3 text-sm text-white backdrop-blur-sm space-y-1">
        <p className="text-base font-semibold tracking-tight">SpeakUp Payatas</p>
        {loading ? (<p className="text-white/60">Loading clusters…</p>) : (<>
            <p>
              <span className="text-white/60">Reports:</span> {totalReports}
            </p>
            <p>
              <span className="text-white/60">Hotspots:</span> {clusters.length}
            </p>
            <p>
              <span className="text-white/60">Scattered:</span> {noiseCount}
            </p>
          </>)}
      </div>

      
      <div className="absolute bottom-6 left-4 z-[1] rounded-xl border border-white/10 bg-black/80 px-4 py-3 text-xs text-white backdrop-blur-sm space-y-1.5">
        <p className="text-sm font-medium">Density</p>
        {[
            { color: "#22c55e", label: "Low (< 5)" },
            { color: "#eab308", label: "Medium (5-9)" },
            { color: "#f97316", label: "High (10-14)" },
            { color: "#ef4444", label: "Critical (15+)" },
        ].map((item) => (<div key={item.color} className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: item.color }}/>
            {item.label}
          </div>))}
      </div>

      <GoogleMap mapContainerClassName="h-full w-full" center={PAYATAS_CENTER} zoom={15} options={googleMapPublicPageOptions(isDark)} onClick={() => setPopupIndex(null)}>
        <Polygon paths={boundaryPath} options={{
                strokeColor: "#6366f1",
                strokeWeight: 0,
                strokeOpacity: 0,
                fillColor: "#6366f1",
                fillOpacity: 0.05,
            }}/>

        {clusters.map((cluster, i) => {
            const fill = clusterFillColor(cluster.count);
            const radius = clusterRadiusMeters(cluster.count);
            return (<Circle key={i} center={{ lat: cluster.latitude, lng: cluster.longitude }} radius={radius} options={{
                    fillColor: fill,
                    fillOpacity: 0.7,
                    strokeOpacity: 0,
                    strokeWeight: 0,
                }} onClick={() => setPopupIndex(i)}/>);
        })}

        {popupIndex !== null && clusters[popupIndex] && (<InfoWindow position={{
                lat: clusters[popupIndex].latitude,
                lng: clusters[popupIndex].longitude,
            }} onCloseClick={() => setPopupIndex(null)}>
            <div className="min-w-[140px] space-y-1 text-sm">
              <p className="font-semibold">
                {clusters[popupIndex].count} report{clusters[popupIndex].count !== 1 ? "s" : ""}
              </p>
              {Object.entries(clusters[popupIndex].category_breakdown).map(([cat, count]) => (<p key={cat} className="text-xs text-gray-600">
                    {cat}: {count}
                  </p>))}
              <p className="font-mono text-xs text-gray-400">
                {clusters[popupIndex].latitude.toFixed(5)},{" "}
                {clusters[popupIndex].longitude.toFixed(5)}
              </p>
            </div>
          </InfoWindow>)}
      </GoogleMap>
    </div>);
}

export default function MapInner() {
    if (!getGoogleMapsApiKey()) {
        return <MapsMissingKey/>;
    }
    return <MapInnerLoaded/>;
}
