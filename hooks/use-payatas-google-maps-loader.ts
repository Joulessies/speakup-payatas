"use client";

import { useJsApiLoader } from "@react-google-maps/api";

const libraries = ["marker", "visualization"] as const;

export function usePayatasGoogleMapsLoader() {
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
    return useJsApiLoader({
        id: "speakup-payatas-google-maps",
        googleMapsApiKey,
        libraries,
        preventGoogleFontsLoading: true,
    });
}
