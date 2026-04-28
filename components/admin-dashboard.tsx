"use client";
import { useState, useEffect, useMemo, useCallback, type Dispatch, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
import { Loader2, ChevronUp, ChevronDown, BarChart3, Flame, Droplets, ShieldAlert, Wrench, HeartPulse, Leaf, CircleHelp, MapPin, Download, Layers, Radio, Navigation, Play, Pause, } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ClusterResult } from "@/types";
const AdminMapInner = dynamic(() => import("@/components/admin-map-inner"), {
    ssr: false,
    loading: () => (<div className="flex items-center justify-center w-full h-full bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30"/>
    </div>),
});
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    flooding: <Droplets className="h-3.5 w-3.5 text-blue-400"/>,
    fire: <Flame className="h-3.5 w-3.5 text-orange-400"/>,
    crime: <ShieldAlert className="h-3.5 w-3.5 text-red-400"/>,
    infrastructure: <Wrench className="h-3.5 w-3.5 text-amber-400"/>,
    health: <HeartPulse className="h-3.5 w-3.5 text-pink-400"/>,
    environmental: <Leaf className="h-3.5 w-3.5 text-emerald-400"/>,
    other: <CircleHelp className="h-3.5 w-3.5 text-gray-400"/>,
};
const ALL_CATEGORIES = [
    "flooding",
    "fire",
    "crime",
    "infrastructure",
    "health",
    "environmental",
    "other",
];
type ClusterWithReports = ClusterResult & {
    weighted_score?: number;
    reports?: {
        id: string;
        receipt_id?: string;
        category: string;
        severity: number;
        created_at: string;
        latitude: number;
        longitude: number;
        status: string;
        description: string;
    }[];
};
type PlaybackFrame = {
    key: string;
    label: string;
    clusters: ClusterWithReports[];
    total_reports: number;
    noise_count: number;
    heat_points: [
        number,
        number,
        number
    ][];
};
function getDensityLabel(count: number) {
    if (count >= 15)
        return { text: "Critical", color: "bg-red-500" };
    if (count >= 10)
        return { text: "High", color: "bg-orange-500" };
    if (count >= 5)
        return { text: "Medium", color: "bg-amber-500" };
    return { text: "Low", color: "bg-emerald-500" };
}
export default function AdminDashboard() {
    const { theme } = useTheme();
    const { t } = useLanguage();
    const isDark = theme === "dark";
    const [clusters, setClusters] = useState<ClusterWithReports[]>([]);
    const [totalReports, setTotalReports] = useState(0);
    const [noiseCount, setNoiseCount] = useState(0);
    const [heatPoints, setHeatPoints] = useState<[
        number,
        number,
        number
    ][]>([]);
    const [playbackFrames, setPlaybackFrames] = useState<PlaybackFrame[]>([]);
    const [playbackEnabled, setPlaybackEnabled] = useState(false);
    const [playbackFrameIndex, setPlaybackFrameIndex] = useState(0);
    const [playbackRunning, setPlaybackRunning] = useState(false);
    const [timeWindow, setTimeWindow] = useState<"24h" | "7d" | "30d">("7d");
    const [liveMode, setLiveMode] = useState(false);
    const [liveIntervalSec, setLiveIntervalSec] = useState<15 | 30>(15);
    const [mapBounds, setMapBounds] = useState<{
        north: number;
        south: number;
        east: number;
        west: number;
    } | null>(null);
    const [filterInView, setFilterInView] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedCluster, setSelectedCluster] = useState<number | null>(null);
    const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(ALL_CATEGORIES));
    const [panelOpen, setPanelOpen] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [workflowReports, setWorkflowReports] = useState<{
        id: string;
        category: string;
        description: string;
        status: "pending" | "verified" | "in_progress" | "resolved";
        created_at: string;
        action_history?: {
            id: string;
            status: string;
            note: string;
            actor: string;
            created_at: string;
        }[];
    }[]>([]);
    const [workflowLoading, setWorkflowLoading] = useState(true);
    const [workflowSaving, setWorkflowSaving] = useState<string | null>(null);
    const [statusDrafts, setStatusDrafts] = useState<Record<string, "pending" | "verified" | "in_progress" | "resolved">>({});
    const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
    const loadClusters = useCallback(async (withPlayback: boolean) => {
        try {
            const res = await fetch("/api/clusters", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    window: timeWindow,
                    includePlayback: withPlayback,
                }),
            });
            const data = await res.json();
            setClusters(data.clusters ?? []);
            setTotalReports(data.total_reports ?? 0);
            setNoiseCount(data.noise_count ?? 0);
            setHeatPoints(data.heat_points ?? []);
            const frames: PlaybackFrame[] = data.playback_frames ?? [];
            setPlaybackFrames(frames);
            if (frames.length > 0) {
                setPlaybackFrameIndex((prev) => Math.min(prev, frames.length - 1));
            }
            else {
                setPlaybackFrameIndex(0);
            }
        }
        catch (err) {
            console.error("Failed to fetch clusters:", err);
        }
        finally {
            setLoading(false);
        }
    }, [timeWindow]);
    useEffect(() => {
        setLoading(true);
        void loadClusters(playbackEnabled);
    }, [loadClusters, playbackEnabled]);
    useEffect(() => {
        if (!liveMode)
            return;
        const id = window.setInterval(() => {
            void loadClusters(playbackEnabled);
        }, liveIntervalSec * 1000);
        return () => window.clearInterval(id);
    }, [liveMode, liveIntervalSec, loadClusters, playbackEnabled]);
    useEffect(() => {
        if (!playbackEnabled || !playbackRunning || playbackFrames.length <= 1)
            return;
        const id = window.setInterval(() => {
            setPlaybackFrameIndex((prev) => (prev + 1) % playbackFrames.length);
        }, 1400);
        return () => window.clearInterval(id);
    }, [playbackEnabled, playbackRunning, playbackFrames.length]);
    const loadWorkflowReports = async () => {
        setWorkflowLoading(true);
        try {
            const res = await fetch("/api/reports?limit=20");
            const data = await res.json();
            const reports = data.reports ?? [];
            setWorkflowReports(reports);
            const nextDrafts: Record<string, "pending" | "verified" | "in_progress" | "resolved"> = {};
            for (const r of reports)
                nextDrafts[r.id] = r.status;
            setStatusDrafts(nextDrafts);
        }
        catch {
            setWorkflowReports([]);
        }
        finally {
            setWorkflowLoading(false);
        }
    };
    useEffect(() => {
        loadWorkflowReports();
    }, []);
    const handleWorkflowUpdate = async (reportId: string) => {
        const nextStatus = statusDrafts[reportId];
        if (!nextStatus)
            return;
        setWorkflowSaving(reportId);
        try {
            await fetch("/api/reports", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    report_id: reportId,
                    status: nextStatus,
                    note: noteDrafts[reportId]?.trim() || "",
                    actor: "Admin",
                }),
            });
            setNoteDrafts((prev) => ({ ...prev, [reportId]: "" }));
            await loadWorkflowReports();
        }
        catch (err) {
            console.error("Workflow update failed:", err);
        }
        finally {
            setWorkflowSaving(null);
        }
    };
    const toggleCategory = (cat: string) => {
        setActiveCategories((prev) => {
            const next = new Set(prev);
            if (next.has(cat))
                next.delete(cat);
            else
                next.add(cat);
            return next;
        });
    };
    const activeFrame = playbackEnabled && playbackFrames.length > 0
        ? playbackFrames[playbackFrameIndex]
        : null;
    const sourceClusters = activeFrame ? activeFrame.clusters : clusters;
    const sourceHeatPoints = activeFrame ? activeFrame.heat_points : heatPoints;
    const sourceTotalReports = activeFrame ? activeFrame.total_reports : totalReports;
    const sourceNoiseCount = activeFrame ? activeFrame.noise_count : noiseCount;
    const filteredClusters = useMemo(() => {
        if (activeCategories.size === ALL_CATEGORIES.length)
            return sourceClusters.filter((cluster) => {
                if (!filterInView || !mapBounds)
                    return true;
                return (cluster.latitude >= mapBounds.south &&
                    cluster.latitude <= mapBounds.north &&
                    cluster.longitude >= mapBounds.west &&
                    cluster.longitude <= mapBounds.east);
            });
        return sourceClusters
            .map((c) => {
            const filteredBreakdown: Record<string, number> = {};
            let filteredCount = 0;
            for (const [cat, count] of Object.entries(c.category_breakdown)) {
                if (activeCategories.has(cat)) {
                    filteredBreakdown[cat] = count;
                    filteredCount += count;
                }
            }
            if (filteredCount === 0)
                return null;
            const inBounds = !filterInView ||
                !mapBounds ||
                (c.latitude >= mapBounds.south &&
                    c.latitude <= mapBounds.north &&
                    c.longitude >= mapBounds.west &&
                    c.longitude <= mapBounds.east);
            if (!inBounds)
                return null;
            return {
                ...c,
                count: filteredCount,
                category_breakdown: filteredBreakdown,
            };
        })
            .filter(Boolean) as ClusterWithReports[];
    }, [sourceClusters, activeCategories, filterInView, mapBounds]);
    const totalFiltered = filteredClusters.reduce((s, c) => s + c.count, 0);
    useEffect(() => {
        if (selectedCluster === null)
            return;
        if (selectedCluster >= filteredClusters.length) {
            setSelectedCluster(null);
        }
    }, [filteredClusters.length, selectedCluster]);
    return (<div className="relative flex flex-1 h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3rem)] overflow-hidden">
      
      <div className="absolute inset-0 z-0">
        <AdminMapInner clusters={filteredClusters} selectedCluster={selectedCluster} onClusterClick={setSelectedCluster} showHeatmap={showHeatmap} heatPoints={sourceHeatPoints} onMapBoundsChange={setMapBounds}/>
      </div>

      
      <aside className={`hidden md:flex flex-col w-80 relative z-10 border-r overflow-y-auto ${isDark
            ? "bg-black/80 backdrop-blur-xl border-white/[0.06]"
            : "bg-white/80 backdrop-blur-xl border-black/[0.06]"}`}>
        <SidebarContent isDark={isDark} loading={loading} totalReports={sourceTotalReports} totalFiltered={totalFiltered} noiseCount={sourceNoiseCount} clusters={filteredClusters} selectedCluster={selectedCluster} setSelectedCluster={setSelectedCluster} activeCategories={activeCategories} toggleCategory={toggleCategory} filterInView={filterInView} setFilterInView={setFilterInView} mapBounds={mapBounds} t={t} workflowReports={workflowReports} workflowLoading={workflowLoading} workflowSaving={workflowSaving} statusDrafts={statusDrafts} setStatusDrafts={setStatusDrafts} noteDrafts={noteDrafts} setNoteDrafts={setNoteDrafts} handleWorkflowUpdate={handleWorkflowUpdate}/>
      </aside>

      
      <div className="hidden md:flex flex-wrap gap-2 absolute top-4 right-4 z-[1000] max-w-[70vw] justify-end">
        <div className={`flex items-center rounded-xl border px-2 py-1 text-xs backdrop-blur-xl ${isDark
            ? "bg-black/60 border-white/10 text-white/70"
            : "bg-white/70 border-gray-200 text-gray-700"}`}>
          <span className="mr-1">Window</span>
          <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value as "24h" | "7d" | "30d")} className={`bg-transparent outline-none ${isDark ? "text-white" : "text-gray-800"}`}>
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
          </select>
        </div>
        <button onClick={() => setLiveMode((prev) => !prev)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium backdrop-blur-xl transition-colors ${liveMode
            ? isDark
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-emerald-50 text-emerald-700 border border-emerald-200"
            : isDark
                ? "bg-black/60 text-white/60 border border-white/10 hover:bg-black/80"
                : "bg-white/60 text-gray-600 border border-gray-200 hover:bg-white/80"}`}>
          <Radio className="h-3.5 w-3.5"/>
          Live {liveMode ? "On" : "Off"}
        </button>
        <button onClick={() => setLiveIntervalSec((prev) => (prev === 15 ? 30 : 15))} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium backdrop-blur-xl transition-colors ${isDark
            ? "bg-black/60 text-white/60 border border-white/10 hover:bg-black/80"
            : "bg-white/60 text-gray-600 border border-gray-200 hover:bg-white/80"}`}>
          {liveIntervalSec}s
        </button>
        <button onClick={() => {
            setPlaybackEnabled((prev) => !prev);
            setPlaybackRunning(false);
        }} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium backdrop-blur-xl transition-colors ${playbackEnabled
            ? isDark
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
            : isDark
                ? "bg-black/60 text-white/60 border border-white/10 hover:bg-black/80"
                : "bg-white/60 text-gray-600 border border-gray-200 hover:bg-white/80"}`}>
          {playbackEnabled ? "Playback On" : "Playback Off"}
        </button>
        {playbackEnabled && playbackFrames.length > 0 && (<button onClick={() => setPlaybackRunning((prev) => !prev)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium backdrop-blur-xl transition-colors ${isDark
                ? "bg-black/60 text-white/70 border border-white/10 hover:bg-black/80"
                : "bg-white/60 text-gray-700 border border-gray-200 hover:bg-white/80"}`}>
            {playbackRunning ? <Pause className="h-3.5 w-3.5"/> : <Play className="h-3.5 w-3.5"/>}
            {playbackRunning ? "Pause" : "Play"}
          </button>)}
        <button onClick={() => setShowHeatmap(!showHeatmap)} className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium backdrop-blur-xl transition-colors ${showHeatmap
            ? isDark
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
            : isDark
                ? "bg-black/60 text-white/60 border border-white/10 hover:bg-black/80"
                : "bg-white/60 text-gray-600 border border-gray-200 hover:bg-white/80"}`}>
          <Layers className="h-3.5 w-3.5"/>
          Heatmap
        </button>
      </div>
      {playbackEnabled && playbackFrames.length > 0 && (<div className={`hidden md:flex items-center gap-2 absolute top-16 right-4 z-[1000] rounded-xl border px-3 py-2 text-xs backdrop-blur-xl ${isDark
              ? "bg-black/60 border-white/10 text-white/75"
              : "bg-white/70 border-gray-200 text-gray-700"}`}>
          <input type="range" min={0} max={Math.max(0, playbackFrames.length - 1)} value={playbackFrameIndex} onChange={(e) => setPlaybackFrameIndex(Number(e.target.value))}/>
          <span className="font-mono">{playbackFrames[playbackFrameIndex]?.label ?? "-"}</span>
        </div>)}

      
      <button onClick={() => setShowHeatmap(!showHeatmap)} className={`md:hidden absolute top-4 right-4 z-[1000] flex items-center justify-center w-10 h-10 rounded-full shadow-lg backdrop-blur-xl transition-colors ${showHeatmap
            ? isDark
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "bg-indigo-50 text-indigo-700 border border-indigo-200"
            : isDark
                ? "bg-black/60 text-white/60 border border-white/10 hover:bg-black/80"
                : "bg-white/60 text-gray-600 border border-gray-200 hover:bg-white/80"}`}>
        <Layers className="h-4 w-4"/>
      </button>

      
      <div className={`md:hidden absolute bottom-0 left-0 right-0 z-[1000] transition-transform duration-300 ${panelOpen ? "translate-y-0" : "translate-y-[calc(100%-3.5rem)]"}`}>
        
        <button onClick={() => setPanelOpen(!panelOpen)} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-t-2xl border-t ${isDark
            ? "bg-black/90 border-white/[0.08] text-white/70"
            : "bg-white/90 border-black/[0.08] text-gray-600"}`}>
          {panelOpen ? (<ChevronDown className="h-4 w-4"/>) : (<ChevronUp className="h-4 w-4"/>)}
          <span className="text-xs font-medium">
            {loading
            ? "Loading…"
            : `${filteredClusters.length} hotspots · ${totalFiltered} reports`}
          </span>
        </button>
        <div className={`h-[60vh] overflow-y-auto ${isDark ? "bg-black/90 backdrop-blur-xl" : "bg-white/90 backdrop-blur-xl"}`}>
          <SidebarContent isDark={isDark} loading={loading} totalReports={sourceTotalReports} totalFiltered={totalFiltered} noiseCount={sourceNoiseCount} clusters={filteredClusters} selectedCluster={selectedCluster} setSelectedCluster={(i) => {
            setSelectedCluster(i);
            setPanelOpen(false);
        }} activeCategories={activeCategories} toggleCategory={toggleCategory} filterInView={filterInView} setFilterInView={setFilterInView} mapBounds={mapBounds} t={t} workflowReports={workflowReports} workflowLoading={workflowLoading} workflowSaving={workflowSaving} statusDrafts={statusDrafts} setStatusDrafts={setStatusDrafts} noteDrafts={noteDrafts} setNoteDrafts={setNoteDrafts} handleWorkflowUpdate={handleWorkflowUpdate}/>
        </div>
      </div>
    </div>);
}
function SidebarContent({ isDark, loading, totalReports, totalFiltered, noiseCount, clusters, selectedCluster, setSelectedCluster, activeCategories, toggleCategory, filterInView, setFilterInView, mapBounds, t, workflowReports, workflowLoading, workflowSaving, statusDrafts, setStatusDrafts, noteDrafts, setNoteDrafts, handleWorkflowUpdate, }: {
    isDark: boolean;
    loading: boolean;
    totalReports: number;
    totalFiltered: number;
    noiseCount: number;
    clusters: ClusterWithReports[];
    selectedCluster: number | null;
    setSelectedCluster: (i: number | null) => void;
    activeCategories: Set<string>;
    toggleCategory: (cat: string) => void;
    filterInView: boolean;
    setFilterInView: Dispatch<SetStateAction<boolean>>;
    mapBounds: {
        north: number;
        south: number;
        east: number;
        west: number;
    } | null;
    t: ReturnType<typeof import("@/lib/i18n").getTranslations>;
    workflowReports: {
        id: string;
        category: string;
        description: string;
        status: "pending" | "verified" | "in_progress" | "resolved";
        created_at: string;
        action_history?: {
            id: string;
            status: string;
            note: string;
            actor: string;
            created_at: string;
        }[];
    }[];
    workflowLoading: boolean;
    workflowSaving: string | null;
    statusDrafts: Record<string, "pending" | "verified" | "in_progress" | "resolved">;
    setStatusDrafts: Dispatch<SetStateAction<Record<string, "pending" | "verified" | "in_progress" | "resolved">>>;
    noteDrafts: Record<string, string>;
    setNoteDrafts: Dispatch<SetStateAction<Record<string, string>>>;
    handleWorkflowUpdate: (reportId: string) => Promise<void>;
}) {
    const exportCSV = () => {
        const header = "Cluster,Latitude,Longitude,Report Count,Top Category,Density\n";
        const rows = clusters.map((c, i) => {
            const topCat = Object.entries(c.category_breakdown).sort((a, b) => b[1] - a[1])[0];
            const density = c.count >= 15 ? "Critical" : c.count >= 10 ? "High" : c.count >= 5 ? "Medium" : "Low";
            return `${i + 1},${c.latitude},${c.longitude},${c.count},${topCat?.[0] ?? "mixed"},${density}`;
        }).join("\n");
        const blob = new Blob([header + rows], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `speakup-payatas-report-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };
    return (<div className="flex flex-col gap-4 p-4 md:gap-5 md:p-5">
      
      <div>
        <h2 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/45" : "text-gray-500"}`}>
          {t.adminOverview}
        </h2>
        {loading ? (<div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin"/>
            <span className="text-sm">Loading data…</span>
          </div>) : (<div className="grid grid-cols-3 gap-2">
            {[
                { label: t.adminReports, value: totalReports, icon: BarChart3 },
                { label: t.adminHotspots, value: clusters.length, icon: MapPin },
                { label: t.adminScattered, value: noiseCount, icon: MapPin },
            ].map((stat) => (<div key={stat.label} className={`flex flex-col items-center gap-1 py-3 rounded-xl border ${isDark ? "bg-white/[0.04] border-white/[0.06]" : "bg-black/[0.03] border-black/[0.05]"}`}>
                <span className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                  {stat.value}
                </span>
                <span className={`text-[10px] font-medium ${isDark ? "text-white/45" : "text-gray-500"}`}>
                  {stat.label}
                </span>
              </div>))}
          </div>)}
      </div>

      
      <div>
        <h2 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/45" : "text-gray-500"}`}>
          {t.adminFilterCategory}
        </h2>
        <div className="mb-2">
          <button type="button" onClick={() => setFilterInView((prev) => !prev)} className={`inline-flex items-center gap-1.5 min-h-8 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterInView
                ? isDark
                    ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                    : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                : isDark
                    ? "bg-white/[0.03] text-white/55 border border-white/[0.08]"
                    : "bg-black/[0.02] text-gray-500 border border-black/[0.06]"}`}>
            <MapPin className="h-3.5 w-3.5"/>
            {filterInView ? "Showing map view only" : "Show all hotspots"}
          </button>
          {filterInView && mapBounds && (<p className={`mt-1 text-[10px] font-mono ${isDark ? "text-white/30" : "text-gray-400"}`}>
              N{mapBounds.north.toFixed(3)} S{mapBounds.south.toFixed(3)} E{mapBounds.east.toFixed(3)} W{mapBounds.west.toFixed(3)}
            </p>)}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((cat) => {
            const isActive = activeCategories.has(cat);
            return (<button key={cat} onClick={() => toggleCategory(cat)} className={`flex min-h-8 items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${isActive
                    ? isDark
                        ? "bg-white/10 text-white ring-1 ring-white/15"
                        : "bg-gray-100 text-gray-900 ring-1 ring-gray-200"
                    : isDark
                        ? "bg-white/[0.03] text-white/45 hover:bg-white/[0.06]"
                        : "bg-black/[0.02] text-gray-400 hover:bg-black/[0.05]"}`}>
                {CATEGORY_ICONS[cat]}
                {cat === "infrastructure" ? "Infra" : cat}
              </button>);
        })}
        </div>
      </div>

      
      <div>
        <h2 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/45" : "text-gray-500"}`}>
          {t.adminHotspotsCount(clusters.length)}
        </h2>
        {clusters.length === 0 && !loading && (<p className={`text-sm ${isDark ? "text-white/30" : "text-gray-400"}`}>
            {t.adminNoMatch}
          </p>)}
        <div className="flex flex-col gap-2">
          {clusters.map((cluster, i) => {
            const density = getDensityLabel(cluster.count);
            const isSelected = selectedCluster === i;
            const topCategory = Object.entries(cluster.category_breakdown).sort((a, b) => b[1] - a[1])[0];
            return (<button key={i} onClick={() => setSelectedCluster(isSelected ? null : i)} className={`flex items-center gap-3 px-3 py-3 rounded-xl text-left border transition-all ${isSelected
                    ? isDark
                        ? "bg-indigo-500/15 border-indigo-500/35 ring-1 ring-indigo-500/25"
                        : "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200"
                    : isDark
                        ? "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.06]"
                        : "bg-black/[0.02] border-black/[0.05] hover:bg-black/[0.04]"}`}>
                <div className="flex flex-col items-center gap-1 min-w-[40px]">
                  <span className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}>
                    {cluster.count}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${density.color}`}/>
                    <span className={`text-[9px] font-medium ${isDark ? "text-white/40" : "text-gray-400"}`}>
                      {density.text}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    {topCategory && CATEGORY_ICONS[topCategory[0]]}
                    <span className={`text-sm font-medium capitalize truncate ${isDark ? "text-white/80" : "text-gray-700"}`}>
                      {topCategory ? topCategory[0] : "Mixed"}
                    </span>
                  </div>
                  <span className={`block text-[10px] font-mono truncate ${isDark ? "text-white/30" : "text-gray-400"}`}>
                    {cluster.latitude.toFixed(5)}, {cluster.longitude.toFixed(5)}
                  </span>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${isDark ? "border-white/10 text-white/45" : "border-gray-200 text-gray-500"}`}>
                  {Object.keys(cluster.category_breakdown).length} type
                  {Object.keys(cluster.category_breakdown).length > 1 ? "s" : ""}
                </Badge>
              </button>);
        })}
        </div>
      </div>

      
      {selectedCluster !== null && clusters[selectedCluster] && (<div>
          <h2 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/45" : "text-gray-500"}`}>
            Cluster Drill-down
          </h2>
          <div className={`rounded-xl border p-3 space-y-2 ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-black/[0.06] bg-black/[0.01]"}`}>
            <div className="flex items-center justify-between">
              <p className={`text-xs font-semibold ${isDark ? "text-white/80" : "text-gray-800"}`}>
                {clusters[selectedCluster].count} reports · score {Math.round(clusters[selectedCluster].weighted_score ?? clusters[selectedCluster].count)}
              </p>
              <div className="flex items-center gap-1">
                <a href={`https://www.google.com/maps/search/?api=1&query=${clusters[selectedCluster].latitude},${clusters[selectedCluster].longitude}`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] ${isDark ? "bg-white/[0.05] text-white/70" : "bg-gray-100 text-gray-700"}`}>
                  <Navigation className="h-3 w-3"/> Google
                </a>
                <a href={`https://waze.com/ul?ll=${clusters[selectedCluster].latitude}%2C${clusters[selectedCluster].longitude}&navigate=yes`} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] ${isDark ? "bg-white/[0.05] text-white/70" : "bg-gray-100 text-gray-700"}`}>
                  <Navigation className="h-3 w-3"/> Waze
                </a>
              </div>
            </div>
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {(clusters[selectedCluster].reports ?? []).slice(0, 20).map((report) => (<div key={report.id} className={`rounded-lg border px-2 py-2 ${isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-black/[0.06] bg-black/[0.01]"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-xs capitalize font-medium ${isDark ? "text-white/80" : "text-gray-800"}`}>
                      {report.category} · S{report.severity}
                    </p>
                    <span className={`text-[10px] ${isDark ? "text-white/35" : "text-gray-500"}`}>
                      {new Date(report.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  {report.receipt_id && (<p className={`text-[10px] font-mono ${isDark ? "text-white/40" : "text-gray-500"}`}>
                      {report.receipt_id}
                    </p>)}
                  {report.description && (<p className={`text-[10px] mt-1 max-h-8 overflow-hidden ${isDark ? "text-white/55" : "text-gray-600"}`}>
                      {report.description}
                    </p>)}
                </div>))}
            </div>
          </div>
        </div>)}

      
      <div>
        <h2 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/45" : "text-gray-500"}`}>
          {t.adminDensityLegend}
        </h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            { color: "bg-emerald-500", label: t.adminDensityLow },
            { color: "bg-amber-500", label: t.adminDensityMedium },
            { color: "bg-orange-500", label: t.adminDensityHigh },
            { color: "bg-red-500", label: t.adminDensityCritical },
        ].map((item) => (<div key={item.color} className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${item.color}`}/>
              <span className={`text-xs ${isDark ? "text-white/50" : "text-gray-500"}`}>
                {item.label}
              </span>
            </div>))}
        </div>
      </div>

      
      {clusters.length > 0 && (<button onClick={exportCSV} className={`mt-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-colors ${isDark
                ? "bg-white/[0.06] border-white/10 text-white/75 hover:bg-white/10 hover:text-white"
                : "bg-black/[0.04] border-black/10 text-gray-600 hover:bg-black/[0.08] hover:text-gray-900"}`}>
          <Download className="h-3.5 w-3.5"/>
          {t.adminExportCSV}
        </button>)}

      
      <div>
        <h2 className={`text-[11px] font-semibold uppercase tracking-wider mb-3 ${isDark ? "text-white/45" : "text-gray-500"}`}>
          Status Workflow
        </h2>
        {workflowLoading ? (<div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin"/>
            <span className="text-xs opacity-70">Loading workflow queue…</span>
          </div>) : workflowReports.length === 0 ? (<p className={`text-xs ${isDark ? "text-white/35" : "text-gray-500"}`}>No reports available.</p>) : (<div className="space-y-2">
            {workflowReports.map((report) => {
                const latestAction = report.action_history?.[report.action_history.length - 1];
                return (<div key={report.id} className={`rounded-xl border p-3 ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-black/[0.06] bg-black/[0.01]"}`}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p className={`text-xs font-semibold capitalize ${isDark ? "text-white/80" : "text-gray-800"}`}>
                        {report.category}
                      </p>
                      <p className={`text-[10px] truncate ${isDark ? "text-white/35" : "text-gray-500"}`}>
                        {report.description || "No description"}
                      </p>
                    </div>
                    <Badge variant="outline" className={isDark ? "border-white/10 text-white/55" : ""}>
                      {report.status.replace("_", " ")}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <select value={statusDrafts[report.id] ?? report.status} onChange={(e) => setStatusDrafts((prev) => ({
                        ...prev,
                        [report.id]: e.target.value as "pending" | "verified" | "in_progress" | "resolved",
                    }))} className={`h-8 rounded-lg px-2 text-xs border ${isDark
                        ? "bg-white/[0.05] border-white/10 text-white"
                        : "bg-white border-gray-200 text-gray-700"}`}>
                      <option value="pending">Pending</option>
                      <option value="verified">Verified</option>
                      <option value="in_progress">In Progress</option>
                      <option value="resolved">Resolved</option>
                    </select>
                    <input value={noteDrafts[report.id] ?? ""} onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [report.id]: e.target.value }))} placeholder="Action note (optional)" className={`h-8 rounded-lg px-2 text-xs border ${isDark
                        ? "bg-white/[0.05] border-white/10 text-white placeholder:text-white/30"
                        : "bg-white border-gray-200 text-gray-700 placeholder:text-gray-400"}`}/>
                    <button type="button" onClick={() => handleWorkflowUpdate(report.id)} disabled={workflowSaving === report.id} className={`h-8 rounded-lg text-xs font-medium transition-colors ${isDark
                        ? "bg-white/[0.07] text-white/70 hover:bg-white/[0.12]"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
                      {workflowSaving === report.id ? "Saving..." : "Update status"}
                    </button>
                  </div>

                  {latestAction && (<p className={`mt-2 text-[10px] ${isDark ? "text-white/30" : "text-gray-500"}`}>
                      Last action: {latestAction.note}
                    </p>)}
                </div>);
            })}
          </div>)}
      </div>
    </div>);
}
