"use client";

export default function MapsMissingKey({ label }: { label?: string }) {
    return (<div className="flex h-full w-full items-center justify-center bg-muted/40 px-4 text-center">
      <p className="max-w-sm text-sm text-muted-foreground">
        {label ?? "Set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to load Google Maps."}
      </p>
    </div>);
}
