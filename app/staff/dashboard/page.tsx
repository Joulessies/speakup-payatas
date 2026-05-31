"use client";
import { useEffect, useState, useMemo } from "react";
import { Loader2, LayoutDashboard, FileWarning, CheckCircle2, Clock, ShieldAlert, BarChart3, Download } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CATEGORY_LABELS } from "@/types";
import dynamic from "next/dynamic";

interface TrendPoint {
    date: string;
    count: number;
    categories: Record<string, number>;
}

const CATEGORY_COLORS: Record<string, string> = {
    flooding: "#60a5fa", fire: "#fb923c", crime: "#f87171",
    infrastructure: "#fbbf24", health: "#f472b6",
    environmental: "#34d399", other: "#9ca3af",
};

const AdminMapInner = dynamic(() => import("@/components/admin-map-inner"), {
    ssr: false,
    loading: () => <div className="h-[350px] w-full flex items-center justify-center bg-zinc-950/20 border border-white/5 rounded-2xl animate-pulse text-xs text-white/30">Loading Hotspot Map...</div>,
});

function LineChart({ data, isDark }: { data: TrendPoint[]; isDark: boolean }) {
    if (!data || data.length < 2) return (
        <div className={`h-32 flex items-center justify-center text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
            Not enough data to display trend
        </div>
    );
    const maxCount = Math.max(...data.map((d) => d.count), 1);
    const width = 100;
    const height = 60;
    const points = data.map((d, i) => ({
        x: (i / (data.length - 1)) * width,
        y: height - (d.count / maxCount) * height * 0.85,
        count: d.count,
        date: d.date,
    }));
    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const fillD = `${pathD} L ${points[points.length - 1].x} ${height} L 0 ${height} Z`;

    return (
        <div className="w-full">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-32" preserveAspectRatio="none">
                <defs>
                    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                    </linearGradient>
                </defs>
                <path d={fillD} fill="url(#lineGrad)" />
                <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round" />
                {points.map((p, i) => (
                    <circle key={i} cx={p.x} cy={p.y} r="1" fill="#6366f1" />
                ))}
            </svg>
            <div className="flex justify-between mt-1 px-1">
                <span className={`text-[9px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    {new Date(data[0].date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                </span>
                <span className={`text-[9px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    {new Date(data[data.length - 1].date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                </span>
            </div>
        </div>
    );
}

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

    // Map and analytics states
    const [clusters, setClusters] = useState<any[]>([]);
    const [heatPoints, setHeatPoints] = useState<any[]>([]);
    const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
    const [analytics, setAnalytics] = useState<any | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);

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

            // Fetch clusters for maps
            try {
                const clustersRes = await fetch("/api/clusters", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ window: "30d" }),
                });
                const clustersData = await clustersRes.json();
                setClusters(clustersData.clusters ?? []);
                setHeatPoints(clustersData.heat_points ?? []);
            } catch (err) {
                console.error("Failed to load clusters for staff dashboard", err);
            }

            // Fetch analytics trend for line graphs
            try {
                const analyticsRes = await fetch("/api/analytics", { method: "POST" });
                if (analyticsRes.ok) {
                    const json = await analyticsRes.json();
                    setAnalytics(json);
                }
            } catch (err) {
                console.error("Failed to load analytics for staff dashboard", err);
            } finally {
                setAnalyticsLoading(false);
            }
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            setLoading(false);
        }
    };

    const selectedCluster = useMemo(() => {
        if (selectedClusterId === null) return null;
        const idx = clusters.findIndex(
            (c) => `${c.latitude.toFixed(6)}_${c.longitude.toFixed(6)}` === selectedClusterId
        );
        return idx !== -1 ? idx : null;
    }, [clusters, selectedClusterId]);

    const handleClusterClick = (idx: number | null) => {
        if (idx === null) {
            setSelectedClusterId(null);
        } else {
            const c = clusters[idx];
            setSelectedClusterId(c ? `${c.latitude.toFixed(6)}_${c.longitude.toFixed(6)}` : null);
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

                {/* Hotspot Map & Analytics Dashboard */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Hotspot Map Card */}
                    <div className={`p-4 md:p-6 rounded-2xl border flex flex-col ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                        <div className="mb-4">
                            <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Active Hotspot Risk Map (Payatas-A)
                            </h2>
                            <p className={`text-xs mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                                DBSCAN-clustered risk assessments based on local resident reports.
                            </p>
                        </div>
                        <div className="h-[350px] w-full rounded-xl overflow-hidden relative border border-white/[0.06]">
                            <AdminMapInner
                                clusters={clusters}
                                selectedCluster={selectedCluster}
                                onClusterClick={handleClusterClick}
                                showHeatmap={false}
                                heatPoints={heatPoints}
                            />
                        </div>
                        {selectedCluster !== null && clusters[selectedCluster] && (
                            <div className={`mt-3 p-3 rounded-xl border text-xs leading-relaxed ${isDark ? "bg-indigo-500/5 border-indigo-500/20" : "bg-indigo-50/50 border-indigo-100"}`}>
                                <h4 className="font-bold text-indigo-400">
                                    Cluster Details — {clusters[selectedCluster].count} reports
                                </h4>
                                <p className={`mt-1 ${isDark ? "text-white/70" : "text-gray-600"}`}>
                                    Top Category: <span className="capitalize font-semibold">{
                                        Object.entries(clusters[selectedCluster].category_breakdown).sort((a, b) => b[1] - a[1])[0]?.[0] || "Mixed"
                                    }</span>
                                </p>
                                <p className={`mt-0.5 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                                    Coordinates: {clusters[selectedCluster].latitude.toFixed(5)}, {clusters[selectedCluster].longitude.toFixed(5)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Analytics Trend & Distribution */}
                    <div className={`p-4 md:p-6 rounded-2xl border flex flex-col justify-between ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                        <div>
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                        Report Frequency Trend
                                    </h2>
                                    <p className={`text-xs mt-1 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                                        Volume of reports submitted in the last 14 days.
                                    </p>
                                </div>
                            </div>
                            {analyticsLoading ? (
                                <div className="h-32 flex items-center justify-center">
                                    <Loader2 className="h-5 w-5 animate-spin opacity-45" />
                                </div>
                            ) : (
                                <LineChart data={analytics?.trend_data ?? []} isDark={isDark} />
                            )}
                        </div>

                        <div className="mt-6 pt-4 border-t border-dashed border-border/50">
                            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Primary Incident Types
                            </h3>
                            {analytics && Object.keys(analytics.category_distribution ?? {}).length > 0 ? (
                                <div className="space-y-2">
                                    {Object.entries(analytics.category_distribution)
                                        .sort((a, b) => b[1] - a[1])
                                        .slice(0, 4)
                                        .map(([cat, count]) => {
                                            const pct = analytics.total_reports > 0 ? Math.round((count / analytics.total_reports) * 100) : 0;
                                            return (
                                                <div key={cat} className="flex items-center gap-3">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] ?? "#9ca3af" }} />
                                                    <span className={`text-xs capitalize flex-1 truncate ${isDark ? "text-white/60" : "text-gray-600"}`}>{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}</span>
                                                    <div className={`w-20 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-gray-100"}`}>
                                                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className={`text-[10px] font-mono w-8 text-right ${isDark ? "text-white/45" : "text-gray-500"}`}>{pct}%</span>
                                                </div>
                                            );
                                        })}
                                </div>
                            ) : (
                                <p className={`text-xs italic ${isDark ? "text-white/30" : "text-gray-400"}`}>No category data available.</p>
                            )}
                        </div>
                    </div>
                </div>

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
