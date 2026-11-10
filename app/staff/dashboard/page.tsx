"use client";
import { useEffect, useState, useMemo } from "react";
import { Loader2, LayoutDashboard, FileWarning, BarChart3, Download, Map, ArrowUpRight, ClipboardPen } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { CATEGORY_COLORS, CATEGORY_LABELS, resolveCategory } from "@/types";
import dynamic from "next/dynamic";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";

interface TrendPoint {
    date: string;
    count: number;
    categories: Record<string, number>;
}

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
    
    // Format dates for X-Axis
    const formattedData = data.map(d => ({
        ...d,
        formattedDate: new Date(d.date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })
    }));

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className={`p-2 rounded-lg shadow-lg border text-xs font-sans ${isDark ? "bg-[#0a0a0f] border-white/10 text-white" : "bg-white border-gray-200 text-gray-900"}`}>
                    <p className={`font-semibold mb-1 ${isDark ? "text-white/60" : "text-gray-500"}`}>{label}</p>
                    <p className="font-bold flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        {payload[0].value} reports
                    </p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-36 mt-2" style={{ fontFamily: "inherit", marginLeft: "-10px" }}>
            <ResponsiveContainer width="100%" height={144} minWidth={0}>
                <AreaChart data={formattedData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#059669" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#059669" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis 
                        dataKey="formattedDate" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fontSize: 10, fill: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.5)" }} 
                        dy={5}
                        minTickGap={20}
                    />
                    <Tooltip 
                        content={<CustomTooltip />} 
                        cursor={{ stroke: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', strokeWidth: 1, strokeDasharray: '3 3' }} 
                    />
                    <Area 
                        type="monotone" 
                        dataKey="count" 
                        stroke="#059669" 
                        strokeWidth={2.5}
                        fillOpacity={1} 
                        fill="url(#colorCount)" 
                        animationDuration={1000}
                    />
                </AreaChart>
            </ResponsiveContainer>
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

interface ClusterData {
    latitude: number;
    longitude: number;
    count: number;
    category_breakdown: Record<string, number>;
}

interface AnalyticsData {
    total_reports: number;
    trend_data: TrendPoint[];
    category_distribution: Record<string, number>;
}

export default function StaffDashboard() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [reports, setReports] = useState<ReportSummary[]>([]);
    const [stats, setStats] = useState<SummaryStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    // Map and analytics states
    const [clusters, setClusters] = useState<ClusterData[]>([]);
    const [heatPoints, setHeatPoints] = useState<any[]>([]);
    const [noisePoints, setNoisePoints] = useState<{ latitude: number; longitude: number }[]>([]);
    const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
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
                setNoisePoints(clustersData.noise_points ?? []);
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
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#04271e]" : "bg-[#f4fbf7]"}`}>
            <div className="max-w-6xl mx-auto w-full px-4 py-6 md:px-8 md:py-10 space-y-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${isDark ? "bg-emerald-500/15" : "bg-[#e6f4ea]"}`}>
                            <LayoutDashboard className={`h-6 w-6 ${isDark ? "text-emerald-400" : "text-[#059669]"}`} />
                        </div>
                        <div>
                            <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                                Staff Dashboard
                            </h1>
                            <p className={`text-sm mt-1 ${isDark ? "text-white/60" : "text-[#047857]"}`}>
                                Overview of reports, verification status, and spatial risk hotspots.
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Link
                            href="/staff/intake"
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                                isDark
                                    ? "bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/10"
                                    : "bg-white text-gray-800 hover:bg-gray-50 border border-gray-200 shadow-sm"
                            }`}
                        >
                            <ClipboardPen className="h-4 w-4 text-emerald-400" />
                            Encode Report
                        </Link>
                        <Link
                            href="/staff/map"
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                                isDark
                                    ? "bg-white/[0.08] text-white hover:bg-white/[0.14] border border-white/10"
                                    : "bg-white text-gray-800 hover:bg-gray-50 border border-gray-200 shadow-sm"
                            }`}
                        >
                            <Map className="h-4 w-4 text-emerald-400" />
                            Hotspot Map
                        </Link>
                        <button
                            onClick={exportToCSV}
                            disabled={exporting || loading}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                                isDark
                                    ? "bg-white/[0.05] text-white/70 hover:bg-white/[0.1] hover:text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
                            }`}
                        >
                            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            Export CSV
                        </button>
                    </div>
                </div>

                {/* Stats Grid */}
                {loading ? (
                    <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin opacity-50" />
                    </div>
                ) : stats ? (
                    <div className="grid grid-cols-3 gap-3">
                        <div className={`p-4 rounded-2xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>Total Reports</span>
                            <p className={`text-2xl font-bold mt-1 ${isDark ? "text-white" : "text-[#064e3b]"}`}>{stats.total}</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-100"}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-amber-400" : "text-amber-600"}`}>Unreviewed</span>
                            <p className={`text-2xl font-bold mt-1 text-amber-500`}>{stats.unreviewed}</p>
                        </div>
                        <div className={`p-4 rounded-2xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/20" : "bg-emerald-50 border-emerald-100"}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-emerald-400" : "text-emerald-600"}`}>Valid</span>
                            <p className={`text-2xl font-bold mt-1 text-emerald-500`}>{stats.valid}</p>
                        </div>
                    </div>
                ) : null}

                {/* Hotspot Map Card (Full Size) */}
                <div className={`p-4 md:p-6 rounded-2xl border flex flex-col shadow-xl ${isDark ? "bg-[#06382b] border-emerald-500/20" : "bg-[#f4fbf7] border-emerald-200"}`}>
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className={`text-sm md:text-base font-bold uppercase tracking-wider ${isDark ? "text-emerald-300" : "text-[#064e3b]"}`}>
                                    Active Hotspot Risk Map (Payatas-A)
                                </h2>
                                <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${isDark ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10" : "border-emerald-300 text-emerald-800 bg-emerald-50"}`}>
                                    {clusters.length} Hotspot Clusters
                                </Badge>
                            </div>
                            <p className={`text-xs mt-1 ${isDark ? "text-white/50" : "text-[#047857]/70"}`}>
                                DBSCAN-clustered incident density with live pinpoint markers and neighborhood boundary.
                            </p>
                        </div>
                        <Link
                            href="/staff/map"
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all hover:scale-[1.02] shrink-0"
                        >
                            <Map className="h-3.5 w-3.5" />
                            Open Full-Screen Map
                            <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="h-[500px] md:h-[600px] w-full rounded-xl overflow-hidden relative border border-white/[0.08] shadow-inner">
                        <AdminMapInner
                            clusters={clusters}
                            selectedCluster={selectedCluster}
                            onClusterClick={handleClusterClick}
                            showHeatmap={false}
                            heatPoints={heatPoints}
                            noisePoints={noisePoints}
                        />
                    </div>

                    {selectedCluster !== null && clusters[selectedCluster] && (
                        <div className={`mt-3 p-3.5 rounded-xl border text-xs leading-relaxed flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-white" : "bg-emerald-50 border-emerald-200 text-[#064e3b]"}`}>
                            <div>
                                <h4 className="font-bold text-emerald-400 text-sm">
                                    Selected Cluster — {clusters[selectedCluster].count} reports
                                </h4>
                                <p className={`mt-0.5 ${isDark ? "text-white/70" : "text-gray-700"}`}>
                                    Primary Category: <span className="font-semibold">{(() => {
                                        const topCat = Object.entries(clusters[selectedCluster].category_breakdown).sort((a, b) => b[1] - a[1])[0]?.[0];
                                        return topCat ? (CATEGORY_LABELS[topCat as keyof typeof CATEGORY_LABELS] || topCat.replace(/_/g, " ")) : "Mixed";
                                    })()}</span>
                                    <span className="mx-2 opacity-40">•</span>
                                    Coordinates: {clusters[selectedCluster].latitude.toFixed(5)}, {clusters[selectedCluster].longitude.toFixed(5)}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${clusters[selectedCluster].latitude},${clusters[selectedCluster].longitude}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium ${isDark ? "bg-white/10 text-white hover:bg-white/15" : "bg-white text-gray-800 border border-gray-200 shadow-sm hover:bg-gray-50"}`}
                                >
                                    Google Maps
                                </a>
                                <Link
                                    href="/staff/map"
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors"
                                >
                                    Inspect in Full Map →
                                </Link>
                            </div>
                        </div>
                    )}
                </div>

                {/* Analytics Trend & Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Analytics Trend & Distribution */}
                    <div className={`p-4 md:p-6 rounded-2xl border flex flex-col justify-between ${isDark ? "bg-[#06382b] border-emerald-500/20" : "bg-[#f4fbf7] border-emerald-200"}`}>
                        <div>
                            <div className="mb-4 flex items-center justify-between">
                                <div>
                                    <h2 className={`text-sm font-semibold uppercase tracking-wider ${isDark ? "text-emerald-300/70" : "text-[#047857]"}`}>
                                        Report Frequency Trend
                                    </h2>
                                    <p className={`text-xs mt-1 ${isDark ? "text-white/40" : "text-[#047857]/60"}`}>
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

                        <div className="mt-6 pt-4 border-t border-dashed border-emerald-500/20">
                            <h3 className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-emerald-300/70" : "text-[#047857]"}`}>
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
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[resolveCategory(cat) ?? "other"] }} />
                                                    <span className={`text-xs capitalize flex-1 truncate ${isDark ? "text-white/60" : "text-[#064e3b]"}`}>{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat}</span>
                                                    <div className={`w-20 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-emerald-100"}`}>
                                                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
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
                                ? "bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20"
                                : "bg-[#e6f4ea] border-emerald-200 hover:bg-emerald-100"
                        }`}
                    >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDark ? "bg-emerald-500/20" : "bg-emerald-100"}`}>
                            <FileWarning className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-[#059669]"}`} />
                        </div>
                        <div>
                            <h3 className={`font-semibold ${isDark ? "text-emerald-300" : "text-[#064e3b]"}`}>Verification Queue</h3>
                            <p className={`text-xs ${isDark ? "text-emerald-400/70" : "text-[#047857]/70"}`}>Review and verify pending reports</p>
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
