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
            location: { lat, lng },
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
    if (loadError) {
        return (<div className="flex h-full w-full items-center justify-center bg-muted/40">
          <p className="text-sm text-destructive">Could not load Google Maps.</p>
        </div>);
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
            <div className="min-w-[140px] space-y-1 text-sm">
              <p className="font-semibold">
                {selected.count} report{selected.count !== 1 ? "s" : ""}
              </p>
              {Object.entries(selected.category_breakdown).map(([cat, count]) => (<p key={cat} className="text-xs capitalize text-gray-600">
                    {cat}: {count}
                  </p>))}
              <p className="font-mono text-xs text-gray-400">
                {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}
              </p>
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
