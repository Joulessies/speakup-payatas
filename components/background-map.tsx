"use client";

import { MapContainer, TileLayer, Polygon } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { PAYATAS_CENTER, PAYATAS_BOUNDARY } from "@/lib/payatas-boundary";
import { useTheme } from "./theme-provider";

const TILES = {
  dark: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
  light: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
};

export default function BackgroundMap() {
  const { theme } = useTheme();

  const boundaryLatLng = PAYATAS_BOUNDARY.map(
    ([lng, lat]) => [lat, lng] as [number, number],
  );

  const isDark = theme === "dark";

  return (
    <MapContainer
      center={[PAYATAS_CENTER.lat, PAYATAS_CENTER.lng]}
      zoom={15}
      className="w-full h-full"
      zoomControl={false}
      dragging={false}
      scrollWheelZoom={false}
      doubleClickZoom={false}
      touchZoom={false}
      keyboard={false}
      attributionControl={false}
    >
      <TileLayer
        key={theme}
        url={isDark ? TILES.dark : TILES.light}
      />
      <Polygon
        positions={boundaryLatLng}
        pathOptions={{
          color: isDark ? "#6366f1" : "#4f46e5",
          weight: 1.5,
          fillColor: isDark ? "#6366f1" : "#4f46e5",
          fillOpacity: isDark ? 0.06 : 0.08,
          dashArray: "6 4",
        }}
      />
    </MapContainer>
  );
}
