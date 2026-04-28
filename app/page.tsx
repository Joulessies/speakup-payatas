"use client";
import ReportForm from "@/components/report-form";
import BackgroundMapWrapper from "@/components/background-map-wrapper";
import { useTheme } from "@/components/theme-provider";
import { ShieldCheck } from "lucide-react";
export default function HomePage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    return (<div className="relative flex h-full min-h-0 w-full overflow-hidden">
      <div className="absolute inset-0 z-0">
        <BackgroundMapWrapper />
      </div>

      <div className={`absolute inset-0 z-[1] pointer-events-none ${isDark
            ? "bg-gradient-to-b md:bg-gradient-to-r from-black/85 via-black/60 to-black/20"
            : "bg-gradient-to-b md:bg-gradient-to-r from-white/90 via-white/70 to-white/20"}`}/>

      <div className="relative z-[2] h-full w-full overflow-y-auto">
        <div className="flex min-h-full w-full items-start xl:items-center px-3 py-3 sm:px-4 sm:py-4 lg:px-8 lg:py-6">
          <div className="w-full max-w-md lg:max-w-lg xl:max-w-xl">
            <div className="flex flex-col gap-1.5 mb-3 sm:mb-4 lg:mb-6">
          <div className="flex items-center gap-2.5">
            <div className={`flex items-center justify-center w-9 h-9 md:w-10 md:h-10 rounded-xl backdrop-blur-sm border ${isDark
            ? "bg-indigo-500/20 border-indigo-500/30"
            : "bg-indigo-500/10 border-indigo-500/20"}`}>
              <ShieldCheck className={`h-4 w-4 md:h-5 md:w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`}/>
            </div>
            <h1 className={`text-lg md:text-xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
              SpeakUp Payatas
            </h1>
          </div>
          <p className={`text-xs md:text-sm max-w-md leading-relaxed ${isDark ? "text-white/60" : "text-gray-500"}`}>
            Report incidents anonymously. Your identity is protected with
            SHA-256 encryption. Reports sync automatically when you&apos;re back
            online.
          </p>
            </div>

            <ReportForm />
          </div>
        </div>
      </div>
    </div>);
}
