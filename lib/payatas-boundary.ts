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
