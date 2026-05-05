"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMap, Polygon } from "@react-google-maps/api";
import { PAYATAS_CENTER, isWithinPayatas } from "@/lib/payatas-boundary";
import { getGoogleMapsApiKey, googleMapPickerOptions, payatasBoundaryPath } from "@/lib/payatas-google-maps";
import { usePayatasGoogleMapsLoader } from "@/hooks/use-payatas-google-maps-loader";

interface ReportLocationPickerProps {
    latitude: number | null;
    longitude: number | null;
    isDark: boolean;
    outsideBoundaryWarning: string;
    onLocationChange: (lat: number, lng: number) => void;
    onAdjustPin?: () => void;
}

function readDragPosition(
    pos: google.maps.LatLng | google.maps.LatLngAltitude | google.maps.LatLngLiteral | null | undefined,
): { lat: number; lng: number } | null {
    if (pos == null)
        return null;
    if (typeof (pos as google.maps.LatLng).lat === "function") {
        const p = pos as google.maps.LatLng;
        return { lat: p.lat(), lng: p.lng() };
    }
    const o = pos as google.maps.LatLngLiteral;
    if (typeof o.lat === "number" && typeof o.lng === "number")
        return { lat: o.lat, lng: o.lng };
    return null;
}

/** Draggable pin using AdvancedMarkerElement (replaces deprecated google.maps.Marker). */
function DraggableAdvancedMarker({
    map,
    latitude,
    longitude,
    onDragEnd,
}: {
    map: google.maps.Map;
    latitude: number;
    longitude: number;
    onDragEnd: (lat: number, lng: number) => void;
}) {
    const markerRef = useRef<google.maps.marker.AdvancedMarkerElement | null>(null);
    const onDragEndRef = useRef(onDragEnd);
    onDragEndRef.current = onDragEnd;
    const posRef = useRef({ latitude, longitude });
    posRef.current = { latitude, longitude };

    useEffect(() => {
        if (!map)
            return;
        let cancelled = false;
        let dragListener: google.maps.MapsEventListener | null = null;

        void (async () => {
            const { AdvancedMarkerElement } = (await google.maps.importLibrary(
                "marker",
            )) as google.maps.MarkerLibrary;
            if (cancelled)
                return;
            const { latitude: lat, longitude: lng } = posRef.current;
            const marker = new AdvancedMarkerElement({
                map,
                position: { lat, lng },
                gmpDraggable: true,
            });
            markerRef.current = marker;
            dragListener = marker.addListener("gmp-dragend", () => {
                const ll = readDragPosition(markerRef.current?.position ?? null);
                if (ll)
                    onDragEndRef.current(ll.lat, ll.lng);
            });
        })();

        return () => {
            cancelled = true;
            if (dragListener)
                dragListener.remove();
            if (markerRef.current) {
                markerRef.current.map = null;
                markerRef.current = null;
            }
        };
    }, [map]);

    useEffect(() => {
        const m = markerRef.current;
        if (!m)
            return;
        m.position = { lat: latitude, lng: longitude };
    }, [latitude, longitude]);

    return null;
}

function ReportLocationPickerLoaded({ latitude, longitude, isDark, outsideBoundaryWarning, onLocationChange, onAdjustPin, }: ReportLocationPickerProps) {
    const { isLoaded, loadError } = usePayatasGoogleMapsLoader();
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const boundaryPath = payatasBoundaryPath();

    useEffect(() => {
        if (!map || latitude === null || longitude === null)
            return;
        map.panTo({ lat: latitude, lng: longitude });
    }, [map, latitude, longitude]);

    const handleMarkerDragEnd = useCallback((lat: number, lng: number) => {
        onAdjustPin?.();
        onLocationChange(lat, lng);
    }, [onLocationChange, onAdjustPin]);

    if (loadError)
        return null;
    if (!isLoaded) {
        return <div className="h-[200px] w-full animate-pulse rounded-xl bg-muted/40"/>;
    }
    const showMarker = latitude !== null && longitude !== null;
    const inside = showMarker && isWithinPayatas(latitude, longitude);

    return (<div className="relative h-[200px] w-full overflow-hidden rounded-xl border border-border">
      <GoogleMap mapContainerClassName="h-full w-full" center={showMarker ? { lat: latitude, lng: longitude } : PAYATAS_CENTER} zoom={showMarker ? 17 : 15} options={googleMapPickerOptions(isDark)} onLoad={setMap} onUnmount={() => setMap(null)} onClick={(e) => {
            const ll = e.latLng;
            if (!ll)
                return;
            onAdjustPin?.();
            onLocationChange(ll.lat(), ll.lng());
        }}>
        <Polygon paths={boundaryPath} options={{
                strokeColor: "#6366f1",
                strokeWeight: 0,
                strokeOpacity: 0,
                fillColor: "#6366f1",
                fillOpacity: 0.06,
            }}/>
        {showMarker && map && (<DraggableAdvancedMarker map={map} latitude={latitude} longitude={longitude} onDragEnd={handleMarkerDragEnd}/>)}
      </GoogleMap>
      {showMarker && !inside && (<div className="pointer-events-none absolute bottom-2 left-2 right-2 rounded-lg bg-amber-500/95 px-2 py-1.5 text-center text-[10px] font-medium leading-snug text-amber-950 shadow-sm">
          {outsideBoundaryWarning}
        </div>)}
    </div>);
}

export default function ReportLocationPicker(props: ReportLocationPickerProps) {
    if (!getGoogleMapsApiKey()) {
        return null;
    }
    return <ReportLocationPickerLoaded {...props}/>;
}
