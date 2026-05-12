"use client";

import { GoogleMap, Polygon } from "@react-google-maps/api";
import { PAYATAS_CENTER } from "@/lib/payatas-boundary";
import { getGoogleMapsApiKey, mapStylesForTheme, payatasBoundaryPath } from "@/lib/payatas-google-maps";
import { usePayatasGoogleMapsLoader } from "@/hooks/use-payatas-google-maps-loader";
import { useGoogleMapsAuthState } from "@/hooks/use-google-maps-auth";
import { useTheme } from "./theme-provider";
import MapsMissingKey from "./maps-missing-key";

function BackgroundMapLoaded() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const { isLoaded, loadError } = usePayatasGoogleMapsLoader();
    const { failed: authFailed, errorCode } = useGoogleMapsAuthState();
    const boundaryPath = payatasBoundaryPath();
    if (authFailed) {
        return <MapsMissingKey reason="auth-failed" errorCode={errorCode}/>;
    }
    if (loadError) {
        return <MapsMissingKey reason="load-error" errorCode={errorCode}/>;
    }
    if (!isLoaded) {
        return <div className="h-full w-full bg-muted/30 animate-pulse"/>;
    }
    return (<GoogleMap mapContainerClassName="w-full h-full" center={PAYATAS_CENTER} zoom={15} options={{
            disableDefaultUI: true,
            zoomControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            mapTypeControl: false,
            clickableIcons: false,
            gestureHandling: "none",
            draggable: false,
            keyboardShortcuts: false,
            scrollwheel: false,
            disableDoubleClickZoom: true,
            styles: mapStylesForTheme(isDark),
        }}>
      <Polygon paths={boundaryPath} options={{
            strokeColor: isDark ? "#6366f1" : "#4f46e5",
            strokeWeight: 0,
            strokeOpacity: 0,
            fillColor: isDark ? "#6366f1" : "#4f46e5",
            fillOpacity: isDark ? 0.06 : 0.08,
        }}/>
    </GoogleMap>);
}

export default function BackgroundMap() {
    if (!getGoogleMapsApiKey()) {
        return <MapsMissingKey/>;
    }
    return <BackgroundMapLoaded/>;
}
