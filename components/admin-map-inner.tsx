"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Circle, GoogleMap, InfoWindow, Polygon, MarkerF } from "@react-google-maps/api";
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
import { CATEGORY_COLORS, resolveCategory, type ClusterResult } from "@/types";
import { translateCategory } from "@/lib/i18n";
import { CATEGORY_ICONS } from "./category-icon";
import { MapIcon, Navigation, X, MapPin, ExternalLink } from "lucide-react";

function getCategoryStyle(cat: string) {
  const key = resolveCategory(cat) ?? "other";
  return { color: CATEGORY_COLORS[key], Icon: CATEGORY_ICONS[key] };
}

function createClusterPinSvg(count: number, color: string, isSelected: boolean) {
  const width = isSelected ? 44 : 36;
  const height = isSelected ? 54 : 44;
  const strokeColor = isSelected ? "#ffffff" : "rgba(255,255,255,0.85)";
  const strokeWidth = isSelected ? 3 : 2;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 36 44">
    <defs>
      <filter id="pin-shadow" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#000000" flood-opacity="0.45"/>
      </filter>
    </defs>
    <path d="M18 1 C8.6 1 1 8.6 1 18 C1 28.5 18 43 18 43 C18 43 35 28.5 35 18 C35 8.6 27.4 1 18 1 Z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" filter="url(#pin-shadow)" />
    <circle cx="18" cy="18" r="11" fill="#ffffff" />
    <text x="18" y="22.5" font-size="${count > 99 ? '10' : count > 9 ? '11' : '13'}" font-weight="900" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fill="${color}" text-anchor="middle">${count}</text>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: typeof google !== "undefined" ? new google.maps.Size(width, height) : undefined,
    anchor: typeof google !== "undefined" ? new google.maps.Point(width / 2, height) : undefined,
  };
}

function createReportPinSvg(category: string, isDark: boolean) {
  const { color } = getCategoryStyle(category);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="30" viewBox="0 0 22 30">
    <defs>
      <filter id="sub-shadow" x="-30%" y="-20%" width="160%" height="150%">
        <feDropShadow dx="0" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.5"/>
      </filter>
    </defs>
    <path d="M11 1 C5.5 1 1 5.5 1 11 C1 18.5 11 29 11 29 C11 29 21 18.5 21 11 C21 5.5 16.5 1 11 1 Z" fill="${color}" stroke="#ffffff" stroke-width="1.5" filter="url(#sub-shadow)" />
    <circle cx="11" cy="11" r="4.5" fill="#ffffff" />
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: typeof google !== "undefined" ? new google.maps.Size(22, 30) : undefined,
    anchor: typeof google !== "undefined" ? new google.maps.Point(11, 30) : undefined,
  };
}

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
      strokeColor: isDark ? "#059669" : "#4f46e5",
      strokeWeight: 0,
      strokeOpacity: 0,
      fillColor: isDark ? "#059669" : "#4f46e5",
      fillOpacity: isDark ? 0.05 : 0.08,
      clickable: false,
    }} />

    {/* Density Boundary Circles */}
    {clusters.map((cluster, i) => {
      const fill = clusterFillColor(cluster.count);
      const radius = clusterRadiusMeters(cluster.count);
      const selectedHere = selectedCluster === i;
      return (<Circle
        key={`circle-${i}`}
        center={{ lat: cluster.latitude, lng: cluster.longitude }}
        radius={radius}
        options={{
          fillColor: fill,
          fillOpacity: showHeatmap
            ? 0.2
            : selectedHere
              ? 0.4
              : 0.22,
          strokeColor: fill,
          strokeOpacity: selectedHere ? 0.9 : 0.45,
          strokeWeight: selectedHere ? 2 : 1,
          clickable: true,
          zIndex: selectedHere ? 30 : 10,
        }}
        onClick={() => onClusterClick(i)}
      />);
    })}

    {/* Exact Hotspot Pinpoint Markers */}
    {clusters.map((cluster, i) => {
      const fill = clusterFillColor(cluster.count);
      const selectedHere = selectedCluster === i;
      const pinIcon = createClusterPinSvg(cluster.count, fill, selectedHere);
      return (
        <MarkerF
          key={`pin-${i}`}
          position={{ lat: cluster.latitude, lng: cluster.longitude }}
          icon={pinIcon}
          zIndex={selectedHere ? 1000 : 100 + cluster.count}
          onClick={() => onClusterClick(i)}
        />
      );
    })}

    {/* Individual Incident Pinpoints within Selected Cluster */}
    {selected && selected.reports && selected.reports.map((report) => (
      <MarkerF
        key={`report-pin-${report.id}`}
        position={{ lat: report.latitude, lng: report.longitude }}
        icon={createReportPinSvg(report.category, isDark)}
        zIndex={1200}
        title={`${report.category}: ${report.description || 'Report'}`}
      />
    ))}

    {selected && (
      <InfoWindow
        position={{
          lat: selected.latitude,
          lng: selected.longitude,
        }}
        options={{
          pixelOffset: typeof google !== "undefined" ? new google.maps.Size(0, -48) : undefined,
        }}
        onCloseClick={() => onClusterClick(null)}
      >
        <div className={`w-[290px] sm:w-[320px] p-4 space-y-3.5 font-sans rounded-2xl select-none ${
          isDark ? "text-white" : "text-gray-900"
        }`}>
          {/* Top Bar: Density Badge, Risk Score, and Close Button */}
          <div className="flex items-center justify-between gap-2">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              selected.count >= 15
                ? isDark ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-red-50 text-red-700 border border-red-200"
                : selected.count >= 10
                ? isDark ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-orange-50 text-orange-700 border border-orange-200"
                : selected.count >= 5
                ? isDark ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "bg-amber-50 text-amber-700 border border-amber-200"
                : isDark ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                selected.count >= 15 ? "bg-red-500 animate-pulse" : selected.count >= 10 ? "bg-orange-500 animate-pulse" : selected.count >= 5 ? "bg-amber-500" : "bg-emerald-500"
              }`} />
              <span>
                {selected.count >= 15 ? t.mapCriticalDensity :
                 selected.count >= 10 ? t.mapHighDensity :
                 selected.count >= 5 ? t.mapMediumDensity : t.mapLowDensity}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                isDark ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300" : "bg-emerald-50 border-emerald-200 text-emerald-700"
              }`}>
                Score {Math.round(selected.weighted_score ?? selected.count)}
              </span>
              <button
                type="button"
                onClick={() => onClusterClick(null)}
                aria-label="Close"
                className={`p-1 rounded-lg transition-colors ${
                  isDark ? "text-white/40 hover:text-white hover:bg-white/10" : "text-gray-400 hover:text-gray-800 hover:bg-gray-100"
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Incident Count & Title */}
          <div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black tracking-tight leading-none ${isDark ? "text-white" : "text-gray-900"}`}>
                {selected.count}
              </span>
              <span className={`text-sm font-semibold ${isDark ? "text-white/80" : "text-gray-700"}`}>
                {selected.count === 1 ? "Report in Area" : "Reports in Cluster"}
              </span>
            </div>
            <p className={`text-[11px] mt-0.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
              Barangay Payatas Hotspot (D2)
            </p>
          </div>

          {/* Categories with Icons & Proportion Bars */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                {t.mapCategories}
              </span>
              <span className={`text-[10px] font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>
                Distribution
              </span>
            </div>

            <div className="space-y-2">
              {Object.entries(selected.category_breakdown)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 4)
                .map(([cat, count]) => {
                  const percentage = Math.round((count / selected.count) * 100);
                  const { color, Icon } = getCategoryStyle(cat);

                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div className="p-1 rounded-md shrink-0" style={{ backgroundColor: `${color}26` }}>
                            <Icon className="w-3 h-3" style={{ color }} />
                          </div>
                          <span className={`font-medium truncate ${isDark ? "text-white/85" : "text-gray-800"}`}>
                            {translateCategory(cat, t)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 pl-2">
                          <span className={`font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{count}</span>
                          <span className={`text-[10px] ${isDark ? "text-white/40" : "text-gray-400"}`}>({percentage}%)</span>
                        </div>
                      </div>
                      {/* Visual progress bar */}
                      <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? "bg-white/10" : "bg-gray-100"}`}>
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{ width: `${percentage}%`, backgroundColor: color }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Location / Coordinates */}
          <div className={`pt-2.5 border-t flex items-center justify-between ${isDark ? "border-white/10" : "border-gray-100"}`}>
            <div className="flex items-center gap-1">
              <MapPin className={`w-3 h-3 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
              <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>
                {t.mapLocation}
              </span>
            </div>
            <span className={`font-mono text-[10px] px-2 py-0.5 rounded-md font-semibold ${
              isDark ? "bg-white/5 text-emerald-300 border border-emerald-500/20" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
            }`}>
              {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
            </span>
          </div>

          {/* Navigation Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-0.5">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
              target="_blank"
              rel="noreferrer"
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                isDark
                  ? "bg-white/[0.06] hover:bg-white/[0.12] border-white/10 text-white shadow-sm"
                  : "bg-white hover:bg-gray-50 border-gray-200 text-gray-800 shadow-sm"
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
              <span>Google Maps</span>
            </a>
            <a
              href={`https://waze.com/ul?ll=${selected.latitude}%2C${selected.longitude}&navigate=yes`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all active:scale-95"
            >
              <Navigation className="w-3.5 h-3.5 text-white" />
              <span>Waze Nav</span>
            </a>
          </div>
        </div>
      </InfoWindow>
    )}
  </GoogleMap>);
}

export default function AdminMapInner(props: AdminMapProps) {
  if (!getGoogleMapsApiKey()) {
    return <MapsMissingKey label="Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the admin map." />;
  }
  return <AdminMapInnerLoaded {...props} />;
}
