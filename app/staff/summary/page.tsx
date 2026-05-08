"use client";
import { useEffect, useState } from "react";
import { Loader2, BarChart3, TrendingUp, MapPin, Download, Calendar, ArrowLeft, ArrowRight } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABELS } from "@/types";

interface MonthlyData {
    month: string;
    total: number;
    byCategory: Record<string, number>;
    byArea: Record<string, number>;
    byStatus: Record<string, number>;
    topIssues: { category: string; count: number }[];
    mostAffectedAreas: { area: string; count: number }[];
}

export default function StaffMonthlySummary() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<MonthlyData | null>(null);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        loadMonthlyData();
    }, [currentMonth]);

    const loadMonthlyData = async () => {
        setLoading(true);
        try {
            // Calculate date range for current month view
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth();
            const startDate = new Date(year, month, 1).toISOString();
            const endDate = new Date(year, month + 1, 0).toISOString();

            const res = await fetch(`/api/reports?start_date=${startDate}&end_date=${endDate}&limit=1000`);
            const result = await res.json();
            const reports = result.reports || [];

            // Process data
            const monthData: MonthlyData = {
                month: currentMonth.toLocaleDateString("en-PH", { year: "numeric", month: "long" }),
                total: reports.length,
                byCategory: {},
                byArea: {},
                byStatus: {},
                topIssues: [],
                mostAffectedAreas: [],
            };

            reports.forEach((r: any) => {
                // Category
                const cat = r.category || "other";
                monthData.byCategory[cat] = (monthData.byCategory[cat] || 0) + 1;

                // Status
                const status = r.status || "pending";
                monthData.byStatus[status] = (monthData.byStatus[status] || 0) + 1;

                // Area (approximate from coordinates or use a placeholder)
                const area = r.location_area || "Unknown Area";
                monthData.byArea[area] = (monthData.byArea[area] || 0) + 1;
            });

            // Calculate top issues
            monthData.topIssues = Object.entries(monthData.byCategory)
                .map(([category, count]) => ({ category, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            // Calculate most affected areas
            monthData.mostAffectedAreas = Object.entries(monthData.byArea)
                .map(([area, count]) => ({ area, count }))
                .sort((a, b) => b.count - a.count)
                .slice(0, 5);

            setData(monthData);
        } catch (error) {
            console.error("Failed to load monthly data:", error);
        } finally {
            setLoading(false);
        }
    };

    const exportToPDF = () => {
        // Simplified export - in production, use a PDF library like jsPDF
        const content = `
MONTHLY SUMMARY - ${data?.month}

Total Reports: ${data?.total}

Top Issues:
${data?.topIssues.map((i, idx) => `${idx + 1}. ${CATEGORY_LABELS[i.category as keyof typeof CATEGORY_LABELS] || i.category}: ${i.count} reports`).join("\n")}

Most Affected Areas:
${data?.mostAffectedAreas.map((a, idx) => `${idx + 1}. ${a.area}: ${a.count} reports`).join("\n")}

Status Breakdown:
${Object.entries(data?.byStatus || {}).map(([s, c]) => `- ${s}: ${c}`).join("\n")}
        `;

        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `monthly-summary-${data?.month.toLowerCase().replace(/\s+/g, "-")}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const changeMonth = (offset: number) => {
        const newMonth = new Date(currentMonth);
        newMonth.setMonth(newMonth.getMonth() + offset);
        setCurrentMonth(newMonth);
    };

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-4xl mx-auto w-full px-4 py-6 md:px-8 md:py-10 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-emerald-500/15" : "bg-emerald-50"}`}>
                            <BarChart3 className={`h-6 w-6 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                        </div>
                        <div>
                            <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                                Monthly Summary
                            </h1>
                            <p className={`text-sm mt-1 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Analytics for barangay meeting use.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={exportToPDF}
                        disabled={loading || !data}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                            isDark
                                ? "bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                        }`}
                    >
                        <Download className="h-4 w-4" />
                        Export
                    </button>
                </div>

                {/* Month Selector */}
                <div className={`p-4 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                    <div className="flex items-center justify-between">
                        <button
                            onClick={() => changeMonth(-1)}
                            className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
                        >
                            <ArrowLeft className={`h-5 w-5 ${isDark ? "text-white/60" : "text-gray-600"}`} />
                        </button>
                        <div className="flex items-center gap-2">
                            <Calendar className={`h-5 w-5 ${isDark ? "text-white/60" : "text-gray-600"}`} />
                            <span className={`font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                {data?.month || currentMonth.toLocaleDateString("en-PH", { year: "numeric", month: "long" })}
                            </span>
                        </div>
                        <button
                            onClick={() => changeMonth(1)}
                            className={`p-2 rounded-lg transition-colors ${isDark ? "hover:bg-white/10" : "hover:bg-gray-100"}`}
                        >
                            <ArrowRight className={`h-5 w-5 ${isDark ? "text-white/60" : "text-gray-600"}`} />
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                    </div>
                ) : data ? (
                    <>
                        {/* Total Reports */}
                        <div className={`p-6 rounded-2xl border ${isDark ? "bg-indigo-500/10 border-indigo-500/20" : "bg-indigo-50 border-indigo-100"}`}>
                            <div className="flex items-center gap-4">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-indigo-500/20" : "bg-indigo-100"}`}>
                                    <TrendingUp className={`h-7 w-7 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                                </div>
                                <div>
                                    <p className={`text-sm ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>Total Reports</p>
                                    <p className={`text-3xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>{data.total}</p>
                                </div>
                            </div>
                        </div>

                        {/* Top Issues */}
                        <div className={`p-4 md:p-6 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                            <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Top Issues
                            </h2>
                            {data.topIssues.length > 0 ? (
                                <div className="space-y-3">
                                    {data.topIssues.map((issue, idx) => (
                                        <div key={issue.category} className="flex items-center gap-3">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                                                idx === 0 ? (isDark ? "bg-amber-500/20 text-amber-400" : "bg-amber-100 text-amber-700")
                                                : idx === 1 ? (isDark ? "bg-gray-500/20 text-gray-400" : "bg-gray-200 text-gray-700")
                                                : idx === 2 ? (isDark ? "bg-orange-500/20 text-orange-400" : "bg-orange-100 text-orange-700")
                                                : (isDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-600")
                                            }`}>
                                                {idx + 1}
                                            </span>
                                            <div className="flex-1">
                                                <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>
                                                    {CATEGORY_LABELS[issue.category as keyof typeof CATEGORY_LABELS] || issue.category}
                                                </p>
                                            </div>
                                            <Badge variant="outline" className={isDark ? "border-white/10 text-white/70" : ""}>
                                                {issue.count} reports
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>No reports for this month.</p>
                            )}
                        </div>

                        {/* Most Affected Areas */}
                        <div className={`p-4 md:p-6 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                            <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Most Affected Areas
                            </h2>
                            {data.mostAffectedAreas.length > 0 ? (
                                <div className="space-y-3">
                                    {data.mostAffectedAreas.map((area, idx) => (
                                        <div key={area.area} className="flex items-center gap-3">
                                            <MapPin className={`h-4 w-4 ${isDark ? "text-white/40" : "text-gray-400"}`} />
                                            <div className="flex-1">
                                                <p className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}>{area.area}</p>
                                            </div>
                                            <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                                {area.count} reports
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>No area data available.</p>
                            )}
                        </div>

                        {/* Status Breakdown */}
                        <div className={`p-4 md:p-6 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                            <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Status Breakdown
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {Object.entries(data.byStatus).map(([status, count]) => (
                                    <div key={status} className={`p-3 rounded-xl ${isDark ? "bg-white/[0.02]" : "bg-gray-50"}`}>
                                        <p className={`text-xs capitalize ${isDark ? "text-white/60" : "text-gray-600"}`}>{status.replace("_", " ")}</p>
                                        <p className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{count}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className={`p-8 text-center rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                        <p className={`text-sm ${isDark ? "text-white/40" : "text-gray-500"}`}>No data available for this month.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
