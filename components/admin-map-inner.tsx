"use client";

import { useEffect, useMemo, useState } from "react";
import { Circle, GoogleMap, HeatmapLayer, InfoWindow, Polygon } from "@react-google-maps/api";
import { PAYATAS_CENTER } from "@/lib/payatas-boundary";
import {
    clusterFillColor,
    clusterRadiusMeters,
    getGoogleMapsApiKey,
    googleMapAdminOptions,
    payatasBoundaryPath,
} from "@/lib/payatas-google-maps";
import { usePayatasGoogleMapsLoader } from "@/hooks/use-payatas-google-maps-loader";
import { useGoogleMapsAuthState } from "@/hooks/use-google-maps-auth";
import { useTheme } from "./theme-provider";
import MapsMissingKey from "./maps-missing-key";
import type { ClusterResult } from "@/types";

interface AdminMapProps {
    clusters: (ClusterResult & { weighted_score?: number })[];
    selectedCluster: number | null;
    onClusterClick: (index: number | null) => void;
    showHeatmap?: boolean;
    heatPoints?: [number, number, number][];
    onMapBoundsChange?: (bounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    }) => void;
}

function AdminMapInnerLoaded({ clusters, selectedCluster, onClusterClick, showHeatmap = false, heatPoints, onMapBoundsChange, }: AdminMapProps) {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const { isLoaded, loadError } = usePayatasGoogleMapsLoader();
    const { failed: authFailed, errorCode } = useGoogleMapsAuthState();
    const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
    const boundaryPath = payatasBoundaryPath();
    const fallbackHeatPoints: [number, number, number][] = useMemo(() => clusters.map((c) => [
        c.latitude,
        c.longitude,
        Math.max(1, c.weighted_score ?? c.count),
    ]), [clusters]);
    const heatmapData = useMemo(() => {
        const pts = heatPoints && heatPoints.length > 0 ? heatPoints : fallbackHeatPoints;
        return pts.map(([lat, lng, weight]) => ({
            location: new google.maps.LatLng(lat, lng),
            weight,
        }));
    }, [heatPoints, fallbackHeatPoints]);
    useEffect(() => {
        if (!mapInstance || !onMapBoundsChange)
            return;
        const reportBounds = () => {
            const b = mapInstance.getBounds();
            if (!b)
                return;
            const ne = b.getNorthEast();
            const sw = b.getSouthWest();
            onMapBoundsChange({
                north: ne.lat(),
                south: sw.lat(),
                east: ne.lng(),
                west: sw.lng(),
            });
        };
        reportBounds();
        const idleListener = mapInstance.addListener("idle", reportBounds);
        return () => idleListener.remove();
    }, [mapInstance, onMapBoundsChange]);
    if (authFailed) {
        return <MapsMissingKey reason="auth-failed" errorCode={errorCode}/>;
    }
    if (loadError) {
        return <MapsMissingKey reason="load-error" errorCode={errorCode}/>;
    }
    if (!isLoaded) {
        return <div className="h-full w-full bg-muted/30 animate-pulse"/>;
    }
    const selected = selectedCluster !== null ? clusters[selectedCluster] : null;
    return (<GoogleMap mapContainerClassName="h-full w-full" center={PAYATAS_CENTER} zoom={15} options={googleMapAdminOptions(isDark)} onLoad={setMapInstance} onUnmount={() => setMapInstance(null)}>
      <Polygon paths={boundaryPath} options={{
            strokeColor: isDark ? "#6366f1" : "#4f46e5",
            strokeWeight: 0,
            strokeOpacity: 0,
            fillColor: isDark ? "#6366f1" : "#4f46e5",
            fillOpacity: isDark ? 0.05 : 0.08,
        }}/>

      {showHeatmap && heatmapData.length > 0 && (<HeatmapLayer data={heatmapData} options={{
                radius: 45,
                opacity: 0.75,
                maxIntensity: 8,
                gradient: [
                    "rgba(34,197,94,0)",
                    "rgba(34,197,94,0.45)",
                    "rgba(234,179,8,0.55)",
                    "rgba(249,115,22,0.65)",
                    "rgba(239,68,68,0.85)",
                    "rgba(220,38,38,1)",
                ],
            }}/>)}

      {clusters.map((cluster, i) => {
            const fill = clusterFillColor(cluster.count);
            const radius = clusterRadiusMeters(cluster.count);
            const selectedHere = selectedCluster === i;
            return (<Circle key={i} center={{ lat: cluster.latitude, lng: cluster.longitude }} radius={radius} options={{
                    fillColor: fill,
                    fillOpacity: showHeatmap
                        ? 0.3
                        : selectedHere
                            ? 1
                            : 0.65,
                    strokeOpacity: 0,
                    strokeWeight: 0,
                }} onClick={() => onClusterClick(i)}/>);
        })}

      {selected && (<InfoWindow position={{
                lat: selected.latitude,
                lng: selected.longitude,
            }} onCloseClick={() => onClusterClick(null)}>
            <div className="min-w-[200px] p-2 space-y-3">
              {/* Header with count and density */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">
                    {selected.count} Report{selected.count !== 1 ? "s" : ""}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className={`w-2 h-2 rounded-full ${
                      selected.count >= 15 ? "bg-red-500" :
                      selected.count >= 10 ? "bg-orange-500" :
                      selected.count >= 5 ? "bg-amber-500" : "bg-emerald-500"
                    }`}></div>
                    <span className="text-xs font-medium text-gray-600">
                      {selected.count >= 15 ? "Critical Density" :
                       selected.count >= 10 ? "High Density" :
                       selected.count >= 5 ? "Medium Density" : "Low Density"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium text-gray-500">Score</div>
                  <div className="text-sm font-bold text-indigo-600">
                    {Math.round(selected.weighted_score ?? selected.count)}
                  </div>
                </div>
              </div>

              {/* Category breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Categories</h4>
                <div className="space-y-1.5">
                  {Object.entries(selected.category_breakdown)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4)
                    .map(([cat, count]) => {
                      const percentage = Math.round((count / selected.count) * 100);
                      return (
                        <div key={cat} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${
                              cat === 'flooding' ? 'bg-blue-400' :
                              cat === 'fire' ? 'bg-orange-400' :
                              cat === 'crime' ? 'bg-red-400' :
                              cat === 'infrastructure' ? 'bg-amber-400' :
                              cat === 'health' ? 'bg-pink-400' :
                              cat === 'environmental' ? 'bg-emerald-400' : 'bg-gray-400'
                            }`}></div>
                            <span className="text-sm font-medium capitalize text-gray-700">
                              {cat === 'infrastructure' ? 'Infra' : cat}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900">{count}</span>
                            <span className="text-xs text-gray-500">({percentage}%)</span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Location</h4>
                <p className="font-mono text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded">
                  {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-500 text-white text-xs font-medium rounded hover:bg-blue-600 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Maps
                </a>
                <a
                  href={`https://waze.com/ul?ll=${selected.latitude}%2C${selected.longitude}&navigate=yes`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-indigo-500 text-white text-xs font-medium rounded hover:bg-indigo-600 transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Navigate
                </a>
              </div>
            </div>
          </InfoWindow>)}
    </GoogleMap>);
}

export default function AdminMapInner(props: AdminMapProps) {
    if (!getGoogleMapsApiKey()) {
        return <MapsMissingKey label="Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the admin map."/>;
    }
    return <AdminMapInnerLoaded {...props}/>;
}
