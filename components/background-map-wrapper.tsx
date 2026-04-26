"use client";

import dynamic from "next/dynamic";
import { useTheme } from "./theme-provider";

const BackgroundMap = dynamic(() => import("./background-map"), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#0a0a14]" />,
});

export default function BackgroundMapWrapper() {
  const { theme } = useTheme();
  return (
    <div className={`w-full h-full ${theme === "dark" ? "bg-[#0a0a14]" : "bg-[#f0f0f5]"}`}>
      <BackgroundMap />
    </div>
  );
}
