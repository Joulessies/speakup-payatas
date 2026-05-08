"use client";
import { useEffect, useState } from "react";
import { Loader2, LayoutDashboard, FileWarning, CheckCircle2, Clock, ShieldAlert, BarChart3, Download } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/types";

interface ReportSummary {
    id: string;
    category: string;
    status: string;
    verification_status: string;
    created_at: string;
    description: string;
    receipt_id?: string;
}

interface SummaryStats {
    total: number;
    unreviewed: number;
    valid: number;
    spam: number;
    duplicate: number;
    byCategory: Record<string, number>;
}

export default function StaffDashboard() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [stats, setStats] = useState<SummaryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch recent reports
            const res = await fetch("/api/reports?limit=100");
            const data = await res.json();
            const reports = data.reports ?? [];
            setReports(reports);

            // Calculate stats
            const stats: SummaryStats = {
                total: reports.length,
                unreviewed: reports.filter((r: ReportSummary) => r.verification_status === "unreviewed").length,
                valid: reports.filter((r: ReportSummary) => r.verification_status === "valid").length,
                spam: reports.filter((r: ReportSummary) => r.verification_status === "spam").length,
                duplicate: reports.filter((r: ReportSummary) => r.verification_status === "duplicate").length,
                byCategory: {},
            };

            reports.forEach((r: ReportSummary) => {
                const cat = r.category || "other";
                stats.byCategory[cat] = (stats.byCategory[cat] || 0) + 1;
            });

            setStats(stats);
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const exportToCSV = () => {
        setExporting(true);
        try {
            const headers = ["ID", "Category", "Status", "Verification", "Created At", "Description", "Receipt ID"];
            const rows = reports.map((r) => [
                r.id,
                r.category,
                r.status,
                r.verification_status,
                new Date(r.created_at).toISOString(),
                r.description?.replace(/,/g, ";") || "",
                r.receipt_id || "",
            ]);

            const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `reports-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-6xl mx-auto w-full px-4 py-6 md:px-8 md:py-10 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-indigo-500/15" : "bg-indigo-50"}`}>
                            <LayoutDashboard className={`h-6 w-6 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                        </div>
                        <div>
                            <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                                Staff Dashboard
                            </h1>
                            <p className={`text-sm mt-1 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Overview of reports and verification status.
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={exportToCSV}
                        disabled={exporting || loading}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                            isDark
                                ? "bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white"
                                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                        }`}
                    >
                        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Export CSV
                    </button>
                </div>

                {/* Stats Grid */}
                {loading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                        <div className={`p-4 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>Total Reports</span>
                            <p className={`text-2xl font-bold mt-1 ${isDark ? "text-white" : "text-gray-900"}`}>{stats.total}</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-100"}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-amber-400" : "text-amber-600"}`}>Unreviewed</span>
                            <p className={`text-2xl font-bold mt-1 text-amber-500`}>{stats.unreviewed}</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>Valid</span>
                            <p className={`text-2xl font-bold mt-1 text-emerald-500`}>{stats.valid}</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? "bg-red-500/10 border-red-500/20" : "bg-red-50 border-red-100"}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-red-400" : "text-red-600"}`}>Spam</span>
                            <p className={`text-2xl font-bold mt-1 text-red-500`}>{stats.spam}</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? "bg-blue-500/10 border-blue-500/20" : "bg-blue-50 border-blue-100"}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-blue-400" : "text-blue-600"}`}>Duplicate</span>
                            <p className={`text-2xl font-bold mt-1 text-blue-500`}>{stats.duplicate}</p>
                        </div>
                    </div>
                ) : null}

                {/* Category Breakdown */}
                {stats && Object.keys(stats.byCategory).length > 0 && (
                    <div className={`p-4 md:p-6 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                        <h2 className={`text-sm font-semibold uppercase tracking-wider mb-4 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                            Reports by Category
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {Object.entries(stats.byCategory).map(([category, count]) => (
                                <div key={category} className={`p-3 rounded-xl ${isDark ? "bg-white/[0.02]" : "bg-gray-50"}`}>
                                    <span className={`text-[11px] ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                        {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] || category}
                                    </span>
                                    <p className={`text-lg font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>{count}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quick Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Link
                        href="/staff"
                        className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${
                            isDark
                                ? "bg-indigo-500/10 border-indigo-500/20 hover:bg-indigo-500/20"
                                : "bg-indigo-50 border-indigo-100 hover:bg-indigo-100"
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-indigo-500/20" : "bg-indigo-100"}`}>
                            <FileWarning className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                        </div>
                        <div>
                            <h3 className={`font-semibold ${isDark ? "text-indigo-300" : "text-indigo-700"}`}>Verification Queue</h3>
                            <p className={`text-xs ${isDark ? "text-indigo-400/70" : "text-indigo-600/70"}`}>Review and verify pending reports</p>
                        </div>
                    </Link>
                    <Link
                        href="/staff/summary"
                        className={`p-4 rounded-2xl border flex items-center gap-4 transition-colors ${
                            isDark
                                ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-emerald-50 border-emerald-100 hover:bg-emerald-100"
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
                            <BarChart3 className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                        </div>
                        <div>
                            <h3 className={`font-semibold ${isDark ? "text-emerald-300" : "text-emerald-700"}`}>Monthly Summary</h3>
                            <p className={`text-xs ${isDark ? "text-emerald-400/70" : "text-emerald-600/70"}`}>Analytics for barangay meetings</p>
                        </div>
                    </Link>
                </div>
            </div>
        </div>
    );
}
