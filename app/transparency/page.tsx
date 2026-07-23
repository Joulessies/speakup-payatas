"use client";
import TransparencyBoard from "@/components/transparency-board";
import { Eye, ShieldCheck } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

export default function TransparencyPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#04271e]" : "bg-[#f4fbf7]"}`}>
            <div className="max-w-6xl mx-auto w-full px-4 py-8 md:px-8 md:py-12 space-y-8">
                <div className="text-center max-w-2xl mx-auto space-y-4">
                    <div className="flex items-center justify-center gap-2 mb-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${isDark ? "bg-emerald-500/20 border-emerald-500/30" : "bg-[#e6f4ea] border-emerald-200"}`}>
                            <Eye className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-[#059669]"}`} />
                        </div>
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center border ${isDark ? "bg-emerald-500/20 border-emerald-500/30" : "bg-[#e6f4ea] border-emerald-200"}`}>
                            <ShieldCheck className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-[#059669]"}`} />
                        </div>
                    </div>
                    <h1 className={`text-3xl md:text-4xl font-bold tracking-tight ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                        Public Transparency Board
                    </h1>
                    <p className={`leading-relaxed ${isDark ? "text-white/60" : "text-[#047857]"}`}>
                        Track how the barangay is resolving community issues. This board displays all successfully resolved reports. For privacy, reporter identities and exact coordinates are hidden.
                    </p>
                </div>

                <TransparencyBoard />
            </div>
        </div>
    );
}
