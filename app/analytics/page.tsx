"use client";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";
import TrendChart from "@/components/trend-chart";
import { Loader2, TrendingUp, AlertTriangle, Zap, BarChart3, MapPin, ArrowUpRight, } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { UrgencyScore } from "@/lib/urgency";
import type { AnomalyResult } from "@/lib/anomaly";
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
    urgency: UrgencyScore;
    anomaly: AnomalyResult;
}
interface AnalyticsData {
    trend_data: TrendPoint[];
    ranked_clusters: RankedCluster[];
    category_distribution: Record<string, number>;
    anomaly_count: number;
    total_reports: number;
}

/** Accepts API success bodies and normalizes missing fields so the UI never calls .reduce on undefined. */
function normalizeAnalyticsResponse(value: unknown): AnalyticsData | null {
    if (!value || typeof value !== "object") return null;
    const o = value as Record<string, unknown>;
    const trendRaw = o.trend_data;
    const clustersRaw = o.ranked_clusters;
    const catRaw = o.category_distribution;
    if (!Array.isArray(trendRaw) || !Array.isArray(clustersRaw)) return null;
    const category_distribution =
        catRaw !== null && typeof catRaw === "object" && !Array.isArray(catRaw)
            ? (catRaw as Record<string, number>)
            : {};
    const anomaly_count = typeof o.anomaly_count === "number" ? o.anomaly_count : 0;
    const total_reports = typeof o.total_reports === "number" ? o.total_reports : 0;
    return {
        trend_data: trendRaw as TrendPoint[],
        ranked_clusters: clustersRaw as RankedCluster[],
        category_distribution,
        anomaly_count,
        total_reports,
    };
}

const URGENCY_COLORS = {
    critical: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/20", dot: "bg-red-500" },
    high: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/20", dot: "bg-orange-500" },
    medium: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/20", dot: "bg-amber-500" },
    low: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/20", dot: "bg-emerald-500" },
};
export default function AnalyticsPage() {
    const { theme } = useTheme();
    const isDark = theme === "dark";
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        (async () => {
            try {
                const res = await fetch("/api/analytics", { method: "POST" });
                const json: unknown = await res.json();
                if (!res.ok) {
                    const msg = json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
                        ? (json as { error: string }).error
                        : `Request failed (${res.status})`;
                    setErrorMessage(msg);
                    setData(null);
                    return;
                }
                const normalized = normalizeAnalyticsResponse(json);
                if (!normalized) {
                    const msg = json && typeof json === "object" && "error" in json && typeof (json as { error: unknown }).error === "string"
                        ? (json as { error: string }).error
                        : "Invalid analytics response from server.";
                    setErrorMessage(msg);
                    setData(null);
                    return;
                }
                setErrorMessage(null);
                setData(normalized);
            }
            catch (err) {
                console.error("Analytics fetch failed:", err);
                setErrorMessage(err instanceof Error ? err.message : "Network error");
                setData(null);
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    if (loading) {
        return (<div className={`flex items-center justify-center flex-1 ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500"/>
      </div>);
    }
    if (!data) {
        return (<div className={`flex flex-col items-center justify-center flex-1 gap-2 px-4 ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
        <p className={isDark ? "text-white/40" : "text-gray-400"}>Failed to load analytics.</p>
        {errorMessage && (
          <p className={`text-sm text-center max-w-md ${isDark ? "text-red-300/80" : "text-red-600"}`}>
            {errorMessage}
          </p>
        )}
      </div>);
    }
    const trendSeries = Array.isArray(data.trend_data) ? data.trend_data : [];
    const rankedClustersSafe = Array.isArray(data.ranked_clusters) ? data.ranked_clusters : [];
    const categoryDistributionSafe =
        data.category_distribution && typeof data.category_distribution === "object" ? data.category_distribution : {};
    const totalRecent = trendSeries.reduce((s, d) => s + (typeof d?.count === "number" ? d.count : 0), 0);
    const topCategory = Object.entries(categoryDistributionSafe).sort((a, b) => b[1] - a[1])[0];
    const anomalyClusters = rankedClustersSafe.filter((c) => c?.anomaly?.isAnomaly);
    return (<div className={`flex-1 overflow-y-auto ${isDark ? "bg-[#0a0a0f]" : "bg-gray-50"}`}>
      <div className="max-w-6xl mx-auto px-4 py-6 pb-24 md:px-8 md:py-10 space-y-6">
        
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className={`text-xl md:text-2xl font-bold tracking-tight ${isDark ? "text-white" : "text-gray-900"}`}>
              Analytics
            </h1>
            <p className={`text-sm mt-1 ${isDark ? "text-white/45" : "text-gray-500"}`}>
              Algorithm-based incident analysis for Barangay Payatas-A
            </p>
          </div>
          <Badge variant="outline" className={`${isDark ? "border-white/10 text-white/50" : "border-gray-200 text-gray-600"} w-fit`}>
            14-day snapshot
          </Badge>
        </div>

        
        {data.anomaly_count > 0 && (<div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${isDark
                ? "bg-red-500/[0.08] border-red-500/20 text-red-300"
                : "bg-red-50 border-red-200 text-red-700"}`}>
            <AlertTriangle className="h-5 w-5 shrink-0"/>
            <div>
              <p className="text-sm font-semibold">
                {data.anomaly_count} anomal{data.anomaly_count > 1 ? "ies" : "y"} detected
              </p>
              <p className={`text-xs ${isDark ? "text-red-300/70" : "text-red-600/70"}`}>
                Unusual activity spikes detected in {data.anomaly_count} cluster{data.anomaly_count > 1 ? "s" : ""}
              </p>
            </div>
          </div>)}

        
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { icon: BarChart3, label: "Total Reports", value: data.total_reports },
            { icon: TrendingUp, label: "Last 14 Days", value: totalRecent },
            { icon: Zap, label: "Hotspots", value: rankedClustersSafe.length },
            { icon: AlertTriangle, label: "Anomalies", value: data.anomaly_count },
        ].map((stat) => (<div key={stat.label} className={`flex flex-col gap-2 p-4 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-gray-100"}`}>
              <stat.icon className={`h-4 w-4 ${isDark ? "text-white/30" : "text-gray-400"}`}/>
              <span className={`text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                {stat.value}
              </span>
              <span className={`text-[11px] font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>
                {stat.label}
              </span>
            </div>))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          
          <div className={`lg:col-span-2 p-5 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-gray-100"}`}>
            <div className="flex items-center justify-between mb-4 gap-3">
              <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                Incident Trend (14 days)
              </h2>
              {topCategory && (<Badge variant="outline" className={`text-[10px] ${isDark ? "border-white/10 text-white/50" : "text-gray-600 border-gray-200"}`}>
                  Top: {topCategory[0]} ({topCategory[1]})
                </Badge>)}
            </div>
            <TrendChart data={trendSeries} isDark={isDark}/>
          </div>

          
          <div className={`p-5 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-gray-100"}`}>
            <h2 className={`text-sm font-semibold mb-4 ${isDark ? "text-white" : "text-gray-900"}`}>
              Category Distribution
            </h2>
            <div className="space-y-2.5">
              {Object.entries(categoryDistributionSafe)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, count]) => {
            const pct = data.total_reports > 0 ? Math.round((count / data.total_reports) * 100) : 0;
            return (<div key={cat} className="flex items-center gap-3">
                      <span className={`text-xs capitalize w-24 truncate ${isDark ? "text-white/60" : "text-gray-600"}`}>
                        {cat}
                      </span>
                      <div className={`flex-1 h-2 rounded-full overflow-hidden ${isDark ? "bg-white/[0.06]" : "bg-gray-100"}`}>
                        <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }}/>
                      </div>
                      <span className={`text-xs font-mono w-14 text-right ${isDark ? "text-white/45" : "text-gray-500"}`}>
                        {count} ({pct}%)
                      </span>
                    </div>);
        })}
            </div>
          </div>
        </div>

        
        <div className={`p-5 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-gray-100"}`}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              Urgency Rankings
            </h2>
            <Badge variant="outline" className={`text-[10px] ${isDark ? "border-white/10 text-white/50" : "border-gray-200 text-gray-600"}`}>
              {rankedClustersSafe.length} clusters
            </Badge>
          </div>
          <p className={`text-xs mb-4 ${isDark ? "text-white/35" : "text-gray-500"}`}>
            score = severity × density × recency (72h half-life)
          </p>
          <div className="space-y-2">
            {rankedClustersSafe.map((cluster, i) => {
            const colors = URGENCY_COLORS[cluster.urgency.label];
            const topCat = Object.entries(cluster.category_breakdown).sort((a, b) => b[1] - a[1])[0];
            return (<div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${cluster.anomaly.isAnomaly
                    ? isDark
                        ? "bg-red-500/[0.06] border-red-500/15"
                        : "bg-red-50/50 border-red-100"
                    : isDark
                        ? "bg-white/[0.02] border-white/[0.04]"
                        : "bg-gray-50/50 border-gray-100"}`}>
                  
                  <span className={`text-base font-bold w-6 text-center ${isDark ? "text-white/20" : "text-gray-300"}`}>
                    {i + 1}
                  </span>

                  
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${colors.bg} ${colors.text} border ${colors.border}`}>
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`}/>
                    {cluster.urgency.score}
                  </div>

                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-medium capitalize truncate ${isDark ? "text-white/80" : "text-gray-700"}`}>
                        {topCat?.[0] ?? "Mixed"}
                      </span>
                      {cluster.anomaly.isAnomaly && (<AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0"/>)}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] ${isDark ? "text-white/25" : "text-gray-400"}`}>
                        <MapPin className="inline h-3 w-3 -mt-0.5"/> {cluster.latitude.toFixed(4)}, {cluster.longitude.toFixed(4)}
                      </span>
                    </div>
                  </div>

                  
                  <div className={`hidden md:flex flex-col items-end gap-0.5 text-[9px] font-mono ${isDark ? "text-white/25" : "text-gray-400"}`}>
                    <span>sev: {cluster.urgency.factors.severity}</span>
                    <span>den: {cluster.urgency.factors.density}</span>
                    <span>rec: {cluster.urgency.factors.recency}</span>
                  </div>

                  
                  <div className="flex flex-col items-center min-w-[52px]">
                    <span className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                      {cluster.count}
                    </span>
                    <span className={`text-[9px] ${isDark ? "text-white/30" : "text-gray-400"}`}>
                      reports
                    </span>
                  </div>
                </div>);
        })}
          </div>
        </div>

        
        {anomalyClusters.length > 0 && (<div className={`p-5 rounded-2xl border ${isDark ? "bg-white/[0.03] border-white/[0.06]" : "bg-white border-gray-100"}`}>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className={`h-4 w-4 ${isDark ? "text-red-400" : "text-red-500"}`}/>
              <h2 className={`text-sm font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
                Anomaly Details
              </h2>
            </div>
            <div className="space-y-2">
              {anomalyClusters.map((cluster, i) => (<div key={i} className={`flex items-start gap-3 px-4 py-3 rounded-xl ${isDark ? "bg-red-500/[0.06]" : "bg-red-50"}`}>
                    <ArrowUpRight className="h-4 w-4 text-red-400 mt-0.5 shrink-0"/>
                    <div>
                      <p className={`text-sm font-medium ${isDark ? "text-white/80" : "text-gray-700"}`}>
                        {cluster.anomaly.reason}
                      </p>
                      <p className={`text-xs mt-0.5 ${isDark ? "text-white/30" : "text-gray-400"}`}>
                        Spike ratio: {cluster.anomaly.spikeRatio}× · Avg daily: {cluster.anomaly.averageDailyRate} reports
                      </p>
                    </div>
                  </div>))}
            </div>
          </div>)}
      </div>
    </div>);
}
