"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Circle, GoogleMap, InfoWindow, Polygon } from "@react-google-maps/api";
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
import { useLanguage } from "./language-provider";
import MapsMissingKey from "./maps-missing-key";
import type { ClusterResult } from "@/types";
import { translateCategory } from "@/lib/i18n";
import { Droplets, Flame, ShieldAlert, Wrench, HeartPulse, Leaf, CircleHelp, MapIcon, Navigation } from "lucide-react";

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
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const { isLoaded, loadError } = usePayatasGoogleMapsLoader();
  const { failed: authFailed, errorCode } = useGoogleMapsAuthState();
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const boundaryPath = payatasBoundaryPath();
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  const [visLoaded, setVisLoaded] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    if (typeof google !== "undefined" && google.maps && google.maps.visualization) {
      setVisLoaded(true);
      return;
    }
    const interval = setInterval(() => {
      if (typeof google !== "undefined" && google.maps && google.maps.visualization) {
        setVisLoaded(true);
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isLoaded]);

  const fallbackHeatPoints: [number, number, number][] = useMemo(() => clusters.map((c) => [
    c.latitude,
    c.longitude,
    Math.max(1, c.weighted_score ?? c.count),
  ]), [clusters]);

  const heatmapData = useMemo(() => {
    if (!isLoaded || !visLoaded || typeof google === "undefined") {
      return [];
    }
    const pts = (heatPoints && heatPoints.length > 0 ? heatPoints : fallbackHeatPoints)
      .filter(([lat, lng]) => typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng));
    return pts.map(([lat, lng, weight]) => ({
      location: new google.maps.LatLng(lat, lng),
      weight,
    }));
  }, [isLoaded, visLoaded, heatPoints, fallbackHeatPoints]);

  useEffect(() => {
    if (!mapInstance || !isLoaded || !visLoaded || typeof google === "undefined") {
      return;
    }

    // Cleanup any existing heatmap
    if (heatmapRef.current) {
      heatmapRef.current.setMap(null);
      heatmapRef.current = null;
    }

    if (showHeatmap && heatmapData.length > 0) {
      try {
        const layer = new google.maps.visualization.HeatmapLayer({
          data: heatmapData,
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
        });
        layer.setMap(mapInstance);
        heatmapRef.current = layer;
      } catch (e) {
        console.error("Failed to create HeatmapLayer:", e);
      }
    }

    return () => {
      if (heatmapRef.current) {
        heatmapRef.current.setMap(null);
        heatmapRef.current = null;
      }
    };
  }, [mapInstance, isLoaded, visLoaded, showHeatmap, heatmapData]);

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
    return <MapsMissingKey reason="auth-failed" errorCode={errorCode} />;
  }
  if (loadError) {
    return <MapsMissingKey reason="load-error" errorCode={errorCode} />;
  }
  if (!isLoaded) {
    return <div className="h-full w-full bg-muted/30 animate-pulse" />;
  }
  const selected = selectedCluster !== null ? clusters[selectedCluster] : null;
  return (<GoogleMap mapContainerClassName="h-full w-full" center={PAYATAS_CENTER} zoom={15} options={googleMapAdminOptions(isDark)} onLoad={setMapInstance} onUnmount={() => setMapInstance(null)}>
    <Polygon paths={boundaryPath} options={{
      strokeColor: isDark ? "#6366f1" : "#4f46e5",
      strokeWeight: 0,
      strokeOpacity: 0,
      fillColor: isDark ? "#6366f1" : "#4f46e5",
      fillOpacity: isDark ? 0.05 : 0.08,
    }} />

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
      }} onClick={() => onClusterClick(i)} />);
    })}

    {selected && (<InfoWindow position={{
      lat: selected.latitude,
      lng: selected.longitude,
    }} onCloseClick={() => onClusterClick(null)}>
      <div className="min-w-[240px] p-1.5 space-y-4 font-sans animate-in fade-in zoom-in-95 duration-200">
        {/* Header with count and density */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className={`font-bold text-2xl tracking-tight leading-none ${isDark ? "text-white" : "text-gray-900"}`}>
              {t.mapReportsCount(selected.count)}
            </h3>
            <div className="mt-2.5">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  selected.count >= 15 ? (isDark ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-red-50 text-red-700 border border-red-200") :
                  selected.count >= 10 ? (isDark ? "bg-orange-500/15 text-orange-400 border border-orange-500/20" : "bg-orange-50 text-orange-700 border border-orange-200") :
                  selected.count >= 5 ? (isDark ? "bg-amber-500/15 text-amber-400 border border-amber-500/20" : "bg-amber-50 text-amber-700 border border-amber-200") :
                  (isDark ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-200")
                }`}>
                <div className={`w-1.5 h-1.5 rounded-full shadow-sm ${selected.count >= 15 ? "bg-red-500" : selected.count >= 10 ? "bg-orange-500" : selected.count >= 5 ? "bg-amber-500" : "bg-emerald-500"}`}></div>
                {selected.count >= 15 ? t.mapCriticalDensity :
                  selected.count >= 10 ? t.mapHighDensity :
                    selected.count >= 5 ? t.mapMediumDensity : t.mapLowDensity}
              </div>
            </div>
          </div>
          <div className={`flex flex-col items-center justify-center min-w-[3.5rem] p-2 rounded-xl border ${isDark ? "bg-indigo-500/15 border-indigo-500/30" : "bg-indigo-50 border-indigo-200"}`}>
            <span className={`text-[9px] font-bold uppercase tracking-wider ${isDark ? "text-indigo-400" : "text-indigo-600/80"}`}>{t.mapScore}</span>
            <span className={`text-xl font-black ${isDark ? "text-indigo-300" : "text-indigo-700"} leading-none mt-0.5`}>
              {Math.round(selected.weighted_score ?? selected.count)}
            </span>
          </div>
        </div>

        {/* Category breakdown */}
        <div className="space-y-2">
          <h4 className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/40" : "text-gray-400"}`}>{t.mapCategories}</h4>
          <div className="space-y-2">
            {Object.entries(selected.category_breakdown)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([cat, count]) => {
                const percentage = Math.round((count / selected.count) * 100);
                const Icon = cat === 'flooding' ? Droplets :
                             cat === 'fire' ? Flame :
                             cat === 'crime' ? ShieldAlert :
                             cat === 'infrastructure' ? Wrench :
                             cat === 'health' ? HeartPulse :
                             cat === 'environmental' ? Leaf : CircleHelp;
                const iconColor = cat === 'flooding' ? 'text-blue-500' :
                                  cat === 'fire' ? 'text-orange-500' :
                                  cat === 'crime' ? 'text-red-500' :
                                  cat === 'infrastructure' ? 'text-amber-500' :
                                  cat === 'health' ? 'text-pink-500' :
                                  cat === 'environmental' ? 'text-emerald-500' : 'text-gray-500';
                const bgLight = cat === 'flooding' ? 'bg-blue-50' :
                                cat === 'fire' ? 'bg-orange-50' :
                                cat === 'crime' ? 'bg-red-50' :
                                cat === 'infrastructure' ? 'bg-amber-50' :
                                cat === 'health' ? 'bg-pink-50' :
                                cat === 'environmental' ? 'bg-emerald-50' : 'bg-gray-50';
                const bgDark = cat === 'flooding' ? 'bg-blue-500/15' :
                               cat === 'fire' ? 'bg-orange-500/15' :
                               cat === 'crime' ? 'bg-red-500/15' :
                               cat === 'infrastructure' ? 'bg-amber-500/15' :
                               cat === 'health' ? 'bg-pink-500/15' :
                               cat === 'environmental' ? 'bg-emerald-500/15' : 'bg-gray-500/15';

                return (
                  <div key={cat} className="flex items-center justify-between group">
                    <div className="flex items-center gap-2.5">
                      <div className={`p-1.5 rounded-lg ${isDark ? bgDark : bgLight}`}>
                        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
                      </div>
                      <span className={`text-sm font-medium transition-colors ${isDark ? "text-white/80 group-hover:text-white" : "text-gray-700 group-hover:text-gray-900"}`}>
                        {translateCategory(cat, t)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{count}</span>
                      <div className="w-8 flex justify-end">
                        <span className={`text-[10px] font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>{percentage}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Location & Buttons */}
        <div className={`pt-3.5 border-t ${isDark ? "border-white/10" : "border-gray-100"}`}>
          <div className="flex items-center justify-between mb-3.5">
             <span className={`text-[10px] font-bold uppercase tracking-widest ${isDark ? "text-white/40" : "text-gray-400"}`}>{t.mapLocation}</span>
             <p className={`font-mono text-[10px] px-2 py-0.5 rounded-md ${isDark ? "bg-white/5 text-white/60" : "bg-gray-100 text-gray-500"}`}>
               {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
             </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
              target="_blank"
              rel="noreferrer"
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95 ${isDark ? "bg-white/10 hover:bg-white/15 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-900"}`}
            >
              <MapIcon className="w-3.5 h-3.5" />
              {t.mapMaps}
            </a>
            <a
              href={`https://waze.com/ul?ll=${selected.latitude}%2C${selected.longitude}&navigate=yes`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg shadow-sm shadow-indigo-500/20 transition-all duration-200 active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5" />
              {t.mapNavigate}
            </a>
          </div>
        </div>
      </div>
    </InfoWindow>)}
  </GoogleMap>);
}

export default function AdminMapInner(props: AdminMapProps) {
  if (!getGoogleMapsApiKey()) {
    return <MapsMissingKey label="Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the admin map." />;
  }
  return <AdminMapInnerLoaded {...props} />;
}
