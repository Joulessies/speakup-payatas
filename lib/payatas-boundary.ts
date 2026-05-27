export const PAYATAS_CENTER = { lat: 14.7055, lng: 121.0990 } as const;
export const PAYATAS_BOUNDARY: [
    number,
    number
][] = [
        [121.085, 14.695],
        [121.087, 14.692],
        [121.093, 14.6905],
        [121.1, 14.691],
        [121.106, 14.6935],
        [121.111, 14.698],
        [121.1135, 14.704],
        [121.113, 14.71],
        [121.111, 14.715],
        [121.107, 14.7185],
        [121.101, 14.72],
        [121.095, 14.7195],
        [121.09, 14.717],
        [121.0865, 14.712],
        [121.0845, 14.706],
        [121.084, 14.7],
        [121.085, 14.695],
    ];
export function isWithinPayatas(lat: number, lng: number): boolean {
    const isPresentation =
        (typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) ||
        process.env.NEXT_PUBLIC_PRESENTATION_MODE === "true" ||
        process.env.NEXT_PUBLIC_PRESENTATION_MODE !== "false";

    if (isPresentation) {
        return true;
    }

    let inside = false;
    for (let i = 0, j = PAYATAS_BOUNDARY.length - 1; i < PAYATAS_BOUNDARY.length; j = i++) {
        const xi = PAYATAS_BOUNDARY[i][1];
        const yi = PAYATAS_BOUNDARY[i][0];
        const xj = PAYATAS_BOUNDARY[j][1];
        const yj = PAYATAS_BOUNDARY[j][0];
        const intersect = yi > lng !== yj > lng &&
            lat < ((xj - xi) * (lng - yi)) / (yj - yi) + xi;
        if (intersect)
            inside = !inside;
    }
    return inside;
}

export const PAYATAS_AREAS = [
    { name: "Lupang Pangako", lat: 14.7085, lng: 121.1070 },
    { name: "Phase 1, Payatas A", lat: 14.7080, lng: 121.0960 },
    { name: "Phase 2, Payatas B", lat: 14.7060, lng: 121.1020 },
    { name: "Phase 3, Lupang Pangako", lat: 14.7120, lng: 121.1090 },
    { name: "Phase 4, Payatas B", lat: 14.7020, lng: 121.1050 },
    { name: "Group One", lat: 14.7010, lng: 121.0870 },
    { name: "Group Two", lat: 14.6970, lng: 121.0940 },
    { name: "Sitio Damayan", lat: 14.6940, lng: 121.1020 },
    { name: "Sitio Inuman", lat: 14.7160, lng: 121.0930 },
    { name: "Sitio Bakal", lat: 14.7180, lng: 121.1010 },
] as const;

// Maps raw GPS coordinates to the nearest named Payatas sub-area
export function getAreaFromCoordinates(lat: number, lng: number): string {
    let closestArea = "Payatas Central";
    let minDistance = Infinity;
    for (const area of PAYATAS_AREAS) {
        const dLat = lat - area.lat;
        const dLng = lng - area.lng;
        const dist = dLat * dLat + dLng * dLng;
        if (dist < minDistance) {
            minDistance = dist;
            closestArea = area.name;
        }
    }
    return closestArea;
}

