"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polygon,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { PAYATAS_CENTER, PAYATAS_BOUNDARY } from "@/lib/payatas-boundary";
import { useTheme } from "./theme-provider";
import HeatmapLayer from "./heatmap-layer";
import type { ClusterResult } from "@/types";

interface AdminMapProps {
  clusters: ClusterResult[];
  selectedCluster: number | null;
  onClusterClick: (index: number) => void;
  showHeatmap?: boolean;
}

function getClusterColor(count: number): string {
  if (count >= 15) return "#ef4444";
  if (count >= 10) return "#f97316";
  if (count >= 5) return "#eab308";
  return "#22c55e";
}

function getClusterRadius(count: number): number {
  return Math.min(8 + count * 2.5, 40);
}

export default function AdminMapInner({
  clusters,
  selectedCluster,
  onClusterClick,
  showHeatmap = false,
}: AdminMapProps) {
  const [mounted, setMounted] = useState(false);
  const { theme } = useTheme();
  const isDark = theme === "dark";
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const boundaryLatLng = PAYATAS_BOUNDARY.map(
    ([lng, lat]) => [lat, lng] as [number, number],
  );

  // Build heatmap points from clusters
  const heatPoints: [number, number, number][] = clusters.flatMap((c) =>
    Array(c.count)
      .fill(null)
      .map(
        () =>
          [
            c.latitude + (Math.random() - 0.5) * 0.001,
            c.longitude + (Math.random() - 0.5) * 0.001,
            Math.min(c.count / 3, 5),
          ] as [number, number, number],
      ),
  );

  return (
    <MapContainer
      center={[PAYATAS_CENTER.lat, PAYATAS_CENTER.lng]}
      zoom={15}
      className="w-full h-full"
      zoomControl={false}
    >
      <TileLayer
        key={theme}
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url={isDark
          ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          : "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        }
      />

      <Polygon
        positions={boundaryLatLng}
        pathOptions={{
          color: isDark ? "#6366f1" : "#4f46e5",
          weight: 2,
          fillColor: isDark ? "#6366f1" : "#4f46e5",
          fillOpacity: isDark ? 0.05 : 0.08,
          dashArray: "6 4",
        }}
      />

      {/* Heatmap gradient layer */}
      <HeatmapLayer points={heatPoints} visible={showHeatmap} />

      {/* Circle markers (dimmed when heatmap is on) */}
      {clusters.map((cluster, i) => (
        <CircleMarker
          key={i}
          center={[cluster.latitude, cluster.longitude]}
          radius={getClusterRadius(cluster.count)}
          pathOptions={{
            fillColor: getClusterColor(cluster.count),
            fillOpacity: showHeatmap
              ? 0.3
              : selectedCluster === i
                ? 1
                : 0.65,
            color:
              selectedCluster === i ? "#fff" : "rgba(255,255,255,0.5)",
            weight: selectedCluster === i ? 2.5 : 1.5,
          }}
          eventHandlers={{
            click: () => onClusterClick(i),
          }}
        >
          <Popup>
            <div className="text-sm space-y-1 min-w-[140px]">
              <p className="font-semibold">
                {cluster.count} report{cluster.count !== 1 ? "s" : ""}
              </p>
              {Object.entries(cluster.category_breakdown).map(
                ([cat, count]) => (
                  <p key={cat} className="text-xs text-gray-600 capitalize">
                    {cat}: {count}
                  </p>
                ),
              )}
              <p className="text-xs text-gray-400 font-mono">
                {cluster.latitude.toFixed(5)}, {cluster.longitude.toFixed(5)}
              </p>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
