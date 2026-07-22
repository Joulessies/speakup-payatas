"use client";
import { useTheme } from "@/components/theme-provider";
import VerificationPanel from "@/components/verification-panel";
import PredictiveAnalytics from "@/components/predictive-analytics";
import BarangaySystemDashboard from "@/components/barangay-system-dashboard";
import { ShieldCheck, TrendingUp } from "lucide-react";

export default function StaffPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#04271e]" : "bg-[#f4fbf7]"}`}>
            <div className="max-w-6xl mx-auto w-full px-4 py-6 md:px-8 md:py-8 space-y-6">
                {/* Staff Dashboard Header */}
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-emerald-500/15" : "bg-[#e6f4ea]"}`}>
                        <ShieldCheck className={`h-6 w-6 ${isDark ? "text-emerald-400" : "text-[#059669]"}`} />
                    </div>
                    <div>
                        <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                            Staff Dashboard
                        </h1>
                        <p className={`text-sm mt-1 ${isDark ? "text-white/60" : "text-[#047857]"}`}>
                            Verify reports, monitor spatial risk hotspots, add internal notes, and update statuses.
                        </p>
                    </div>
                </div>

                <BarangaySystemDashboard isDark={isDark} />

                {/* Spatial Hotspot Risks, Community Trend & Category Trajectory */}
                <div className={`p-4 md:p-6 rounded-2xl border shadow-xl ${isDark ? "bg-[#06382b] border-emerald-500/20" : "bg-[#f4fbf7] border-emerald-200"}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-[#059669]"}`} />
                        <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-emerald-300/70" : "text-[#047857]"}`}>
                            Spatial Hotspot Risks & Category Trajectory
                        </h2>
                    </div>
                    <PredictiveAnalytics isDark={isDark} />
                </div>

                {/* Verification Queue */}
                <div className={`p-4 md:p-6 rounded-2xl border shadow-xl ${isDark ? "bg-[#06382b] border-emerald-500/20" : "bg-[#f4fbf7] border-emerald-200"}`}>
                    <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-emerald-300/70" : "text-[#047857]"}`}>
                        Verification Queue
                    </h2>
                    <VerificationPanel role="staff" />
                </div>
            </div>
        </div>
    );
}
