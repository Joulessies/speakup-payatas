"use client";
import { useEffect, useState } from "react";
import { Loader2, LayoutDashboard, FileWarning, TrendingUp, Eye } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { getDeviceId, generateReporterHash } from "@/lib/crypto";
import Link from "next/link";
import TransparencyBoard from "@/components/transparency-board";
import PredictiveAnalytics from "@/components/predictive-analytics";
import { Area, AreaChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis } from "recharts";

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
    flooding: "#0ea5e9", fire: "#ef4444", crime: "#f97316",
    infrastructure: "#eab308", health: "#ec4899",
    environmental: "#22c55e", other: "#94a3b8",
};

function LineChart({ data, isDark }: { data: TrendPoint[]; isDark: boolean }) {
    if (!data || data.length < 2) return (
        <div className={`h-32 flex items-center justify-center text-xs ${isDark ? "text-white/30" : "text-gray-400"}`}>
            Not enough data to display trend
        </div>
    );

    const formattedData = data.map(d => ({
        ...d,
        formattedDate: new Date(d.date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })
    }));

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className={`p-2.5 rounded-xl shadow-xl border text-xs font-sans ${isDark ? "bg-[#0a0a0f]/95 backdrop-blur-md border-white/10 text-white" : "bg-white/95 backdrop-blur-md border-gray-200 text-gray-900"}`}>
                    <p className={`font-semibold mb-2 pb-2 border-b ${isDark ? "text-white/60 border-white/10" : "text-gray-500 border-gray-100"}`}>{label}</p>
                    <div className="flex items-center justify-between gap-4 mt-1.5 font-medium">
                        <span className={`flex items-center gap-1.5 ${isDark ? "text-white/80" : "text-gray-600"}`}>
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            Reports
                        </span>
                        <span className="font-bold">{payload[0].value}</span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full h-36 mt-2" style={{ fontFamily: "inherit", marginLeft: "-10px" }}>
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={formattedData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1a56db" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#1a56db" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="formattedDate"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 10, fill: isDark ? "rgba(200,217,245,0.4)" : "rgba(74,96,128,0.7)" }}
                        dy={5}
                        minTickGap={20}
                    />
                    <RechartsTooltip
                        content={<CustomTooltip />}
                        cursor={{ stroke: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(26,79,173,0.08)', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#1a56db"
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
        <div className={`flex flex-col h-full overflow-y-auto ${isDark ? "bg-[#0d1b2e]" : "bg-[#f0f4f8]"}`}>
            <div className="max-w-4xl mx-auto w-full px-4 py-6 md:px-8 md:py-10 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center border ${isDark ? "bg-blue-500/15 border-blue-500/20" : "bg-[#e8f0fb] border-[#c8d6e8]"}`}>
                            <LayoutDashboard className={`h-5 w-5 ${isDark ? "text-blue-400" : "text-[#1a4fad]"}`} />
                        </div>
                        <div>
                            <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                                My Dashboard
                            </h1>
                            <p className={`text-sm mt-0.5 ${isDark ? "text-white/45" : "text-[#4a6080]"}`}>
                                Community updates and your report overview
                            </p>
                        </div>
                    </div>
                    <Link href="/report" className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-[#1a4fad] hover:bg-[#1544a0] transition-colors">
                        <FileWarning className="h-4 w-4" /> New Report
                    </Link>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: "My Reports", value: statsLoading ? "…" : reportCount?.total ?? 0, color: isDark ? "text-white" : "text-[#0f1f3d]", accent: isDark ? "border-l-white/20" : "border-l-[#1a4fad]" },
                        { label: "In Progress", value: statsLoading ? "…" : reportCount?.pending ?? 0, color: "text-amber-500", accent: "border-l-amber-500" },
                        { label: "Resolved", value: statsLoading ? "…" : reportCount?.resolved ?? 0, color: "text-emerald-500", accent: "border-l-emerald-500" },
                    ].map((s) => (
                        <div key={s.label} className={`p-4 rounded-lg border border-l-4 ${s.accent} ${isDark ? "bg-[#112240] border-white/[0.07]" : "bg-white border-[#c8d6e8]"}`}>
                            <span className={`text-[10px] font-bold uppercase tracking-wider ${isDark ? "text-white/40" : "text-[#4a6080]"}`}>{s.label}</span>
                            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Transparency Board */}
                <div className={`rounded-lg border overflow-hidden ${isDark ? "bg-[#112240] border-white/[0.07]" : "bg-white border-[#c8d6e8]"}`}>
                    <div className="flex items-center gap-3 px-5 pt-5 pb-4 border-b border-dashed border-[#c8d6e8]/50">
                        <Eye className={`h-4 w-4 ${isDark ? "text-blue-400" : "text-[#1a4fad]"}`} />
                        <div>
                            <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                                Transparency Board
                            </h2>
                            <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-[#4a6080]"}`}>
                                Resolved community reports — click any card to view details
                            </p>
                        </div>
                        <Link href="/transparency" className={`ml-auto text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${isDark ? "text-blue-400 hover:bg-blue-500/10" : "text-[#1a4fad] hover:bg-[#e8f0fb]"}`}>
                            View all
                        </Link>
                    </div>
                    <div className="px-5 pb-5">
                        <TransparencyBoard embedded reporterHash={reporterHash ?? undefined} />
                    </div>
                </div>

                {/* Predictive Analytics */}
                <div className={`rounded-lg border overflow-hidden p-5 ${isDark ? "bg-[#112240] border-white/[0.07]" : "bg-white border-[#c8d6e8]"}`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isDark ? "bg-blue-500/15" : "bg-[#e8f0fb]"}`}>
                            <TrendingUp className={`h-4 w-4 ${isDark ? "text-blue-400" : "text-[#1a4fad]"}`} />
                        </div>
                        <div>
                            <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                                Community Trend Analysis
                            </h2>
                            <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-[#4a6080]"}`}>
                                Algorithm-based spatial analysis & trend forecasting for Payatas-A
                            </p>
                        </div>
                    </div>
                    <PredictiveAnalytics isDark={isDark} />
                </div>

                {/* Community Analytics */}
                <div className={`rounded-lg border overflow-hidden ${isDark ? "bg-[#112240] border-white/[0.07]" : "bg-white border-[#c8d6e8]"}`}>
                    <div className="flex items-center justify-between px-5 py-4 border-b border-[#c8d6e8]/50">
                        <div className="flex items-center gap-3">
                            <TrendingUp className={`h-4 w-4 ${isDark ? "text-emerald-400" : "text-emerald-600"}`} />
                            <div>
                                <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-[#0f1f3d]"}`}>
                                    Community Analytics
                                </h2>
                                {topCategory && (
                                    <p className={`text-xs mt-0.5 ${isDark ? "text-white/45" : "text-[#4a6080]"}`}>
                                        Top issue: <span className="font-medium capitalize">{topCategory[0]}</span> ({topCategory[1]} reports)
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="px-5 pb-5 space-y-4 pt-4">
                        <div>
                            <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-[#4a6080]"}`}>
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
                                <p className={`text-xs font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/40" : "text-[#4a6080]"}`}>Category breakdown</p>
                                <div className="space-y-2.5">
                                    {Object.entries(analytics.category_distribution)
                                        .sort((a, b) => b[1] - a[1])
                                        .slice(0, 5)
                                        .map(([cat, count]) => {
                                            const pct = analytics.total_reports > 0 ? Math.round((count / analytics.total_reports) * 100) : 0;
                                            return (
                                                <div key={cat} className="flex items-center gap-3">
                                                    <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat] ?? "#94a3b8" }} />
                                                    <span className={`text-xs capitalize flex-1 truncate font-medium ${isDark ? "text-white/70" : "text-[#1e3a6e]"}`}>{cat}</span>
                                                    <div className={`w-24 h-1.5 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-[#dce5f0]"}`}>
                                                        <div className="h-full rounded-full bg-[#1a56db]" style={{ width: `${pct}%` }} />
                                                    </div>
                                                    <span className={`text-[10px] font-mono w-10 text-right ${isDark ? "text-white/40" : "text-[#4a6080]"}`}>{pct}%</span>
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
