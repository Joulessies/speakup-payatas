"use client";

import ReportForm from "@/components/report-form";
import BackgroundMapWrapper from "@/components/background-map-wrapper";
import { useTheme } from "@/components/theme-provider";
import { ShieldCheck } from "lucide-react";

export default function HomePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="relative flex h-full min-h-0 w-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <BackgroundMapWrapper />
      </div>

      <div
        className={`absolute inset-0 z-[1] pointer-events-none ${isDark
          ? "bg-gradient-to-b md:bg-gradient-to-r from-black/85 via-black/60 to-black/20"
          : "bg-gradient-to-b md:bg-gradient-to-r from-white/90 via-white/70 to-white/20"
          }`}
      />

      <div className="relative z-[2] flex h-full min-h-0 w-full flex-col justify-start md:justify-center md:max-w-xl px-4 py-4 md:px-12 md:py-8 overflow-hidden">
        <div className="flex flex-col gap-2 mb-6 md:mb-8">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl backdrop-blur-sm border ${isDark
                ? "bg-indigo-500/20 border-indigo-500/30"
                : "bg-indigo-500/10 border-indigo-500/20"
                }`}
            >
              <ShieldCheck
                className={`h-4 w-4 md:h-5 md:w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}
              />
            </div>
            <h1
              className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}
            >
              SpeakUp Payatas
            </h1>
          </div>
          <p
            className={`text-xs md:text-sm max-w-sm leading-relaxed ${isDark ? "text-white/60" : "text-gray-500"}`}
          >
            Report incidents anonymously. Your identity is protected with
            SHA-256 encryption. Reports sync automatically when you&apos;re back
            online.
          </p>
        </div>

        <div className="origin-top md:origin-top-left max-[900px]:scale-[0.94] max-[800px]:scale-[0.88]">
          <ReportForm />
        </div>
      </div>
    </div>
  );
}
