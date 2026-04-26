"use client";

import ReportForm from "@/components/report-form";
import BackgroundMapWrapper from "@/components/background-map-wrapper";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
import LanguageToggle from "@/components/language-toggle";
import { ShieldCheck, MapPin } from "lucide-react";

export default function HomePage() {
  const { theme } = useTheme();
  const { t } = useLanguage();
  const isDark = theme === "dark";

  return (
    <div className="relative flex flex-1 overflow-hidden">
      {/* Full-screen map background */}
      <div className="absolute inset-0 z-0">
        <BackgroundMapWrapper />
      </div>

      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 z-[1] pointer-events-none ${
          isDark
            ? "bg-gradient-to-b from-black/90 via-black/75 to-black/40 md:bg-gradient-to-r md:from-black/85 md:via-black/60 md:to-black/20"
            : "bg-gradient-to-b from-white/95 via-white/80 to-white/40 md:bg-gradient-to-r md:from-white/90 md:via-white/70 md:to-white/20"
        }`}
      />

      {/* Scrollable content area */}
      <div className="relative z-[2] flex flex-col w-full md:max-w-xl overflow-y-auto">
        {/* Desktop hero — shown above form on desktop */}
        <div className="hidden md:block px-10 pt-12 pb-4">
          <h1 className={`text-2xl font-bold tracking-tight mb-1.5 ${isDark ? "text-white" : "text-gray-900"}`}>
            {t.brandName}
          </h1>
          <p className={`text-sm leading-relaxed max-w-sm ${isDark ? "text-white/50" : "text-gray-500"}`}>
            {t.brandDescription}
          </p>
        </div>

        {/* Header — mobile only */}
        <div className="px-5 pt-5 pb-3 md:hidden">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-xl backdrop-blur-sm border ${
                  isDark
                    ? "bg-indigo-500/20 border-indigo-500/30"
                    : "bg-indigo-500/10 border-indigo-500/20"
                }`}
              >
                <ShieldCheck
                  className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
                />
              </div>
              <div>
                <h1
                  className={`text-lg font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}
                >
                  {t.brandName}
                </h1>
                <p
                  className={`text-[11px] ${isDark ? "text-white/40" : "text-gray-400"}`}
                >
                  <MapPin className="inline h-3 w-3 -mt-0.5 mr-0.5" />
                  {t.brandLocation}
                </p>
              </div>
            </div>
            <LanguageToggle />
          </div>
          <p
            className={`text-xs leading-relaxed max-w-sm ${isDark ? "text-white/50" : "text-gray-500"}`}
          >
            {t.brandDescription}
          </p>
        </div>

        {/* Form section */}
        <div className="px-4 pb-6 md:px-10 md:pb-10 flex-1">
          <ReportForm />
        </div>
      </div>
    </div>
  );
}
