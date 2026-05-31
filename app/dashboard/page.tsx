"use client";
import { useEffect, useState } from "react";
import { Loader2, LayoutDashboard, FileWarning, TrendingUp, Eye } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { getDeviceId, generateReporterHash } from "@/lib/crypto";
import Link from "next/link";
import TransparencyBoard from "@/components/transparency-board";
import PredictiveAnalytics from "@/components/predictive-analytics";

interface TrendPoint {
    date: string;
    count: number;
    categories: Record<string, number>;
}
interface AnalyticsData {
    trend_data: TrendPoint[];
    total_reports: number;
    category_distribution: Record<string, number>;
}

const CATEGORY_COLORS: Record<string, string> = {
    flooding: "#60a5fa", fire: "#fb923c", crime: "#f87171",
    infrastructure: "#fbbf24", health: "#f472b6",
    environmental: "#34d399", other: "#9ca3af",
};

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

export default function UserDashboard() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [reporterHash, setReporterHash] = useState<string | null>(null);
    const [reportCount, setReportCount] = useState<{ total: number; pending: number; resolved: number } | null>(null);
    const [myReports, setMyReports] = useState<any[]>([]);
    const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(true);
    const [showAnalytics, setShowAnalytics] = useState(false);

    useEffect(() => {
        (async () => {
            const hash = await generateReporterHash(getDeviceId());
            setReporterHash(hash);
            try {
                const res = await fetch(`/api/reports/my?reporter_hash=${hash}`);
                const data = await res.json();
                const reports = data.reports ?? [];
                setMyReports(reports);
                setReportCount({
                    total: reports.length,
                    pending: reports.filter((r: { status: string }) => r.status !== "resolved").length,
                    resolved: reports.filter((r: { status: string }) => r.status === "resolved").length,
                });
            } catch { /* ignore */ }
            finally { setStatsLoading(false); }
        })();
    }, []);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/analytics", { method: "POST" });
                if (res.ok) {
                    const json = await res.json();
                    if (Array.isArray(json?.trend_data)) setAnalytics(json as AnalyticsData);
                }
            } catch { /* ignore */ }
            finally { setAnalyticsLoading(false); }
        })();
    }, []);

    const topCategory = analytics?.category_distribution
        ? Object.entries(analytics.category_distribution).sort((a, b) => b[1] - a[1])[0]
        : null;

    return (
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
            <div className="max-w-4xl mx-auto w-full px-4 py-6 md:px-8 md:py-10 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-indigo-500/15" : "bg-indigo-50"}`}>
                            <LayoutDashboard className={`h-6 w-6 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                        </div>
                        <div>
                            <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
                                My Dashboard
                            </h1>
                            <p className={`text-sm mt-0.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Community updates and your report overview
                            </p>
                        </div>
                    </div>
                    <Link href="/" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors">
                        <FileWarning className="h-4 w-4" /> New Report
                    </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "My Reports", value: statsLoading ? "…" : reportCount?.total ?? 0, color: isDark ? "text-white" : "text-gray-900" },
                        { label: "In Progress", value: statsLoading ? "…" : reportCount?.pending ?? 0, color: "text-amber-500" },
                        { label: "Resolved", value: statsLoading ? "…" : reportCount?.resolved ?? 0, color: "text-emerald-500" },
                    ].map((s) => (
                        <div key={s.label} className={`p-4 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                            <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>{s.label}</span>
                            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Transparency Board */}
                <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                    <div className="flex items-center gap-3 px-5 pt-5 pb-4">
                        <Eye className={`h-5 w-5 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                        <div>
                            <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                Transparency Board
                            </h2>
                            <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Resolved community reports — click any card to view details
                            </p>
                        </div>
                        <Link href="/transparency" className={`ml-auto text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${isDark ? "text-indigo-400 hover:bg-indigo-500/10" : "text-indigo-600 hover:bg-indigo-50"}`}>
                            View all
                        </Link>
                    </div>
                    <div className="px-5 pb-5">
                        <TransparencyBoard embedded reporterHash={reporterHash ?? undefined} />
                    </div>
                </div>

                {/* Predictive Analytics */}
                <div className={`rounded-2xl border overflow-hidden p-5 ${isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isDark ? "bg-indigo-500/15" : "bg-indigo-50"}`}>
                            <TrendingUp className={`h-4 w-4 ${isDark ? "text-indigo-400" : "text-indigo-600"}`} />
                        </div>
                        <div>
                            <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                Predictive Community Analytics
                            </h2>
                            <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Algorithm-based spatial analysis & trend forecasting for Payatas-A
                            </p>
                        </div>
                    </div>
                    <PredictiveAnalytics isDark={isDark} />
                </div>

                {/* Community Analytics (Always Visible) */}
                <div className={`rounded-2xl border overflow-hidden ${isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-dashed border-border/50">
                        <div className="flex items-center gap-3">
                            <TrendingUp className={`h-5 w-5 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                            <div>
                                <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                                    Community Analytics
                                </h2>
                                {topCategory && (
                                    <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                        Top issue: <span className="font-medium capitalize">{topCategory[0]}</span> ({topCategory[1]} reports)
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="px-5 pb-5 space-y-4 pt-4">
                        <div>
                            <p className={`text-xs font-medium mb-3 ${isDark ? "text-white/50" : "text-gray-500"}`}>
                                Report trend — last 14 days
                            </p>
                            {analyticsLoading ? (
                                <div className="h-32 flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin opacity-40" /></div>
                            ) : (
                                <LineChart data={analytics?.trend_data ?? []} isDark={isDark} />
                            )}
                        </div>
                        {analytics && Object.keys(analytics.category_distribution ?? {}).length > 0 && (
                            <div>
                                <p className={`text-xs font-medium mb-3 ${isDark ? "text-white/50" : "text-gray-500"}`}>Category breakdown</p>
                                <div className="space-y-2">
                                    {Object.entries(analytics.category_distribution)
                                        .sort((a, b) => b[1] - a[1])
                                        .slice(0, 5)
                                        .map(([cat, count]) => {
                                            const pct = analytics.total_reports > 0 ? Math.round((count / analytics.total_reports) * 100) : 0;
                                            return (
                                                <div key={cat} className="flex items-center gap-3">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] ?? "#9ca3af" }} />
                                                    <span className={`text-xs capitalize flex-1 truncate ${isDark ? "text-white/60" : "text-gray-600"}`}>{cat}</span>
                                                    <div className={`w-24 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-gray-100"}`}>
                                                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className={`text-[10px] font-mono w-10 text-right ${isDark ? "text-white/40" : "text-gray-500"}`}>{pct}%</span>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
