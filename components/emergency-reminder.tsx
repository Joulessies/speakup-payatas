"use client";
import { AlertTriangle, Phone } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function EmergencyReminder({ compact = false }: { compact?: boolean }) {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    if (compact) {
        return (
            <div className={`flex items-start gap-2 px-3 py-2 rounded-xl text-[11px] leading-relaxed ${
                isDark ? "bg-amber-500/8 border border-amber-500/15 text-amber-300/80" : "bg-amber-50 border border-amber-200 text-amber-800"
            }`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                    <strong>Not for emergencies.</strong> For fire, crime, or medical emergencies, call <strong>911</strong> or your Barangay Emergency Hotline.
                </span>
            </div>
        );
    }

    return (
        <div className={`rounded-2xl border p-4 space-y-3 ${
            isDark ? "bg-amber-500/[0.06] border-amber-500/15" : "bg-amber-50 border-amber-200"
        }`}>
            <div className="flex items-center gap-2">
                <AlertTriangle className={`h-5 w-5 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                <h3 className={`text-sm font-semibold ${isDark ? "text-amber-300" : "text-amber-800"}`}>
                    This System is NOT for Emergencies
                </h3>
            </div>
            <p className={`text-xs leading-relaxed ${isDark ? "text-amber-300/70" : "text-amber-700"}`}>
                SpeakUp is for <strong>complaints and non-emergency reports</strong> only (sanitation, noise, drainage, infrastructure issues, fire <em>hazards/risks</em>, etc.).
            </p>
            <div className={`flex flex-col gap-1.5 text-xs ${isDark ? "text-amber-300/60" : "text-amber-700/80"}`}>
                <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>QC Central Emergency Hotline: <strong>Call 122</strong> or <strong>911</strong></span>
                </div>
                <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>Barangay Payatas Emergency: <strong>(02) 8350-4756</strong></span>
                </div>
                <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 shrink-0" />
                    <span>QCDRRMO / Disaster Response: <strong>(02) 8927-5914</strong></span>
                </div>
            </div>
        </div>
    );
}
