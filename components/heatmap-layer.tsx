"use client";
import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
declare module "leaflet" {
    function heatLayer(latlngs: [
        number,
        number,
        number?
    ][], options?: {
        radius?: number;
        blur?: number;
        maxZoom?: number;
        max?: number;
        minOpacity?: number;
        gradient?: Record<number, string>;
    }): L.Layer;
}
interface HeatmapLayerProps {
    points: [
        number,
        number,
        number
    ][];
    visible: boolean;
}
export default function HeatmapLayer({ points, visible }: HeatmapLayerProps) {
    const map = useMap();
    useEffect(() => {
        if (!visible || points.length === 0)
            return;
        let heatLayer: L.Layer | null = null;
        try {
            require("leaflet.heat");
            heatLayer = L.heatLayer(points, {
                radius: 30,
                blur: 20,
                maxZoom: 17,
                max: 5,
                minOpacity: 0.4,
                gradient: {
                    0.2: "#22c55e",
                    0.4: "#eab308",
                    0.6: "#f97316",
                    0.8: "#ef4444",
                    1.0: "#dc2626",
                },
            });
            heatLayer.addTo(map);
        }
        catch {
            const group = L.layerGroup();
            for (const [lat, lng, intensity] of points) {
                const normalizedIntensity = Math.min(intensity / 5, 1);
                const color = normalizedIntensity > 0.7
                    ? "#ef4444"
                    : normalizedIntensity > 0.4
                        ? "#f97316"
                        : "#22c55e";
                L.circleMarker([lat, lng], {
                    radius: 15 + normalizedIntensity * 20,
                    fillColor: color,
                    fillOpacity: 0.25,
                    color: "transparent",
                    weight: 0,
                }).addTo(group);
            }
            group.addTo(map);
            heatLayer = group;
        }
        return () => {
            if (heatLayer) {
                map.removeLayer(heatLayer);
            }
        };
    }, [map, points, visible]);
    return null;
}
