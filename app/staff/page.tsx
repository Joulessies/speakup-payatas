"use client";
import { useTheme } from "@/components/theme-provider";
import VerificationPanel from "@/components/verification-panel";
import { ShieldCheck } from "lucide-react";

export default function StaffPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-4xl mx-auto w-full px-4 py-6 md:px-8 md:py-10 space-y-6">
                <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-indigo-500/15" : "bg-indigo-50"}`}>
                        <ShieldCheck className={`h-6 w-6 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                    </div>
                    <div>
                        <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                            Staff Dashboard
                        </h1>
                        <p className={`text-sm mt-1 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                            Verify reports, add internal notes, and update statuses.
                        </p>
                    </div>
                </div>

                <div className={`p-4 md:p-6 rounded-2xl border shadow-xl ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                    <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                        Verification Queue
                    </h2>
                    <VerificationPanel role="staff" />
                </div>
            </div>
        </div>
    );
}
