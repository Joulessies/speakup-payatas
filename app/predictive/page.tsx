"use client";
import { useTheme } from "@/components/theme-provider";
import PredictiveAnalytics from "@/components/predictive-analytics";
import { TrendingUp } from "lucide-react";

export default function PredictiveAnalyticsPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0d1b2e]" : "bg-[#f0f4f8]"}`}>
            <div className="max-w-4xl mx-auto w-full px-4 py-6 md:px-8 md:py-10 space-y-6">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isDark ? "bg-blue-500/15 border-blue-500/20" : "bg-[#e8f0fb] border-[#c8d6e8]"}`}>
                        <TrendingUp className={`h-5 w-5 ${isDark ? "text-blue-400" : "text-[#1a4fad]"}`} />
                    </div>
                    <div>
                        <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                            System Analytics
                        </h1>
                        <p className={`text-sm mt-0.5 ${isDark ? "text-white/45" : "text-[#4a6080]"}`}>
                            Algorithm-based spatial analysis & trend forecasting
                        </p>
                    </div>
                </div>

                <div className={`rounded-xl border overflow-hidden p-5 md:p-6 ${isDark ? "bg-[#112240] border-white/[0.07]" : "bg-white border-[#c8d6e8]"}`}>
                    <PredictiveAnalytics isDark={isDark} />
                </div>
            </div>
        </div>
    );
}
