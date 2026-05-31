"use client";
import { useEffect, useState, useMemo } from "react";
import { Loader2, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, CheckCircle2, ShieldAlert, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TrendPoint {
    date: string;
    count: number;
    categories: Record<string, number>;
}

interface RankedCluster {
    latitude: number;
    longitude: number;
    count: number;
    category_breakdown: Record<string, number>;
    urgency: {
        score: number;
        level: string;
        reasons: string[];
    };
    anomaly: {
        isAnomaly: boolean;
        score: number;
    };
    reports: { severity: number; category: string; created_at: string }[];
}

interface AnalyticsData {
    trend_data: TrendPoint[];
    ranked_clusters: RankedCluster[];
    category_distribution: Record<string, number>;
    total_reports: number;
}

export default function PredictiveAnalytics({ isDark }: { isDark: boolean }) {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/analytics", { method: "POST" });
                if (!res.ok) throw new Error("Failed to fetch analytics data");
                const json = await res.json();
                setData(json);
            } catch (err) {
                setError(err instanceof Error ? err.message : "Unable to load predictive analytics");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    // Perform Linear Regression to forecast next 4 days
    const forecastResults = useMemo(() => {
        if (!data || !data.trend_data || data.trend_data.length < 5) return null;

        const trend = data.trend_data;
        const n = trend.length;
        const x = Array.from({ length: n }, (_, i) => i);
        const y = trend.map((t) => t.count);

        const sumX = x.reduce((a, b) => a + b, 0);
        const sumY = y.reduce((a, b) => a + b, 0);
        const sumXY = x.reduce((sum, val, idx) => sum + val * y[idx], 0);
        const sumXX = x.reduce((sum, val) => sum + val * val, 0);

        // Slope (m) and Intercept (b)
        const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
        const b = (sumY - m * sumX) / n;

        // Forecast next 4 days
        const forecastDays = 4;
        const forecastedPoints = [];
        const baseDate = new Date(trend[n - 1].date + "T00:00:00");

        for (let i = 1; i <= forecastDays; i++) {
            const nextX = n - 1 + i;
            const nextY = Math.max(0, Math.round(m * nextX + b));
            const nextDate = new Date(baseDate);
            nextDate.setDate(baseDate.getDate() + i);

            forecastedPoints.push({
                date: nextDate.toISOString().slice(0, 10),
                count: nextY,
                isForecast: true,
            });
        }

        // Combine history and forecast
        const combined = [
            ...trend.map((t) => ({ date: t.date, count: t.count, isForecast: false })),
            ...forecastedPoints,
        ];

        // Overall trend description
        let trendDirection = "stable";
        let percentChange = 0;
        const startAvg = (y[0] + y[1] + y[2]) / 3;
        const endAvg = (y[n - 1] + y[n - 2] + y[n - 3]) / 3;
        
        if (startAvg > 0) {
            percentChange = Math.round(((endAvg - startAvg) / startAvg) * 100);
            if (percentChange > 8) trendDirection = "upward";
            else if (percentChange < -8) trendDirection = "downward";
        }

        return {
            combined,
            m,
            b,
            trendDirection,
            percentChange,
            forecastedPoints,
        };
    }, [data]);

    // Analyze Category Trends (Comparing last 7 days vs previous 7 days)
    const categoryTrends = useMemo(() => {
        if (!data || !data.trend_data || data.trend_data.length < 14) return [];

        const trend = data.trend_data;
        const prev7 = trend.slice(0, 7);
        const last7 = trend.slice(7, 14);

        const counts: Record<string, { prev: number; curr: number }> = {};

        // Aggregate counts per category
        const addCounts = (points: TrendPoint[], key: "prev" | "curr") => {
            for (const p of points) {
                for (const [cat, val] of Object.entries(p.categories ?? {})) {
                    if (!counts[cat]) counts[cat] = { prev: 0, curr: 0 };
                    counts[cat][key] += val;
                }
            }
        };

        addCounts(prev7, "prev");
        addCounts(last7, "curr");

        return Object.entries(counts).map(([category, info]) => {
            const diff = info.curr - info.prev;
            let status: "rising" | "falling" | "stable" = "stable";
            if (diff > 1) status = "rising";
            else if (diff < -1) status = "falling";

            return {
                category,
                prev: info.prev,
                curr: info.curr,
                diff,
                status,
            };
        }).sort((a, b) => b.diff - a.diff);
    }, [data]);

    // Urgent Alerts based on High Urgency DBSCAN Clusters
    const urgentAlerts = useMemo(() => {
        if (!data || !data.ranked_clusters) return [];
        return data.ranked_clusters
            .filter((c) => c.urgency && c.urgency.score >= 5.0)
            .map((c) => {
                const mainCategory = Object.entries(c.category_breakdown ?? {})
                    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";
                
                return {
                    category: mainCategory,
                    count: c.count,
                    score: c.urgency?.score !== undefined ? c.urgency.score.toFixed(1) : "5.0",
                    level: c.urgency?.level ?? "high",
                    reasons: c.urgency?.reasons ?? [],
                    isAnomaly: c.anomaly?.isAnomaly ?? false,
                };
            });
    }, [data]);

    if (loading) {
        return (
            <div className={`p-8 flex justify-center items-center ${isDark ? "text-white/40" : "text-gray-400"}`}>
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-sm font-medium">Running predictive risk analysis...</span>
            </div>
        );
    }

    if (error || !data || !forecastResults) {
        return (
            <div className="p-6 rounded-2xl border border-dashed border-red-500/20 bg-red-500/5 text-center">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-red-400" />
                <p className="text-xs font-semibold text-red-400">Analytics Offline</p>
                <p className={`text-[10px] mt-0.5 ${isDark ? "text-white/40" : "text-gray-400"}`}>
                    Need more community reports to generate predictive trend graphs.
                </p>
            </div>
        );
    }

    const { combined, trendDirection, percentChange, forecastedPoints } = forecastResults;
    const maxCount = Math.max(...combined.map((d) => d.count), 1);
    const width = 140;
    const height = 70;
    const padding = 10;
    const chartW = width - padding * 2;
    const chartH = height - padding * 2;

    const points = combined.map((p, i) => ({
        x: padding + (i / (combined.length - 1)) * chartW,
        y: padding + chartH - (p.count / maxCount) * chartH * 0.85,
        count: p.count,
        date: p.date,
        isForecast: p.isForecast,
    }));

    // Split points into history and forecast path
    const historyPoints = points.filter((p) => !p.isForecast);
    const forecastPoints = points.filter((p, i) => p.isForecast || i === historyPoints.length - 1);

    const historyPathD = historyPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const forecastPathD = forecastPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const fillD = `${historyPathD} L ${historyPoints[historyPoints.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`;

    return (
        <div className="space-y-6">
            {/* Main Risk Alert Header */}
            {urgentAlerts.length > 0 ? (
                <div className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${
                    isDark 
                        ? "bg-red-500/5 border-red-500/20 text-red-200" 
                        : "bg-red-50 border-red-200 text-red-800"
                }`}>
                    <ShieldAlert className="h-5 w-5 text-red-500 shrink-0 mt-0.5 animate-pulse" />
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider">High-Priority Incidents Warning</h4>
                        <p className={`text-xs ${isDark ? "text-red-300/80" : "text-red-700"}`}>
                            Our spatial system identified {urgentAlerts.length} active hotspot clusters with elevated urgency levels in Payatas-A. Residents and administrators should exercise vigilance.
                        </p>
                    </div>
                </div>
            ) : (
                <div className={`p-4 rounded-2xl border flex items-start gap-3 transition-colors ${
                    isDark 
                        ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-300" 
                        : "bg-emerald-50 border-emerald-100 text-emerald-800"
                }`}>
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <h4 className="text-xs font-bold uppercase tracking-wider">System Status: Stable</h4>
                        <p className={`text-xs ${isDark ? "text-emerald-400/80" : "text-emerald-700"}`}>
                            Predictive analytics indicate a calm reporting trend. No abnormal spikes or highly-urgent clusters detected in the community.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                {/* 14-Day Trend + 4-Day Forecast Line Chart */}
                <Card className={`md:col-span-7 overflow-hidden ${isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-white border-gray-100"}`}>
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-indigo-500" />
                            <CardTitle className="text-sm font-semibold">18-Day Predictive Trend</CardTitle>
                        </div>
                        <CardDescription className="text-xs">
                            14-day history (solid) with linear regression 4-day forecast (dashed)
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-40" preserveAspectRatio="none">
                                <defs>
                                    <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
                                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                                    </linearGradient>
                                </defs>
                                {/* Grid lines */}
                                <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} strokeWidth="0.5" />
                                <line x1={padding} y1={padding + chartH / 2} x2={width - padding} y2={padding + chartH / 2} stroke={isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)"} strokeWidth="0.5" />
                                <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke={isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)"} strokeWidth="0.5" />
                                
                                {/* Fill area under history */}
                                <path d={fillD} fill="url(#histGrad)" />

                                {/* History line */}
                                <path d={historyPathD} fill="none" stroke="#6366f1" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" />

                                {/* Forecast line */}
                                <path d={forecastPathD} fill="none" stroke="#f43f5e" strokeWidth="1.1" strokeDasharray="2,2" strokeLinejoin="round" strokeLinecap="round" />

                                {/* Interactive points */}
                                {points.map((p, i) => (
                                    <circle 
                                        key={i} 
                                        cx={p.x} 
                                        cy={p.y} 
                                        r={p.isForecast ? "1" : "0.8"} 
                                        fill={p.isForecast ? "#f43f5e" : "#6366f1"} 
                                    />
                                ))}
                            </svg>
                            
                            {/* Forecast Badge Overlay */}
                            <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/40 backdrop-blur px-2 py-0.5 rounded-full text-[9px] text-[#f43f5e] font-semibold border border-red-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#f43f5e] animate-pulse" />
                                Forecast Period
                            </div>
                        </div>

                        {/* Chart Footnote */}
                        <div className="flex justify-between text-[9px] px-1 pb-1">
                            <div className="flex flex-col">
                                <span className={isDark ? "text-white/30" : "text-gray-400"}>Start</span>
                                <span className={`font-semibold ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                    {new Date(combined[0].date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                                </span>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className={isDark ? "text-white/30" : "text-gray-400"}>Forecast Start</span>
                                <span className="font-semibold text-indigo-400">
                                    {new Date(data.trend_data[data.trend_data.length - 1].date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                                </span>
                            </div>
                            <div className="flex flex-col items-end">
                                <span className={isDark ? "text-white/30" : "text-gray-400"}>End</span>
                                <span className={`font-semibold text-rose-400`}>
                                    {new Date(combined[combined.length - 1].date + "T00:00:00").toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                                </span>
                            </div>
                        </div>

                        {/* Trend Insight text */}
                        <div className={`p-3 rounded-xl border text-xs leading-relaxed flex items-center justify-between ${
                            isDark ? "bg-white/[0.01] border-white/[0.06]" : "bg-gray-50 border-gray-150"
                        }`}>
                            <div className="space-y-0.5">
                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? "text-white/40" : "text-gray-400"}`}>Insight</span>
                                <p className={isDark ? "text-white/70" : "text-gray-700"}>
                                    Reports are trended to be <span className={`font-semibold ${trendDirection === "upward" ? "text-red-400" : trendDirection === "downward" ? "text-emerald-400" : "text-yellow-400"}`}>{trendDirection}</span> by <span className="font-semibold">{Math.abs(percentChange)}%</span> over the next 4 days.
                                </p>
                            </div>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                trendDirection === "upward" 
                                    ? "bg-red-500/10 text-red-400" 
                                    : trendDirection === "downward" 
                                    ? "bg-emerald-500/10 text-emerald-400" 
                                    : "bg-yellow-500/10 text-yellow-400"
                            }`}>
                                {trendDirection === "upward" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Category Trends & Priority Alerts list */}
                <div className="md:col-span-5 space-y-5">
                    {/* Rising/Falling Risks */}
                    <Card className={isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-white border-gray-100"}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                                <Calendar className="h-4 w-4 text-[#fb923c]" /> Category Trajectory
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Comparing current week volume against last week
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3.5">
                            {categoryTrends.length === 0 ? (
                                <p className={`text-xs text-center py-4 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                                    No category data available
                                </p>
                            ) : (
                                <div className="space-y-2.5">
                                    {categoryTrends.slice(0, 4).map((trend) => (
                                        <div key={trend.category} className="flex items-center justify-between gap-2">
                                            <div className="space-y-0.5">
                                                <span className={`text-xs font-semibold capitalize ${isDark ? "text-white/80" : "text-gray-700"}`}>
                                                    {trend.category.replace(/_/g, " ")}
                                                </span>
                                                <p className={`text-[10px] ${isDark ? "text-white/35" : "text-gray-400"}`}>
                                                    {trend.curr} reports this week ({trend.prev} last week)
                                                </p>
                                            </div>
                                            <Badge variant="outline" className={`gap-1 select-none font-semibold ${
                                                trend.status === "rising" 
                                                    ? isDark ? "bg-red-500/10 border-red-500/20 text-red-400" : "bg-red-50 border-red-200 text-red-700"
                                                    : trend.status === "falling" 
                                                    ? isDark ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                                                    : isDark ? "bg-white/[0.03] border-white/10 text-white/50" : "bg-gray-100 border-gray-200 text-gray-600"
                                            }`}>
                                                {trend.status === "rising" ? (
                                                    <>
                                                        <ArrowUpRight className="h-3 w-3" /> Rising
                                                    </>
                                                ) : trend.status === "falling" ? (
                                                    <>
                                                        <ArrowDownRight className="h-3 w-3" /> Falling
                                                    </>
                                                ) : (
                                                    "Stable"
                                                )}
                                            </Badge>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Highly Urgent Hotspots details */}
                    <Card className={isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-white border-gray-100"}>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-sm font-semibold flex items-center gap-1.5 text-rose-500">
                                <AlertTriangle className="h-4 w-4" /> Spatial Hotspot Risks
                            </CardTitle>
                            <CardDescription className="text-xs">
                                Geolocation-clustered active community alerts
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {urgentAlerts.length === 0 ? (
                                <div className="text-center py-6 text-xs text-emerald-500 flex flex-col items-center gap-1.5">
                                    <CheckCircle2 className="h-6 w-6 opacity-60" />
                                    <span>All sectors quiet. No urgent report clusters.</span>
                                </div>
                            ) : (
                                <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
                                    {urgentAlerts.map((alert, idx) => (
                                        <div key={idx} className={`p-2.5 rounded-xl border space-y-1.5 transition-colors ${
                                            isDark ? "bg-white/[0.01] border-white/[0.06] hover:bg-white/[0.02]" : "bg-gray-50 border-gray-150 hover:bg-gray-100/50"
                                        }`}>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className={`text-[11px] font-bold capitalize ${isDark ? "text-white/90" : "text-gray-800"}`}>
                                                    {alert.category.replace(/_/g, " ")} Cluster
                                                </span>
                                                <Badge className="text-[9px] font-bold select-none bg-rose-500 text-white border-none">
                                                    Urgency: {alert.score}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap gap-1">
                                                {(alert.reasons || []).slice(0, 2).map((r, rIdx) => (
                                                    <span key={rIdx} className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                                                        isDark ? "bg-white/[0.04] text-white/50" : "bg-gray-200/60 text-gray-600"
                                                    }`}>
                                                        {r}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
