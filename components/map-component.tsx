"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const MapInner = dynamic(() => import("./map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-full bg-muted/30">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
});

export default function MapComponent() {
  return <MapInner />;
}
