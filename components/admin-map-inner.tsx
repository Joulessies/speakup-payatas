"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { Circle, GoogleMap, InfoWindow, Polygon, MarkerF, Polyline } from "@react-google-maps/api";
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
import { CATEGORY_COLORS, resolveCategory, type ClusterResult, type ClusterReport } from "@/types";
import { translateCategory } from "@/lib/i18n";
import { CATEGORY_ICONS } from "./category-icon";
import {
  Navigation,
  X,
  MapPin,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  Minimize2,
  Maximize2,
  Search,
  Filter,
  Layers,
  Sparkles,
  RotateCcw,
} from "lucide-react";

export interface SpiderfiedReport extends ClusterReport {
  displayLat: number;
  displayLng: number;
  originalLat: number;
  originalLng: number;
  isDisplaced: boolean;
  clusterIndex: number;
}

/**
 * Detects overlapping or stacked points (within ~8 meters) and arranges them
 * in concentric circles / sunflower spiral so every single point has a distinct,
 * individually clickable pin on the map.
 */
function computeSpiderfiedReports(reports: ClusterReport[]): SpiderfiedReport[] {
  if (!reports || reports.length === 0) return [];

  const groups: {
    latSum: number;
    lngSum: number;
    items: { report: ClusterReport; index: number }[];
  }[] = [];

  for (let i = 0; i < reports.length; i++) {
    const r = reports[i];
    let matchedGroup: (typeof groups)[0] | null = null;
    for (const g of groups) {
      const avgLat = g.latSum / g.items.length;
      const avgLng = g.lngSum / g.items.length;
      if (Math.abs(r.latitude - avgLat) < 0.00008 && Math.abs(r.longitude - avgLng) < 0.00008) {
        matchedGroup = g;
        break;
      }
    }

    if (matchedGroup) {
      matchedGroup.latSum += r.latitude;
      matchedGroup.lngSum += r.longitude;
      matchedGroup.items.push({ report: r, index: i });
    } else {
      groups.push({
        latSum: r.latitude,
        lngSum: r.longitude,
        items: [{ report: r, index: i }],
      });
    }
  }

  const result: SpiderfiedReport[] = [];

  for (const g of groups) {
    const count = g.items.length;
    const centerLat = g.latSum / count;
    const centerLng = g.lngSum / count;
    const cosLat = Math.cos((centerLat * Math.PI) / 180);

    if (count === 1) {
      const item = g.items[0];
      result.push({
        ...item.report,
        displayLat: item.report.latitude,
        displayLng: item.report.longitude,
        originalLat: item.report.latitude,
        originalLng: item.report.longitude,
        isDisplaced: false,
        clusterIndex: item.index,
      });
    } else {
      g.items.forEach((item, k) => {
        let rDeg: number;
        let angle: number;

        if (count <= 8) {
          rDeg = 0.00015; // ~16 meters
          angle = (2 * Math.PI * k) / count;
        } else if (count <= 20) {
          if (k < 8) {
            rDeg = 0.00014;
            angle = (2 * Math.PI * k) / 8;
          } else {
            rDeg = 0.00026;
            angle = (2 * Math.PI * (k - 8)) / (count - 8);
          }
        } else {
          // Sunflower spiral for large stacks (20-100+ points)
          const goldenAngle = 2.39996323; // ~137.5 degrees
          const ring = Math.floor(k / 10);
          rDeg = 0.00012 + ring * 0.00008 + (k % 10) * 0.000008;
          angle = k * goldenAngle;
        }

        const offsetLat = rDeg * Math.cos(angle);
        const offsetLng = (rDeg * Math.sin(angle)) / cosLat;

        result.push({
          ...item.report,
          displayLat: centerLat + offsetLat,
          displayLng: centerLng + offsetLng,
          originalLat: item.report.latitude,
          originalLng: item.report.longitude,
          isDisplaced: true,
          clusterIndex: item.index,
        });
      });
    }
  }

  result.sort((a, b) => a.clusterIndex - b.clusterIndex);
  return result;
}

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

function createReportPinSvg(category: string, isDark: boolean, isSelected = false) {
  const { color } = getCategoryStyle(category);
  const width = isSelected ? 34 : 24;
  const height = isSelected ? 44 : 32;
  const strokeWidth = isSelected ? 3 : 1.5;
  const circleRadius = isSelected ? 6 : 4.5;
  const strokeColor = isSelected ? "#ffffff" : "rgba(255,255,255,0.95)";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 24 34">
    <defs>
      <filter id="sub-shadow" x="-40%" y="-30%" width="180%" height="180%">
        <feDropShadow dx="0" dy="${isSelected ? 3 : 1.5}" stdDeviation="${isSelected ? 3 : 1.5}" flood-color="#000000" flood-opacity="${isSelected ? 0.8 : 0.45}"/>
      </filter>
    </defs>
    ${isSelected ? `<circle cx="12" cy="12" r="11" fill="${color}" opacity="0.35" />` : ''}
    <path d="M12 1 C6 1 1 6 1 12 C1 20 12 32 12 32 C12 32 23 20 23 12 C23 6 18 1 12 1 Z" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" filter="url(#sub-shadow)" />
    <circle cx="12" cy="12" r="${circleRadius}" fill="#ffffff" />
    ${isSelected ? `<circle cx="12" cy="12" r="3" fill="${color}" />` : ''}
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: typeof google !== "undefined" ? new google.maps.Size(width, height) : undefined,
    anchor: typeof google !== "undefined" ? new google.maps.Point(width / 2, height) : undefined,
  };
}

function formatReportDate(iso?: string): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function getStatusBadge(status?: string, isDark = false) {
  const s = (status || "").toLowerCase();
  if (s === "resolved") {
    return {
      label: "Resolved",
      className: isDark ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  if (s === "in_progress" || s === "verified") {
    return {
      label: s === "verified" ? "Verified" : "In Progress",
      className: isDark ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200",
    };
  }
  return {
    label: "Pending",
    className: isDark ? "bg-slate-500/20 text-slate-300 border-slate-500/30" : "bg-gray-100 text-gray-700 border-gray-200",
  };
}

function getUrgencyBadge(severity?: number, isDark = false) {
  const sev = severity ?? 3;
  if (sev >= 4) {
    return {
      label: `HIGH (${sev})`,
      className: isDark ? "bg-red-500/20 text-red-300 border-red-500/30" : "bg-red-50 text-red-700 border-red-200",
    };
  }
  if (sev <= 2) {
    return {
      label: `LOW (${sev})`,
      className: isDark ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border-emerald-200",
    };
  }
  return {
    label: `MED (${sev})`,
    className: isDark ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-amber-50 text-amber-700 border-amber-200",
  };
}

interface AdminMapProps {
  clusters: (ClusterResult & { weighted_score?: number })[];
  selectedCluster: number | null;
  onClusterClick: (index: number | null) => void;
  showHeatmap?: boolean;
  heatPoints?: [number, number, number][];
  noisePoints?: (ClusterReport | { latitude: number; longitude: number })[];
  onMapBoundsChange?: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => void;
  selectedReportId?: string | null;
  onSelectReportId?: (id: string | null) => void;
}

function AdminMapInnerLoaded({
  clusters,
  selectedCluster,
  onClusterClick,
  showHeatmap = false,
  heatPoints,
  noisePoints = [],
  onMapBoundsChange,
  selectedReportId,
  onSelectReportId,
}: AdminMapProps) {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";
  const { isLoaded, loadError } = usePayatasGoogleMapsLoader();
  const { failed: authFailed, errorCode } = useGoogleMapsAuthState();
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null);
  const boundaryPath = payatasBoundaryPath();
  const heatmapRef = useRef<google.maps.visualization.HeatmapLayer | null>(null);

  const [visLoaded, setVisLoaded] = useState(false);

  // Point Peek & Interaction States
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [infoWindowMode, setInfoWindowMode] = useState<"cluster" | "peek">("cluster");
  const [activeNoisePoint, setActiveNoisePoint] = useState<ClusterReport | null>(null);

  // New High-Density Navigation States
  const [clusterCategoryFilter, setClusterCategoryFilter] = useState<string | null>(null);
  const [isDocked, setIsDocked] = useState<boolean>(false);
  const [isBrowseOpen, setIsBrowseOpen] = useState<boolean>(false);
  const [browseSearchQuery, setBrowseSearchQuery] = useState<string>("");

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

  // Reset states when cluster selection changes
  useEffect(() => {
    setActiveReportId(null);
    setActiveNoisePoint(null);
    setInfoWindowMode("cluster");
    setClusterCategoryFilter(null);
    setIsBrowseOpen(false);
  }, [selectedCluster]);

  const selected = selectedCluster !== null ? clusters[selectedCluster] : null;
  const rawReports = useMemo(() => selected?.reports ?? [], [selected]);

  // Synchronize when selectedReportId is passed from parent (e.g. from sidebar list)
  useEffect(() => {
    if (!selectedReportId || rawReports.length === 0) return;
    const target = rawReports.find((r) => r.id === selectedReportId);
    if (target) {
      setActiveReportId(target.id);
      setInfoWindowMode("peek");
      setActiveNoisePoint(null);
      if (mapInstance) {
        mapInstance.panTo({
          lat: target.latitude,
          lng: target.longitude,
        });
      }
    }
  }, [selectedReportId, rawReports, mapInstance]);

  // Filtered reports inside current cluster (by category if selected)
  const filteredReports = useMemo(() => {
    if (!clusterCategoryFilter) return rawReports;
    return rawReports.filter((r) => r.category === clusterCategoryFilter);
  }, [rawReports, clusterCategoryFilter]);

  // Spiderfied coordinates for individual markers so overlapping points separate cleanly
  const spiderfiedReports = useMemo(() => {
    return computeSpiderfiedReports(filteredReports);
  }, [filteredReports]);

  // Currently active report (either from filtered or raw list)
  const currentReport = useMemo(() => {
    if (!activeReportId) return null;
    return rawReports.find((r) => r.id === activeReportId) || null;
  }, [rawReports, activeReportId]);

  const currentSpiderfied = useMemo(() => {
    if (!activeReportId) return null;
    return spiderfiedReports.find((r) => r.id === activeReportId) || null;
  }, [spiderfiedReports, activeReportId]);

  const currentIndex = useMemo(() => {
    if (!currentReport) return -1;
    return filteredReports.findIndex((r) => r.id === currentReport.id);
  }, [filteredReports, currentReport]);

  const fallbackHeatPoints: [number, number, number][] = useMemo(
    () =>
      clusters.map((c) => [
        c.latitude,
        c.longitude,
        Math.max(1, c.weighted_score ?? c.count),
      ]),
    [clusters]
  );

  const heatmapData = useMemo(() => {
    if (!isLoaded || !visLoaded || typeof google === "undefined") {
      return [];
    }
    const pts = (heatPoints && heatPoints.length > 0 ? heatPoints : fallbackHeatPoints).filter(
      ([lat, lng]) =>
        typeof lat === "number" && !isNaN(lat) && typeof lng === "number" && !isNaN(lng)
    );
    return pts.map(([lat, lng, weight]) => ({
      location: new google.maps.LatLng(lat, lng),
      weight,
    }));
  }, [isLoaded, visLoaded, heatPoints, fallbackHeatPoints]);

  useEffect(() => {
    if (!mapInstance || !isLoaded || !visLoaded || typeof google === "undefined") {
      return;
    }

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
    if (!mapInstance || !onMapBoundsChange) return;
    const reportBounds = () => {
      const b = mapInstance.getBounds();
      if (!b) return;
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

  // Stepper Handlers
  const handleSelectReport = (r: ClusterReport | SpiderfiedReport) => {
    setActiveReportId(r.id);
    setInfoWindowMode("peek");
    setActiveNoisePoint(null);
    if (onSelectReportId) onSelectReportId(r.id);

    // Pan smoothly to the display position of this pin
    const displayPos = "displayLat" in r
      ? { lat: (r as SpiderfiedReport).displayLat, lng: (r as SpiderfiedReport).displayLng }
      : { lat: r.latitude, lng: r.longitude };

    if (mapInstance) {
      mapInstance.panTo(displayPos);
    }
  };

  const handleNextPoint = () => {
    if (filteredReports.length === 0) return;
    const nextIdx =
      currentIndex === -1 ? 0 : (currentIndex + 1) % filteredReports.length;
    const target = filteredReports[nextIdx];
    const spTarget = spiderfiedReports.find((s) => s.id === target.id) || target;
    handleSelectReport(spTarget);
  };

  const handlePrevPoint = () => {
    if (filteredReports.length === 0) return;
    const prevIdx =
      currentIndex === -1
        ? filteredReports.length - 1
        : (currentIndex - 1 + filteredReports.length) % filteredReports.length;
    const target = filteredReports[prevIdx];
    const spTarget = spiderfiedReports.find((s) => s.id === target.id) || target;
    handleSelectReport(spTarget);
  };

  const handleNextCluster = () => {
    if (clusters.length === 0 || selectedCluster === null) return;
    const nextCIdx = (selectedCluster + 1) % clusters.length;
    onClusterClick(nextCIdx);
    setActiveReportId(null);
    setInfoWindowMode("cluster");
    const nextC = clusters[nextCIdx];
    if (mapInstance && nextC) {
      mapInstance.panTo({ lat: nextC.latitude, lng: nextC.longitude });
    }
  };

  const handlePrevCluster = () => {
    if (clusters.length === 0 || selectedCluster === null) return;
    const prevCIdx = (selectedCluster - 1 + clusters.length) % clusters.length;
    onClusterClick(prevCIdx);
    setActiveReportId(null);
    setInfoWindowMode("cluster");
    const prevC = clusters[prevCIdx];
    if (mapInstance && prevC) {
      mapInstance.panTo({ lat: prevC.latitude, lng: prevC.longitude });
    }
  };

  const handleCloseAll = () => {
    onClusterClick(null);
    setActiveReportId(null);
    setActiveNoisePoint(null);
    setInfoWindowMode("cluster");
    setClusterCategoryFilter(null);
    setIsBrowseOpen(false);
    if (onSelectReportId) onSelectReportId(null);
  };

  // Determine active InfoWindow position (when NOT docked)
  const infoWindowPosition = activeNoisePoint
    ? { lat: activeNoisePoint.latitude, lng: activeNoisePoint.longitude }
    : infoWindowMode === "peek" && currentSpiderfied
    ? { lat: currentSpiderfied.displayLat, lng: currentSpiderfied.displayLng }
    : infoWindowMode === "peek" && currentReport
    ? { lat: currentReport.latitude, lng: currentReport.longitude }
    : selected
    ? { lat: selected.latitude, lng: selected.longitude }
    : null;

  // Filtered items for the Browse Drawer
  const browsableReports = filteredReports.filter((r) => {
    if (!browseSearchQuery.trim()) return true;
    const q = browseSearchQuery.toLowerCase();
    return (
      (r.description && r.description.toLowerCase().includes(q)) ||
      (r.category && r.category.toLowerCase().includes(q)) ||
      (r.receipt_id && r.receipt_id.toLowerCase().includes(q))
    );
  });

  return (
    <div className="relative h-full w-full overflow-hidden">
      <GoogleMap
        mapContainerClassName="h-full w-full"
        center={PAYATAS_CENTER}
        zoom={15}
        options={googleMapAdminOptions(isDark)}
        onLoad={setMapInstance}
        onUnmount={() => setMapInstance(null)}
      >
        <Polygon
          paths={boundaryPath}
          options={{
            strokeColor: isDark ? "#059669" : "#4f46e5",
            strokeWeight: 0,
            strokeOpacity: 0,
            fillColor: isDark ? "#059669" : "#4f46e5",
            fillOpacity: isDark ? 0.05 : 0.08,
            clickable: false,
          }}
        />

        {/* Density circles only after Heatmap is turned on */}
        {showHeatmap &&
          clusters.map((cluster, i) => {
            const fill = clusterFillColor(cluster.count);
            const radius = clusterRadiusMeters(cluster.count);
            const selectedHere = selectedCluster === i;
            return (
              <Circle
                key={`circle-${i}`}
                center={{ lat: cluster.latitude, lng: cluster.longitude }}
                radius={radius}
                options={{
                  fillColor: fill,
                  fillOpacity: showHeatmap ? 0.2 : selectedHere ? 0.4 : 0.22,
                  strokeColor: fill,
                  strokeOpacity: selectedHere ? 0.9 : 0.45,
                  strokeWeight: selectedHere ? 2 : 1,
                  clickable: true,
                  zIndex: selectedHere ? 30 : 10,
                }}
                onClick={() => onClusterClick(i)}
              />
            );
          })}

        {/* Scattered / Isolated Noise Points (Clickable) */}
        {noisePoints.map((point: any, i: number) => {
          const isNoiseSelected =
            activeNoisePoint &&
            (activeNoisePoint.id ? activeNoisePoint.id === point.id : activeNoisePoint === point);
          return (
            <MarkerF
              key={`noise-${point.id || i}`}
              position={{ lat: point.latitude, lng: point.longitude }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: isNoiseSelected ? 8 : 5,
                fillColor: isNoiseSelected ? "#10b981" : "#059669",
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: isNoiseSelected ? 2.5 : 1,
              }}
              zIndex={isNoiseSelected ? 2500 : 40}
              title={point.description ? `Scattered: ${point.description}` : "Scattered Point"}
              onClick={() => {
                setActiveNoisePoint(point);
                onClusterClick(null);
                setActiveReportId(null);
                setInfoWindowMode("cluster");
                if (mapInstance) {
                  mapInstance.panTo({ lat: point.latitude, lng: point.longitude });
                }
              }}
            />
          );
        })}

        {/* Main Cluster Centers (Clickable Hotspot Pins) */}
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
              onClick={() => {
                onClusterClick(i);
                setActiveNoisePoint(null);
                setActiveReportId(null);
                setInfoWindowMode("cluster");
                if (mapInstance) {
                  mapInstance.panTo({ lat: cluster.latitude, lng: cluster.longitude });
                }
              }}
            />
          );
        })}

        {/* Individual Incident Pinpoints within Selected Cluster (Spiderfied & Clickable) */}
        {selected &&
          spiderfiedReports.map((report) => {
            const isSelectedPoint = activeReportId === report.id;
            return (
              <MarkerF
                key={`report-pin-${report.id}`}
                position={{ lat: report.displayLat, lng: report.displayLng }}
                icon={createReportPinSvg(report.category, isDark, isSelectedPoint)}
                zIndex={isSelectedPoint ? 3000 : 1200}
                title={`${report.category}: ${report.description || "Report"} (Click to peek)`}
                onClick={() => handleSelectReport(report)}
              />
            );
          })}

        {/* Connecting tether line for active displaced/spiderfied point back to its original coordinate */}
        {currentSpiderfied && currentSpiderfied.isDisplaced && (
          <Polyline
            path={[
              { lat: currentSpiderfied.originalLat, lng: currentSpiderfied.originalLng },
              { lat: currentSpiderfied.displayLat, lng: currentSpiderfied.displayLng },
            ]}
            options={{
              strokeColor: getCategoryStyle(currentSpiderfied.category).color,
              strokeOpacity: 0.9,
              strokeWeight: 2.5,
              geodesic: false,
              zIndex: 2900,
            }}
          />
        )}

        {/* Floating InfoWindow: Only rendered when NOT docked */}
        {!isDocked && infoWindowPosition && (selected || activeNoisePoint) && (
          <InfoWindow
            position={infoWindowPosition}
            options={{
              pixelOffset:
                typeof google !== "undefined"
                  ? new google.maps.Size(
                      0,
                      infoWindowMode === "peek" || activeNoisePoint ? -42 : -48
                    )
                  : undefined,
            }}
            onCloseClick={handleCloseAll}
          >
            <div
              className={`w-[310px] sm:w-[340px] p-4 space-y-3 font-sans rounded-2xl select-none ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {/* ── VIEW 1: POINT-BY-POINT PEEK MODE ── */}
              {infoWindowMode === "peek" && currentReport ? (
                <div className="space-y-3">
                  {/* Stepper Navigation Header */}
                  <div className="flex items-center justify-between gap-1 pb-2 border-b border-black/10 dark:border-white/10">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={handlePrevPoint}
                        className={`p-1.5 rounded-lg border transition-all active:scale-90 ${
                          isDark
                            ? "bg-white/5 border-white/10 text-white hover:bg-white/15"
                            : "bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200"
                        }`}
                        title="Previous point"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          isDark
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        Point {currentIndex + 1} of {filteredReports.length}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextPoint}
                        className={`p-1.5 rounded-lg border transition-all active:scale-90 ${
                          isDark
                            ? "bg-white/5 border-white/10 text-white hover:bg-white/15"
                            : "bg-gray-100 border-gray-200 text-gray-800 hover:bg-gray-200"
                        }`}
                        title="Next point"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsBrowseOpen(true)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isDark
                            ? "bg-white/5 border-white/10 text-white hover:bg-white/15"
                            : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
                        }`}
                        title="Browse All Points List"
                      >
                        <Layers className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsDocked(true)}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          isDark
                            ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/15"
                            : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
                        }`}
                        title="Dock card to bottom (uncover map pins)"
                      >
                        <Minimize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setInfoWindowMode("cluster");
                          if (mapInstance && selected) {
                            mapInstance.panTo({ lat: selected.latitude, lng: selected.longitude });
                          }
                        }}
                        className={`text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors ${
                          isDark
                            ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/15"
                            : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                        }`}
                        title="Back to cluster overview"
                      >
                        Cluster
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseAll}
                        aria-label="Close"
                        className={`p-1 rounded-lg transition-colors ${
                          isDark
                            ? "text-white/40 hover:text-white"
                            : "text-gray-400 hover:text-gray-800"
                        }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Category & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="p-1.5 rounded-md shrink-0"
                        style={{
                          backgroundColor: `${getCategoryStyle(currentReport.category).color}26`,
                        }}
                      >
                        {(() => {
                          const { color, Icon } = getCategoryStyle(currentReport.category);
                          return <Icon className="w-3.5 h-3.5" style={{ color }} />;
                        })()}
                      </div>
                      <span className="text-xs font-bold truncate">
                        {translateCategory(currentReport.category, t)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase ${
                          getUrgencyBadge(currentReport.severity, isDark).className
                        }`}
                      >
                        {getUrgencyBadge(currentReport.severity, isDark).label}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase ${
                          getStatusBadge(currentReport.status, isDark).className
                        }`}
                      >
                        {getStatusBadge(currentReport.status, isDark).label}
                      </span>
                    </div>
                  </div>

                  {/* Date & Reference ID */}
                  <div className="flex items-center justify-between text-[10px] opacity-75">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-emerald-500" />
                      {formatReportDate(currentReport.created_at)}
                    </span>
                    {currentReport.receipt_id && (
                      <span className="font-mono bg-black/10 dark:bg-white/10 px-1.5 py-0.5 rounded">
                        {currentReport.receipt_id}
                      </span>
                    )}
                  </div>

                  {/* Report Description */}
                  <div
                    className={`p-2.5 rounded-xl border max-h-24 overflow-y-auto text-xs leading-relaxed ${
                      isDark
                        ? "bg-white/[0.04] border-white/10 text-white/90"
                        : "bg-gray-50 border-gray-200 text-gray-800"
                    }`}
                  >
                    <p className="font-medium whitespace-pre-wrap">
                      {currentReport.description || "No written description provided."}
                    </p>
                  </div>

                  {/* Coordinates & External Nav */}
                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="font-mono opacity-70">
                      {currentReport.latitude.toFixed(5)}, {currentReport.longitude.toFixed(5)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${currentReport.latitude},${currentReport.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium ${
                          isDark
                            ? "bg-white/5 border-white/10 hover:bg-white/15"
                            : "bg-gray-100 border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        <ExternalLink className="w-2.5 h-2.5 text-blue-400" /> Maps
                      </a>
                      <a
                        href={`https://waze.com/ul?ll=${currentReport.latitude}%2C${currentReport.longitude}&navigate=yes`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium"
                      >
                        <Navigation className="w-2.5 h-2.5" /> Waze
                      </a>
                    </div>
                  </div>
                </div>
              ) : activeNoisePoint ? (
                /* ── VIEW 2: SCATTERED NOISE POINT ── */
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-2 border-b border-black/10 dark:border-white/10">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-teal-400" />
                      Scattered Incident Report
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setIsDocked(true)}
                        className={`p-1 rounded-lg border transition-colors ${
                          isDark
                            ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/15"
                            : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
                        }`}
                        title="Dock card to bottom"
                      >
                        <Minimize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseAll}
                        aria-label="Close"
                        className={`p-1 rounded-lg transition-colors ${
                          isDark
                            ? "text-white/40 hover:text-white"
                            : "text-gray-400 hover:text-gray-800"
                        }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {activeNoisePoint.category && (
                        <div
                          className="p-1.5 rounded-md shrink-0"
                          style={{
                            backgroundColor: `${
                              getCategoryStyle(activeNoisePoint.category).color
                            }26`,
                          }}
                        >
                          {(() => {
                            const { color, Icon } = getCategoryStyle(activeNoisePoint.category);
                            return <Icon className="w-3.5 h-3.5" style={{ color }} />;
                          })()}
                        </div>
                      )}
                      <span className="text-xs font-bold truncate">
                        {activeNoisePoint.category
                          ? translateCategory(activeNoisePoint.category, t)
                          : "Isolated Incident"}
                      </span>
                    </div>

                    {activeNoisePoint.severity && (
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md border uppercase ${
                          getUrgencyBadge(activeNoisePoint.severity, isDark).className
                        }`}
                      >
                        {getUrgencyBadge(activeNoisePoint.severity, isDark).label}
                      </span>
                    )}
                  </div>

                  {activeNoisePoint.description && (
                    <div
                      className={`p-2.5 rounded-xl border max-h-24 overflow-y-auto text-xs leading-relaxed ${
                        isDark
                          ? "bg-white/[0.04] border-white/10 text-white/90"
                          : "bg-gray-50 border-gray-200 text-gray-800"
                      }`}
                    >
                      <p className="font-medium whitespace-pre-wrap">
                        {activeNoisePoint.description}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 text-[10px]">
                    <span className="font-mono opacity-70">
                      {activeNoisePoint.latitude.toFixed(5)}, {activeNoisePoint.longitude.toFixed(5)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${activeNoisePoint.latitude},${activeNoisePoint.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-medium ${
                          isDark
                            ? "bg-white/5 border-white/10 hover:bg-white/15"
                            : "bg-gray-100 border-gray-200 hover:bg-gray-200"
                        }`}
                      >
                        <ExternalLink className="w-2.5 h-2.5 text-blue-400" /> Maps
                      </a>
                      <a
                        href={`https://waze.com/ul?ll=${activeNoisePoint.latitude}%2C${activeNoisePoint.longitude}&navigate=yes`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-medium"
                      >
                        <Navigation className="w-2.5 h-2.5" /> Waze
                      </a>
                    </div>
                  </div>
                </div>
              ) : selected ? (
                /* ── VIEW 3: CLUSTER OVERVIEW WITH IN-CLUSTER FILTER & ONE-BY-ONE PEEK ── */
                <div className="space-y-3.5">
                  {/* Top Bar: Density Badge, Risk Score, Minimize & Close */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        selected.count >= 15
                          ? isDark
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : "bg-red-50 text-red-700 border border-red-200"
                          : selected.count >= 10
                          ? isDark
                            ? "bg-orange-500/20 text-orange-400 border border-orange-500/30"
                            : "bg-orange-50 text-orange-700 border border-orange-200"
                          : selected.count >= 5
                          ? isDark
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                          : isDark
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          selected.count >= 15
                            ? "bg-red-500 animate-pulse"
                            : selected.count >= 10
                            ? "bg-orange-500 animate-pulse"
                            : selected.count >= 5
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                      />
                      <span>
                        {selected.count >= 15
                          ? t.mapCriticalDensity
                          : selected.count >= 10
                          ? t.mapHighDensity
                          : selected.count >= 5
                          ? t.mapMediumDensity
                          : t.mapLowDensity}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {clusters.length > 1 && (
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={handlePrevCluster}
                            className={`p-1 rounded-md border text-[10px] transition-colors ${
                              isDark
                                ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/15"
                                : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
                            }`}
                            title="Previous Hotspot"
                          >
                            <ChevronLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={handleNextCluster}
                            className={`p-1 rounded-md border text-[10px] transition-colors ${
                              isDark
                                ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/15"
                                : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200"
                            }`}
                            title="Next Hotspot"
                          >
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsDocked(true)}
                        className={`p-1 rounded-md border transition-colors ${
                          isDark
                            ? "bg-white/5 border-white/10 text-white/70 hover:bg-white/15"
                            : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"
                        }`}
                        title="Dock card to bottom (uncover map pins)"
                      >
                        <Minimize2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={handleCloseAll}
                        aria-label="Close"
                        className={`p-1 rounded-lg transition-colors ${
                          isDark
                            ? "text-white/40 hover:text-white"
                            : "text-gray-400 hover:text-gray-800"
                        }`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Incident Count & Title */}
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`text-2xl font-black tracking-tight leading-none ${
                          isDark ? "text-white" : "text-gray-900"
                        }`}
                      >
                        {selected.count}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          isDark ? "text-white/80" : "text-gray-700"
                        }`}
                      >
                        {selected.count === 1 ? "Report in Area" : "Reports in Cluster"}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] mt-0.5 ${
                        isDark ? "text-white/45" : "text-gray-500"
                      }`}
                    >
                      Barangay Payatas Hotspot (D2)
                    </p>
                  </div>

                  {/* ACTION BAR: Peek One-by-One & Browse All List */}
                  <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (filteredReports.length > 0) {
                          const target = filteredReports[0];
                          const spTarget =
                            spiderfiedReports.find((s) => s.id === target.id) || target;
                          handleSelectReport(spTarget);
                        }
                      }}
                      className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl font-bold text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all active:scale-95"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Peek Points (1/{filteredReports.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsBrowseOpen(true)}
                      className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-xl font-semibold text-[11px] border transition-all active:scale-95 ${
                        isDark
                          ? "bg-white/5 border-white/10 hover:bg-white/15 text-white"
                          : "bg-gray-100 border-gray-200 hover:bg-gray-200 text-gray-800"
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 text-blue-400" />
                      <span>Browse All List</span>
                    </button>
                  </div>

                  {/* INTERACTIVE CATEGORIES: Click a category to isolate its pins! */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isDark ? "text-white/40" : "text-gray-400"
                        }`}
                      >
                        {t.mapCategories} (Click to Filter)
                      </span>
                      {clusterCategoryFilter ? (
                        <button
                          type="button"
                          onClick={() => setClusterCategoryFilter(null)}
                          className="text-[10px] text-emerald-400 hover:underline font-bold"
                        >
                          Reset Filter
                        </button>
                      ) : (
                        <span
                          className={`text-[10px] font-medium ${
                            isDark ? "text-white/40" : "text-gray-400"
                          }`}
                        >
                          Distribution
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {Object.entries(selected.category_breakdown)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, count]) => {
                          const percentage = Math.round((count / selected.count) * 100);
                          const { color, Icon } = getCategoryStyle(cat);
                          const isFiltered = clusterCategoryFilter === cat;

                          return (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => {
                                setClusterCategoryFilter(isFiltered ? null : cat);
                                setActiveReportId(null);
                                setInfoWindowMode("cluster");
                              }}
                              className={`w-full text-left p-1.5 rounded-xl border transition-all ${
                                isFiltered
                                  ? isDark
                                    ? "bg-emerald-500/15 border-emerald-500/50 shadow-sm"
                                    : "bg-emerald-50 border-emerald-400 shadow-sm"
                                  : isDark
                                  ? "bg-white/[0.02] border-white/5 hover:bg-white/[0.08]"
                                  : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs mb-1">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <div
                                    className="p-1 rounded-md shrink-0"
                                    style={{ backgroundColor: `${color}26` }}
                                  >
                                    <Icon className="w-3 h-3" style={{ color }} />
                                  </div>
                                  <span
                                    className={`font-semibold truncate ${
                                      isFiltered
                                        ? "text-emerald-400 font-bold"
                                        : isDark
                                        ? "text-white/85"
                                        : "text-gray-800"
                                    }`}
                                  >
                                    {translateCategory(cat, t)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 pl-2">
                                  <span
                                    className={`font-bold ${
                                      isFiltered
                                        ? "text-emerald-400"
                                        : isDark
                                        ? "text-white"
                                        : "text-gray-900"
                                    }`}
                                  >
                                    {count}
                                  </span>
                                  <span
                                    className={`text-[10px] ${
                                      isDark ? "text-white/40" : "text-gray-400"
                                    }`}
                                  >
                                    ({percentage}%)
                                  </span>
                                </div>
                              </div>
                              <div
                                className={`h-1.5 w-full rounded-full overflow-hidden ${
                                  isDark ? "bg-white/10" : "bg-gray-200"
                                }`}
                              >
                                <div
                                  className="h-full rounded-full transition-all duration-300"
                                  style={{
                                    width: `${percentage}%`,
                                    backgroundColor: color,
                                  }}
                                />
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* External Navigation Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-black/5 dark:border-white/5">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selected.latitude},${selected.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
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
                      className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 transition-all active:scale-95"
                    >
                      <Navigation className="w-3.5 h-3.5 text-white" />
                      <span>Waze Nav</span>
                    </a>
                  </div>
                </div>
              ) : null}
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* ── TOP BANNER: ACTIVE IN-CLUSTER CATEGORY FILTER ── */}
      {selected && clusterCategoryFilter && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1050] flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/90 dark:bg-slate-950/90 border border-emerald-500/40 text-white text-xs shadow-2xl backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-emerald-300">
            Filtered: {translateCategory(clusterCategoryFilter, t)} ({filteredReports.length} of {rawReports.length} points)
          </span>
          <button
            type="button"
            onClick={() => setClusterCategoryFilter(null)}
            className="ml-1 p-0.5 rounded-full hover:bg-white/20 text-white/70 hover:text-white"
            title="Reset filter (show all points)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── DOCKED BOTTOM BAR: KEEPS ALL 124 MAP PINS 100% VISIBLE AND CLICKABLE ── */}
      {isDocked && (selected || activeNoisePoint) && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-[1050] w-[95%] max-w-2xl px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white border border-white/10 shadow-2xl backdrop-blur-xl transition-all">
          {infoWindowMode === "peek" && currentReport ? (
            /* DOCKED PEEK MODE */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="p-2 rounded-xl shrink-0"
                  style={{
                    backgroundColor: `${getCategoryStyle(currentReport.category).color}26`,
                  }}
                >
                  {(() => {
                    const { color, Icon } = getCategoryStyle(currentReport.category);
                    return <Icon className="w-4 h-4" style={{ color }} />;
                  })()}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white truncate">
                      {translateCategory(currentReport.category, t)}
                    </span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                        getUrgencyBadge(currentReport.severity, true).className
                      }`}
                    >
                      {getUrgencyBadge(currentReport.severity, true).label}
                    </span>
                    <span className="text-[10px] text-white/50">
                      Point {currentIndex + 1}/{filteredReports.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-white/80 line-clamp-1 mt-0.5">
                    {currentReport.description || "No written description provided."}
                  </p>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-end gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handlePrevPoint}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
                  title="Previous point"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextPoint}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors"
                  title="Next point"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsBrowseOpen(true)}
                  className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold border border-white/10 flex items-center gap-1"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">Browse</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDocked(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10"
                  title="Pop out floating card"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCloseAll}
                  className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : selected ? (
            /* DOCKED CLUSTER OVERVIEW */
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-white">{selected.count}</span>
                  <span className="text-xs text-white/70">Reports</span>
                </div>
                <div className="h-4 w-px bg-white/20" />
                <span className="text-xs font-medium text-emerald-400">
                  {clusterCategoryFilter
                    ? `${translateCategory(clusterCategoryFilter, t)} (${filteredReports.length})`
                    : "Barangay Payatas Hotspot (D2)"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (filteredReports.length > 0) {
                      const target = filteredReports[0];
                      const spTarget =
                        spiderfiedReports.find((s) => s.id === target.id) || target;
                      handleSelectReport(spTarget);
                    }
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Peek Points (1/{filteredReports.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsBrowseOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-semibold text-xs bg-white/10 hover:bg-white/20 text-white border border-white/10"
                >
                  <Layers className="w-3.5 h-3.5 text-blue-400" />
                  <span>List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsDocked(false)}
                  className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10"
                  title="Pop out floating card"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleCloseAll}
                  className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* ── BROWSE ALL POINTS DRAWER (EXPANDABLE SLIDE-OVER FOR ALL 124 POINTS) ── */}
      {isBrowseOpen && selected && (
        <div className="absolute top-3 right-3 bottom-3 w-80 sm:w-96 z-[1200] flex flex-col rounded-2xl bg-slate-900/95 dark:bg-slate-950/95 text-white border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-right duration-200">
          {/* Drawer Header */}
          <div className="p-3.5 border-b border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                All Points in Cluster ({filteredReports.length})
              </h3>
              <p className="text-[10px] text-white/50">Click any point to pan and inspect</p>
            </div>
            <button
              type="button"
              onClick={() => setIsBrowseOpen(false)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Box */}
          <div className="p-2.5 border-b border-white/10">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-white/40" />
              <input
                type="text"
                placeholder="Search description, ID, category..."
                value={browseSearchQuery}
                onChange={(e) => setBrowseSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs text-white placeholder-white/40 focus:outline-none focus:border-emerald-500"
              />
              {browseSearchQuery && (
                <button
                  type="button"
                  onClick={() => setBrowseSearchQuery("")}
                  className="absolute right-2.5 top-2 text-white/40 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Chips */}
          <div className="p-2 border-b border-white/10 flex items-center gap-1 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setClusterCategoryFilter(null)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 transition-colors ${
                !clusterCategoryFilter
                  ? "bg-emerald-600 text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              All ({rawReports.length})
            </button>
            {Object.entries(selected.category_breakdown).map(([cat, count]) => {
              const isCatActive = clusterCategoryFilter === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setClusterCategoryFilter(isCatActive ? null : cat)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 transition-colors ${
                    isCatActive
                      ? "bg-emerald-600 text-white"
                      : "bg-white/5 text-white/60 hover:bg-white/10"
                  }`}
                >
                  {translateCategory(cat, t)} ({count})
                </button>
              );
            })}
          </div>

          {/* Scrollable Points List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 divide-y divide-white/5">
            {browsableReports.length === 0 ? (
              <div className="text-center py-10 text-white/40 text-xs">
                No matching reports found in this cluster.
              </div>
            ) : (
              browsableReports.map((report, idx) => {
                const isSelectedThis = activeReportId === report.id;
                const { color, Icon } = getCategoryStyle(report.category);

                return (
                  <button
                    key={report.id}
                    type="button"
                    onClick={() => {
                      const spTarget =
                        spiderfiedReports.find((s) => s.id === report.id) || report;
                      handleSelectReport(spTarget);
                    }}
                    className={`w-full text-left p-2.5 rounded-xl transition-all border ${
                      isSelectedThis
                        ? "bg-emerald-500/20 border-emerald-500/60 shadow-md ring-1 ring-emerald-500/50"
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[10px] text-white/50 font-bold">
                          #{idx + 1}
                        </span>
                        <div
                          className="p-1 rounded-md shrink-0"
                          style={{ backgroundColor: `${color}26` }}
                        >
                          <Icon className="w-3 h-3" style={{ color }} />
                        </div>
                        <span className="font-semibold text-white truncate">
                          {translateCategory(report.category, t)}
                        </span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase shrink-0 ${
                          getUrgencyBadge(report.severity, true).className
                        }`}
                      >
                        {getUrgencyBadge(report.severity, true).label}
                      </span>
                    </div>

                    <p className="text-[11px] text-white/75 line-clamp-2 leading-relaxed">
                      {report.description || "No written description provided."}
                    </p>

                    <div className="flex items-center justify-between text-[9px] text-white/40 mt-1.5 pt-1 border-t border-white/5">
                      <span>{formatReportDate(report.created_at)}</span>
                      {report.receipt_id && (
                        <span className="font-mono bg-white/10 px-1 rounded">
                          {report.receipt_id}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMapInner(props: AdminMapProps) {
  if (!getGoogleMapsApiKey()) {
    return <MapsMissingKey label="Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY for the admin map." />;
  }
  return <AdminMapInnerLoaded {...props} />;
}
