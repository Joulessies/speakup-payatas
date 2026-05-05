import { PAYATAS_BOUNDARY } from "@/lib/payatas-boundary";

export function getGoogleMapsApiKey(): string {
    return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
}

/** Required for AdvancedMarkerElement; use your own Map ID in production ([docs](https://developers.google.com/maps/documentation/javascript/advanced-markers/start)). */
export function getGoogleMapsMapId(): string {
    const id = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID?.trim();
    return id || "DEMO_MAP_ID";
}

export function payatasBoundaryPath(): { lat: number; lng: number }[] {
    return PAYATAS_BOUNDARY.map(([lng, lat]) => ({ lat, lng }));
}

const HIDE_MAP_CLUTTER: google.maps.MapTypeStyle[] = [
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
];

const DARK_STYLES: google.maps.MapTypeStyle[] = [
    ...HIDE_MAP_CLUTTER,
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
        featureType: "administrative.locality",
        elementType: "labels.text.fill",
        stylers: [{ color: "#d59563" }],
    },
    {
        featureType: "road",
        elementType: "geometry",
        stylers: [{ color: "#38414e" }],
    },
    {
        featureType: "road",
        elementType: "geometry.stroke",
        stylers: [{ color: "#212a37" }],
    },
    {
        featureType: "road",
        elementType: "labels.text.fill",
        stylers: [{ color: "#9ca5b3" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry",
        stylers: [{ color: "#746855" }],
    },
    {
        featureType: "road.highway",
        elementType: "geometry.stroke",
        stylers: [{ color: "#1f2835" }],
    },
    {
        featureType: "road.highway",
        elementType: "labels.text.fill",
        stylers: [{ color: "#f3d19c" }],
    },
    {
        featureType: "water",
        elementType: "geometry",
        stylers: [{ color: "#17263c" }],
    },
    {
        featureType: "water",
        elementType: "labels.text.fill",
        stylers: [{ color: "#515c6d" }],
    },
];

export function mapStylesForTheme(isDark: boolean): google.maps.MapTypeStyle[] {
    return isDark ? DARK_STYLES : HIDE_MAP_CLUTTER;
}

/** Full interactions for dedicated map pages (pan, zoom, keyboard, scale, fullscreen). */
export function googleMapPublicPageOptions(isDark: boolean): google.maps.MapOptions {
    return {
        disableDefaultUI: true,
        zoomControl: true,
        fullscreenControl: true,
        streetViewControl: false,
        mapTypeControl: false,
        rotateControl: true,
        scaleControl: true,
        clickableIcons: false,
        keyboardShortcuts: true,
        gestureHandling: "greedy",
        styles: mapStylesForTheme(isDark),
    };
}

/** Embedded admin dashboard map: interactive without fullscreen takeover. */
export function googleMapAdminOptions(isDark: boolean): google.maps.MapOptions {
    return {
        disableDefaultUI: true,
        zoomControl: true,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        rotateControl: false,
        scaleControl: true,
        clickableIcons: false,
        keyboardShortcuts: true,
        gestureHandling: "greedy",
        styles: mapStylesForTheme(isDark),
    };
}

/** Compact map for report form: cooperative gestures play nicer with page scroll on mobile. */
export function googleMapPickerOptions(isDark: boolean): google.maps.MapOptions {
    return {
        mapId: getGoogleMapsMapId(),
        disableDefaultUI: true,
        zoomControl: true,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        rotateControl: false,
        scaleControl: false,
        clickableIcons: false,
        keyboardShortcuts: false,
        gestureHandling: "cooperative",
        minZoom: 13,
        maxZoom: 19,
        styles: mapStylesForTheme(isDark),
    };
}

export function clusterRadiusMeters(count: number): number {
    return Math.min(28 + count * 14, 140);
}

export function clusterFillColor(count: number): string {
    if (count >= 15)
        return "#ef4444";
    if (count >= 10)
        return "#f97316";
    if (count >= 5)
        return "#eab308";
    return "#22c55e";
}
