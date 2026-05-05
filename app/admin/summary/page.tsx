"use client";
import { useState, useEffect } from "react";
import { Loader2, Download, Calendar, BarChart3, MapPin, ShieldAlert, CheckCircle2 } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { CATEGORY_LABELS, type MonthlySummary } from "@/types";

export default function SummaryPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [summary, setSummary] = useState<MonthlySummary | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/summary");
                const data = await res.json();
                setSummary(data);
            } catch { }
            finally { setLoading(false); }
        })();
    }, []);

    const handlePrint = () => {
        window.print();
    };

    const exportCSV = () => {
        if (!summary) return;

        let csv = "SpeakUp Payatas - Monthly Summary\n";
        csv += `Month,${summary.month}\n\n`;

        csv += "METRICS\n";
        csv += "Total Reports,Resolved,Valid Reports,Resolution Rate\n";
        csv += `${summary.total_reports},${summary.resolved_count},${summary.valid_count},${summary.resolution_rate}%\n\n`;

        csv += "TOP CATEGORIES\n";
        csv += "Category,Count\n";
        summary.top_categories.forEach(c => {
            csv += `${CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] || c.category},${c.count}\n`;
        });
        csv += "\n";

        csv += "HOTSPOTS (Most Affected Areas)\n";
        csv += "Latitude,Longitude,Report Count,Top Issue\n";
        summary.most_affected_areas.forEach(area => {
            csv += `${area.latitude.toFixed(5)},${area.longitude.toFixed(5)},${area.count},${CATEGORY_LABELS[area.top_category as keyof typeof CATEGORY_LABELS] || area.top_category}\n`;
        });

        const blob = new Blob([csv], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `speakup-payatas-summary-${summary.month.replace(" ", "-").toLowerCase()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) {
        return (
            <div className={`flex flex-1 items-center justify-center ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
                <Loader2 className="h-8 w-8 animate-spin opacity-50" />
            </div>
        );
    }

    if (!summary) return null;

    return (
        <div className={`flex flex-col h-full overflow-y-auto print:bg-white ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-4xl mx-auto w-full px-4 py-8 md:px-8 space-y-8 print:p-0 print:space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-4 print:border-b print:pb-4 print:border-black">
                    <div>
                        <h1 className={`text-2xl md:text-3xl font-bold tracking-tight print:text-black ${isDark ? "text-white" : "text-gray-900"}`}>
                            Barangay Monthly Report
                        </h1>
                        <div className="flex items-center gap-2 mt-2 text-sm print:text-black">
                            <Calendar className="h-4 w-4" />
                            <span className={isDark ? "text-white/60" : "text-gray-600"}>
                                Month: {summary.month}
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-2 print:hidden">
                        <button
                            onClick={exportCSV}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-white border text-gray-900 hover:bg-gray-50"}`}
                        >
                            <Download className="h-4 w-4" /> Export CSV
                        </button>
                        <button
                            onClick={handlePrint}
                            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${isDark ? "bg-white/10 text-white hover:bg-white/20" : "bg-white border text-gray-900 hover:bg-gray-50"}`}
                        >
                            <Download className="h-4 w-4" /> Export PDF
                        </button>
                    </div>
                </div>

                {/* Key Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:grid-cols-4 print:gap-4">
                    {[
                        { label: "Total Reports", value: summary.total_reports, icon: BarChart3, color: "text-blue-500" },
                        { label: "Resolved", value: summary.resolved_count, icon: CheckCircle2, color: "text-emerald-500" },
                        { label: "Valid Reports", value: summary.valid_count, icon: ShieldAlert, color: "text-amber-500" },
                        { label: "Resolution Rate", value: `${summary.resolution_rate}%`, icon: BarChart3, color: "text-indigo-500" },
                    ].map((m, i) => (
                        <div key={i} className={`p-4 rounded-2xl border print:border-black/20 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-100"}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <m.icon className={`h-4 w-4 ${m.color}`} />
                                <span className={`text-[10px] uppercase tracking-wider font-semibold print:text-black ${isDark ? "text-white/50" : "text-gray-500"}`}>{m.label}</span>
                            </div>
                            <span className={`text-2xl font-bold print:text-black ${isDark ? "text-white" : "text-gray-900"}`}>{m.value}</span>
                        </div>
                    ))}
                </div>

                {/* Top Categories */}
                <div className={`p-6 rounded-2xl border print:border-black/20 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-100"}`}>
                    <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 print:text-black ${isDark ? "text-white/45" : "text-gray-500"}`}>
                        Top Issues by Category
                    </h2>
                    <div className="space-y-4">
                        {summary.top_categories.map((c, i) => {
                            const pct = summary.total_reports > 0 ? (c.count / summary.total_reports) * 100 : 0;
                            return (
                                <div key={i} className="flex items-center gap-4">
                                    <span className={`w-32 text-sm font-medium truncate print:text-black ${isDark ? "text-white/80" : "text-gray-800"}`}>
                                        {CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] || c.category}
                                    </span>
                                    <div className="flex-1 h-2.5 rounded-full overflow-hidden bg-gray-100 dark:bg-white/10 print:bg-gray-200">
                                        <div className="h-full bg-indigo-500 print:bg-black print:text-white" style={{ width: `${pct}%` }} />
                                    </div>
                                    <span className={`w-12 text-right text-sm font-mono print:text-black ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                        {c.count}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Most Affected Areas */}
                <div className={`p-6 rounded-2xl border print:border-black/20 ${isDark ? "bg-white/[0.03] border-white/10" : "bg-white border-gray-100"}`}>
                    <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 print:text-black ${isDark ? "text-white/45" : "text-gray-500"}`}>
                        Most Affected Areas (Hotspots)
                    </h2>
                    <div className="space-y-3">
                        {summary.most_affected_areas.map((area, i) => (
                            <div key={i} className={`flex items-center justify-between p-3 rounded-xl border print:border-black/10 ${isDark ? "bg-white/[0.02] border-white/[0.06]" : "bg-gray-50 border-gray-100"}`}>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/10 text-indigo-500 print:text-black font-bold text-sm">
                                        #{i + 1}
                                    </div>
                                    <div>
                                        <p className={`text-sm font-medium flex items-center gap-1 print:text-black ${isDark ? "text-white/90" : "text-gray-900"}`}>
                                            <MapPin className="h-3 w-3" /> {area.latitude.toFixed(4)}, {area.longitude.toFixed(4)}
                                        </p>
                                        <p className={`text-xs mt-0.5 print:text-black ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                            Top issue: {CATEGORY_LABELS[area.top_category as keyof typeof CATEGORY_LABELS] || area.top_category}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className={`text-lg font-bold print:text-black ${isDark ? "text-white" : "text-gray-900"}`}>{area.count}</span>
                                    <span className={`block text-[10px] uppercase tracking-wide print:text-black ${isDark ? "text-white/40" : "text-gray-500"}`}>Reports</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Print Footer */}
                <div className="hidden print:block mt-12 pt-8 border-t border-black text-center text-xs">
                    <p>Generated by SpeakUp Payatas System • {new Date().toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    );
}
