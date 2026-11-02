"use client";

import { useEffect, useState } from "react";
import { Circle, GoogleMap, InfoWindow, Polygon, MarkerF } from "@react-google-maps/api";
import { PAYATAS_CENTER } from "@/lib/payatas-boundary";
import {
  clusterFillColor,
  clusterRadiusMeters,
  getGoogleMapsApiKey,
  googleMapPublicPageOptions,
  payatasBoundaryPath,
} from "@/lib/payatas-google-maps";
import { usePayatasGoogleMapsLoader } from "@/hooks/use-payatas-google-maps-loader";
import { useGoogleMapsAuthState } from "@/hooks/use-google-maps-auth";
import type { ClusterResult } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { useTheme } from "./theme-provider";
import { useLanguage } from "./language-provider";
import MapsMissingKey from "./maps-missing-key";
import { translateCategory } from "@/lib/i18n";

function createClusterPinSvg(count: number, color: string, isSelected: boolean) {
  const width = isSelected ? 42 : 34;
  const height = isSelected ? 52 : 42;
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

function MapInnerLoaded() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const { isLoaded, loadError } = usePayatasGoogleMapsLoader();
  const { failed: authFailed, errorCode } = useGoogleMapsAuthState();
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
      } catch (err) {
        console.error("Failed to fetch clusters:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  if (authFailed) {
    return <MapsMissingKey reason="auth-failed" errorCode={errorCode} />;
  }
  if (loadError) {
    return <MapsMissingKey reason="load-error" errorCode={errorCode} />;
  }
  if (!isLoaded) {
    return <div className="h-full w-full bg-muted/30 animate-pulse" />;
  }
  return (
    <div className="relative h-full w-full">
      <div className="absolute top-4 left-4 z-[1] rounded-xl border border-white/10 bg-black/80 px-4 py-3 text-sm text-white backdrop-blur-sm space-y-1">
        <p className="text-base font-semibold tracking-tight">SpeakUp Payatas</p>
        {loading ? (
          <p className="text-white/60">{t.mapLoadingHotspots}</p>
        ) : (
          <>
            <p>
              <span className="text-white/60">{t.adminReports}:</span> {totalReports}
            </p>
            <p>
              <span className="text-white/60">{t.adminHotspots}:</span> {clusters.length}
            </p>
            <p>
              <span className="text-white/60">{t.adminScattered}:</span> {noiseCount}
            </p>
          </>
        )}
      </div>

      <div className="absolute bottom-6 left-4 z-[1] rounded-xl border border-white/10 bg-black/80 px-4 py-3 text-xs text-white backdrop-blur-sm space-y-1.5">
        <p className="text-sm font-medium">{t.mapDensity}</p>
        {[
          { color: "#22c55e", label: t.adminDensityLow },
          { color: "#eab308", label: t.adminDensityMedium },
          { color: "#f97316", label: t.adminDensityHigh },
          { color: "#ef4444", label: t.adminDensityCritical },
        ].map((item) => (
          <div key={item.color} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </div>
        ))}
      </div>

      <GoogleMap
        mapContainerClassName="h-full w-full"
        center={PAYATAS_CENTER}
        zoom={15}
        options={googleMapPublicPageOptions(isDark)}
        onClick={() => setPopupIndex(null)}
      >
        <Polygon
          paths={boundaryPath}
          options={{
            strokeColor: "#059669",
            strokeWeight: 0,
            strokeOpacity: 0,
            fillColor: "#059669",
            fillOpacity: 0.05,
            clickable: false,
          }}
        />

        {clusters.map((cluster, i) => {
          const fill = clusterFillColor(cluster.count);
          const radius = clusterRadiusMeters(cluster.count);
          const isSelected = popupIndex === i;
          return (
            <Circle
              key={`circle-${i}`}
              center={{ lat: cluster.latitude, lng: cluster.longitude }}
              radius={radius}
              options={{
                fillColor: fill,
                fillOpacity: isSelected ? 0.45 : 0.25,
                strokeColor: fill,
                strokeOpacity: isSelected ? 0.9 : 0.5,
                strokeWeight: isSelected ? 2 : 1,
                clickable: true,
                zIndex: isSelected ? 30 : 10,
              }}
              onClick={() => setPopupIndex(i)}
            />
          );
        })}

        {clusters.map((cluster, i) => {
          const fill = clusterFillColor(cluster.count);
          const isSelected = popupIndex === i;
          return (
            <MarkerF
              key={`pin-${i}`}
              position={{ lat: cluster.latitude, lng: cluster.longitude }}
              icon={createClusterPinSvg(cluster.count, fill, isSelected)}
              zIndex={isSelected ? 1000 : 100 + cluster.count}
              onClick={() => setPopupIndex(i)}
            />
          );
        })}

        {popupIndex !== null && clusters[popupIndex] && (
          <InfoWindow
            position={{
              lat: clusters[popupIndex].latitude,
              lng: clusters[popupIndex].longitude,
            }}
            options={{
              pixelOffset: typeof google !== "undefined" ? new google.maps.Size(0, -48) : undefined,
            }}
            onCloseClick={() => setPopupIndex(null)}
          >
            <div className="min-w-[140px] space-y-1 text-sm">
              <p className="font-semibold">{t.mapReportsCount(clusters[popupIndex].count)}</p>
              {Object.entries(clusters[popupIndex].category_breakdown).map(([cat, count]) => (
                <p key={cat} className="text-xs text-gray-600">
                  {translateCategory(cat, t)}: {count}
                </p>
              ))}
              <p className="font-mono text-xs text-gray-400">
                {clusters[popupIndex].latitude.toFixed(5)},{" "}
                {clusters[popupIndex].longitude.toFixed(5)}
              </p>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>
    </div>
  );
}

export default function MapInner() {
  if (!getGoogleMapsApiKey()) {
    return <MapsMissingKey />;
  }
  return <MapInnerLoaded />;
}
