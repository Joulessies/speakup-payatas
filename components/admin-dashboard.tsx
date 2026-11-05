"use client";
import { useState, useEffect, useMemo, useCallback, type Dispatch, type SetStateAction } from "react";
import dynamic from "next/dynamic";
import { useTheme } from "@/components/theme-provider";
import { useLanguage } from "@/components/language-provider";
import { translateCategory } from "@/lib/i18n";
import { Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, BarChart3, Flame, Droplets, ShieldAlert, Wrench, HeartPulse, Leaf, CircleHelp, MapPin, Download, Layers, Radio, Navigation, Play, Pause, Compass, Volume2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import VerificationPanel from "./verification-panel";
import type { ClusterResult } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AdminMapInner = dynamic(() => import("@/components/admin-map-inner"), {
    ssr: false,
    loading: () => (<div className="flex items-center justify-center w-full h-full bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/30"/>
    </div>),
});

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
    drainage_flooding: <Droplets className="h-3.5 w-3.5 text-blue-400"/>,
    flooding: <Droplets className="h-3.5 w-3.5 text-blue-400"/>,
    fire_hazard: <Flame className="h-3.5 w-3.5 text-orange-400"/>,
    fire: <Flame className="h-3.5 w-3.5 text-orange-400"/>,
    safety_concern: <ShieldAlert className="h-3.5 w-3.5 text-red-400"/>,
    crime: <ShieldAlert className="h-3.5 w-3.5 text-red-400"/>,
    infrastructure: <Wrench className="h-3.5 w-3.5 text-amber-400"/>,
    sanitation_health: <HeartPulse className="h-3.5 w-3.5 text-emerald-400"/>,
    health: <HeartPulse className="h-3.5 w-3.5 text-emerald-400"/>,
    noise_nuisance: <Volume2 className="h-3.5 w-3.5 text-purple-400"/>,
    noise: <Volume2 className="h-3.5 w-3.5 text-purple-400"/>,
    environmental: <Leaf className="h-3.5 w-3.5 text-teal-400"/>,
    other: <CircleHelp className="h-3.5 w-3.5 text-gray-400"/>,
};

const ALL_CATEGORIES = [
    "drainage_flooding",
    "fire_hazard",
    "safety_concern",
    "infrastructure",
    "sanitation_health",
    "noise_nuisance",
    "environmental",
    "other",
];

function normalizeCategory(cat: string): string {
    if (!cat) return "other";
    const s = cat.toLowerCase().trim();
    if (s.includes("drain") || s.includes("flood")) return "drainage_flooding";
    if (s.includes("fire")) return "fire_hazard";
    if (s.includes("safe") || s.includes("crime")) return "safety_concern";
    if (s.includes("infra") || s.includes("road") || s.includes("light")) return "infrastructure";
    if (s.includes("sanit") || s.includes("health") || s.includes("waste") || s.includes("dengue")) return "sanitation_health";
    if (s.includes("noise") || s.includes("nuisance")) return "noise_nuisance";
    if (s.includes("environ")) return "environmental";
    return s.replace(/[\s\/\-]+/g, "_");
}

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

function getDensityLabel(count: number, t: any) {
    if (count >= 15)
        return { text: t.sevCritical || "Critical", color: "bg-red-500" };
    if (count >= 10)
        return { text: t.sevHigh || "High", color: "bg-orange-500" };
    if (count >= 5)
        return { text: t.sevModerate || "Medium", color: "bg-amber-500" };
    return { text: t.sevLow || "Low", color: "bg-emerald-500" };
}

export default function AdminDashboard({ role = "admin" }: { role?: "admin" | "staff" } = {}) {
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
    const [timeWindow, setTimeWindow] = useState<"24h" | "7d" | "30d" | "all">("all");
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
    const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
    const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set(ALL_CATEGORIES));
    const [panelOpen, setPanelOpen] = useState(false);
    const [showHeatmap, setShowHeatmap] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [sidebarTab, setSidebarTab] = useState<"map" | "queue">("map");
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
    const [clusterError, setClusterError] = useState<string | null>(null);
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
            const data = await res.json().catch(() => ({} as Record<string, unknown>));
            if (!res.ok) {
                const msg = (data && typeof (data as { error?: unknown }).error === "string")
                    ? (data as { error: string }).error
                    : `Request failed (${res.status})`;
                setClusterError(msg);
                console.error("Failed to fetch clusters:", msg);
                return;
            }
            setClusterError(null);
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
            setClusterError(err instanceof Error ? err.message : "Network error loading clusters.");
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
            const res = await fetch("/api/reports?limit=500");
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
            for (const [rawCat, count] of Object.entries(c.category_breakdown)) {
                const norm = normalizeCategory(rawCat);
                if (activeCategories.has(norm) || activeCategories.has(rawCat)) {
                    filteredBreakdown[rawCat] = count;
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
    const selectedCluster = useMemo(() => {
        if (selectedClusterId === null) return null;
        const idx = filteredClusters.findIndex(
            (c) => `${c.latitude.toFixed(6)}_${c.longitude.toFixed(6)}` === selectedClusterId
        );
        return idx !== -1 ? idx : null;
    }, [filteredClusters, selectedClusterId]);

    const handleClusterClick = (idx: number | null) => {
        if (idx === null) {
            setSelectedClusterId(null);
        } else {
            const c = filteredClusters[idx];
            setSelectedClusterId(c ? `${c.latitude.toFixed(6)}_${c.longitude.toFixed(6)}` : null);
        }
    };

    return (<div className="relative flex flex-col h-full overflow-hidden">
      
      <div className="absolute inset-0 z-0">
        <AdminMapInner clusters={filteredClusters} selectedCluster={selectedCluster} onClusterClick={handleClusterClick} showHeatmap={showHeatmap} heatPoints={sourceHeatPoints} onMapBoundsChange={setMapBounds}/>
      </div>

      {clusterError && (
        <div className="absolute top-16 right-4 z-[1100] max-w-sm flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200 backdrop-blur-md shadow-xl">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="font-semibold">Map data couldn&apos;t load</p>
            <p className="opacity-90 truncate">{clusterError}</p>
          </div>
          <button
            type="button"
            onClick={() => { setClusterError(null); void loadClusters(playbackEnabled); }}
            className="ml-auto shrink-0 px-2 py-1 rounded-md bg-red-500/20 hover:bg-red-500/30 text-[11px] font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Floating Tactical Command Panel (Desktop) */}
      {sidebarOpen ? (
        <aside 
          className={`hidden md:flex flex-col absolute top-3 left-3 bottom-3 z-20 rounded-2xl border shadow-2xl backdrop-blur-2xl transition-all duration-300 overflow-hidden ${
            sidebarTab === "queue" ? "w-[480px] lg:w-[560px]" : "w-[380px] lg:w-[410px]"
          } ${
            isDark
              ? "bg-[#04271e]/95 border-emerald-500/25 shadow-[0_12px_40px_rgba(0,0,0,0.65)]"
              : "bg-white/95 border-emerald-200/80 shadow-[0_12px_40px_rgba(4,120,87,0.12)]"
          }`}
        >
          {/* Elevated Panel Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-emerald-500/15 shrink-0 bg-black/10 dark:bg-black/30">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/20 text-emerald-300 shrink-0 border border-emerald-500/30">
                <Compass className="h-4 w-4 text-emerald-400" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold tracking-wide truncate ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                    Incident Command
                  </span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    Payatas
                  </span>
                </div>
                <p className={`text-[10px] truncate ${isDark ? "text-white/50" : "text-gray-500"}`}>
                  DBSCAN Hotspots & Dispatch
                </p>
              </div>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              aria-label="Collapse panel"
              className={`p-1.5 rounded-lg transition-colors shrink-0 ${
                isDark ? "text-white/50 hover:text-white hover:bg-white/10" : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto">
            <SidebarContent
              isDark={isDark}
              loading={loading}
              totalReports={sourceTotalReports}
              totalFiltered={totalFiltered}
              noiseCount={sourceNoiseCount}
              clusters={filteredClusters}
              selectedCluster={selectedCluster}
              setSelectedCluster={handleClusterClick}
              activeCategories={activeCategories}
              toggleCategory={toggleCategory}
              filterInView={filterInView}
              setFilterInView={setFilterInView}
              mapBounds={mapBounds}
              t={t}
              workflowReports={workflowReports}
              workflowLoading={workflowLoading}
              workflowSaving={workflowSaving}
              statusDrafts={statusDrafts}
              setStatusDrafts={setStatusDrafts}
              noteDrafts={noteDrafts}
              setNoteDrafts={setNoteDrafts}
              handleWorkflowUpdate={handleWorkflowUpdate}
              showHeatmap={showHeatmap}
              sidebarTab={sidebarTab}
              setSidebarTab={setSidebarTab}
              role={role}
            />
          </div>
        </aside>
      ) : (
        /* Collapsed Floating Trigger */
        <button
          onClick={() => setSidebarOpen(true)}
          aria-label="Open hotspot command panel"
          className={`hidden md:flex items-center gap-2.5 absolute top-3 left-3 z-20 px-3 py-2 rounded-xl border backdrop-blur-xl shadow-2xl transition-all hover:scale-105 active:scale-95 group ${
            isDark
              ? "bg-[#04271e]/90 border-emerald-500/30 text-white hover:bg-[#06382b]"
              : "bg-white/90 border-emerald-200 text-[#064e3b] hover:bg-white"
          }`}
        >
          <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-300">
            <Flame className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold">Hotspot Controls</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                {filteredClusters.length}
              </span>
            </div>
            <span className={`text-[10px] transition-colors ${isDark ? "text-white/50 group-hover:text-emerald-300" : "text-gray-500 group-hover:text-emerald-700"}`}>
              Click to expand
            </span>
          </div>
          <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity ml-1" />
        </button>
      )}

      
      <div className="hidden md:flex flex-wrap gap-2 absolute top-4 right-4 z-[1000] max-w-[70vw] justify-end">
        <div className={`flex items-center rounded-xl border px-3 py-1 text-xs font-medium backdrop-blur-xl transition-colors ${isDark
            ? "bg-card/80 border-white/10 text-white/70 hover:bg-muted"
            : "bg-white/80 border-border text-foreground hover:bg-white"}`}>
          <span className="mr-1.5 opacity-80">Window</span>
          <Select value={timeWindow} onValueChange={(val) => setTimeWindow(val as "24h" | "7d" | "30d" | "all")}>
            <SelectTrigger className={`h-auto border-0 bg-transparent dark:bg-transparent dark:hover:bg-transparent hover:bg-transparent text-xs focus:ring-0 focus:ring-offset-0 p-0 w-auto shadow-none font-semibold ${isDark ? "text-white" : "text-gray-900"}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="min-w-[120px]">
              <SelectItem value="24h">24 Hours</SelectItem>
              <SelectItem value="7d">7 Days</SelectItem>
              <SelectItem value="30d">30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
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
                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                : "bg-[#e6f4ea] text-[#047857] border border-emerald-200"
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
        <button onClick={() => setShowHeatmap(!showHeatmap)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium backdrop-blur-xl transition-all duration-200 shadow-sm hover:shadow-md transform hover:scale-[1.02] active:scale-[0.98] ${showHeatmap
            ? isDark
                ? "bg-gradient-to-r from-emerald-600/30 to-teal-600/30 text-emerald-200 border border-emerald-500/40 shadow-emerald-500/10"
                : "bg-[#e6f4ea] text-[#047857] border border-emerald-300 shadow-emerald-500/20"
            : isDark
                ? "bg-black/60 text-white/70 border border-white/10 hover:bg-black/80 hover:text-white hover:border-white/20"
                : "bg-white/70 text-gray-700 border border-gray-200 hover:bg-white/90 hover:text-gray-900 hover:border-gray-300"}`}>
          <div className={`relative ${showHeatmap ? "animate-pulse" : ""}`}>
            <Layers className={`h-4 w-4 ${showHeatmap ? "text-emerald-400" : ""}`} />
            {showHeatmap && <div className="absolute -inset-1 bg-emerald-400 rounded-full blur-sm opacity-30 animate-ping"></div>}
          </div>
          <span className="font-medium">{showHeatmap ? t.mapHeatmapActive : t.mapHeatmap}</span>
          {showHeatmap && <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>}
        </button>
      </div>
      {playbackEnabled && playbackFrames.length > 0 && (<div className={`hidden md:flex items-center gap-2 absolute top-16 right-4 z-[1000] rounded-xl border px-3 py-2 text-xs backdrop-blur-xl ${isDark
              ? "bg-black/60 border-white/10 text-white/75"
              : "bg-white/70 border-gray-200 text-gray-700"}`}>
          <input type="range" min={0} max={Math.max(0, playbackFrames.length - 1)} value={playbackFrameIndex} onChange={(e) => setPlaybackFrameIndex(Number(e.target.value))}/>
          <span className="font-mono">{playbackFrames[playbackFrameIndex]?.label ?? "-"}</span>
        </div>)}

      
      <button onClick={() => setShowHeatmap(!showHeatmap)} className={`md:hidden absolute top-4 right-4 z-[1000] flex items-center justify-center w-12 h-12 rounded-full shadow-lg backdrop-blur-xl transition-all duration-200 hover:shadow-xl transform hover:scale-105 active:scale-95 ${showHeatmap
            ? isDark
                ? "bg-gradient-to-r from-emerald-600/30 to-teal-600/30 text-emerald-200 border border-emerald-500/40 shadow-emerald-500/20"
                : "bg-[#e6f4ea] text-[#047857] border border-emerald-300 shadow-emerald-500/30"
            : isDark
                ? "bg-black/60 text-white/60 border border-white/10 hover:bg-black/80 hover:text-white"
                : "bg-white/60 text-gray-600 border border-gray-200 hover:bg-white/80 hover:text-gray-900"}`}>
        <div className={`relative ${showHeatmap ? "animate-pulse" : ""}`}>
          <Layers className={`h-5 w-5 ${showHeatmap ? "text-emerald-400" : ""}`} />
          {showHeatmap && <div className="absolute -inset-1 bg-emerald-400 rounded-full blur-sm opacity-30 animate-ping"></div>}
        </div>
        {showHeatmap && <div className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse"></div>}
      </button>

      
      <div className={`md:hidden absolute bottom-0 left-0 right-0 z-[1000] transition-transform duration-300 ${panelOpen ? "translate-y-0" : "translate-y-[calc(100%-3.5rem)]"}`}>
        
        <button onClick={() => setPanelOpen(!panelOpen)} className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-t-2xl border-t ${isDark
            ? "bg-[#04271e]/90 border-emerald-500/20 text-white/70"
            : "bg-[#f4fbf7]/90 border-emerald-200 text-[#064e3b]"}`}>
          {panelOpen ? (<ChevronDown className="h-4 w-4"/>) : (<ChevronUp className="h-4 w-4"/>)}
          <span className="text-xs font-medium">
            {loading
            ? "Loading…"
            : `${filteredClusters.length} hotspots · ${totalFiltered} reports`}
          </span>
        </button>
        <div style={{ backgroundColor: isDark ? "#04271e" : "#f4fbf7" }} className={`h-[60vh] overflow-y-auto`}>
          <SidebarContent
            isDark={isDark}
            loading={loading}
            totalReports={sourceTotalReports}
            totalFiltered={totalFiltered}
            noiseCount={sourceNoiseCount}
            clusters={filteredClusters}
            selectedCluster={selectedCluster}
            setSelectedCluster={(i) => {
              handleClusterClick(i);
              setPanelOpen(false);
            }}
            activeCategories={activeCategories}
            toggleCategory={toggleCategory}
            filterInView={filterInView}
            setFilterInView={setFilterInView}
            mapBounds={mapBounds}
            t={t}
            workflowReports={workflowReports}
            workflowLoading={workflowLoading}
            workflowSaving={workflowSaving}
            statusDrafts={statusDrafts}
            setStatusDrafts={setStatusDrafts}
            noteDrafts={noteDrafts}
            setNoteDrafts={setNoteDrafts}
            handleWorkflowUpdate={handleWorkflowUpdate}
            showHeatmap={showHeatmap}
            sidebarTab={sidebarTab}
            setSidebarTab={setSidebarTab}
            role={role}
          />
        </div>
      </div>
    </div>);
}
function SidebarContent({ isDark, loading, totalReports, totalFiltered, noiseCount, clusters, selectedCluster, setSelectedCluster, activeCategories, toggleCategory, filterInView, setFilterInView, mapBounds, t, workflowReports, workflowLoading, workflowSaving, statusDrafts, setStatusDrafts, noteDrafts, setNoteDrafts, handleWorkflowUpdate, showHeatmap, sidebarTab, setSidebarTab, role = "admin", }: {
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
    showHeatmap: boolean;
    sidebarTab: "map" | "queue";
    setSidebarTab: Dispatch<SetStateAction<"map" | "queue">>;
    role?: "admin" | "staff";
}) {
    const isAdmin = role === "admin";

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

    return (
        <div className="flex flex-col gap-4 p-4 md:p-5 pb-24 md:pb-24">
            {/* View Mode Toggle Header */}
            <div className="flex items-center p-1 rounded-xl bg-black/10 dark:bg-black/40 border border-emerald-500/20 shrink-0">
                <button
                    type="button"
                    onClick={() => setSidebarTab("map")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all ${
                        sidebarTab === "map"
                            ? isDark
                                ? "bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 shadow-sm"
                                : "bg-white text-[#064e3b] shadow-sm border border-emerald-200"
                            : isDark
                                ? "text-white/60 hover:text-white"
                                : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                    <Flame className="h-3.5 w-3.5 text-amber-400" />
                    <span>Hotspots ({clusters.length})</span>
                </button>
                <button
                    type="button"
                    onClick={() => setSidebarTab("queue")}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-bold transition-all ${
                        sidebarTab === "queue"
                            ? isDark
                                ? "bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 shadow-sm"
                                : "bg-white text-[#064e3b] shadow-sm border border-emerald-200"
                            : isDark
                                ? "text-white/60 hover:text-white"
                                : "text-gray-600 hover:text-gray-900"
                    }`}
                >
                    <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Verify Queue</span>
                </button>
            </div>

            {sidebarTab === "map" ? (
                <>
                    {/* Compact Overview 3-Stat Grid */}
                    <div>
                        <h2 className={`text-[11px] font-semibold uppercase tracking-wider mb-2.5 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                            {t.adminOverview}
                        </h2>
                        {loading ? (
                            <div className="flex items-center gap-2 py-4 justify-center">
                                <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                                <span className="text-xs text-muted-foreground">Loading cluster data…</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                <div className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                                    isDark ? "bg-[#06382b]/80 border-emerald-500/20" : "bg-white border-emerald-200 shadow-sm"
                                }`}>
                                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        <BarChart3 className={`h-3 w-3 ${isDark ? "text-emerald-400" : "text-[#059669]"}`} />
                                        <span>Reports</span>
                                    </div>
                                    <span className={`text-xl font-black tracking-tight leading-none ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                                        {totalReports}
                                    </span>
                                    <span className={`text-[9px] font-medium mt-1 px-1.5 py-0.2 rounded-full ${
                                        isDark ? "bg-emerald-500/20 text-emerald-300" : "bg-emerald-100 text-[#047857]"
                                    }`}>
                                        total
                                    </span>
                                </div>

                                <div className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                                    isDark ? "bg-[#06382b]/80 border-amber-500/20" : "bg-white border-amber-200 shadow-sm"
                                }`}>
                                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        <Flame className={`h-3 w-3 ${isDark ? "text-amber-400" : "text-amber-600"}`} />
                                        <span>Hotspots</span>
                                    </div>
                                    <span className={`text-xl font-black tracking-tight leading-none ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                                        {clusters.length}
                                    </span>
                                    <span className={`text-[9px] font-medium mt-1 px-1.5 py-0.2 rounded-full ${
                                        isDark ? "bg-amber-500/20 text-amber-300" : "bg-amber-100 text-amber-700"
                                    }`}>
                                        clusters
                                    </span>
                                </div>

                                <div className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all ${
                                    isDark ? "bg-[#06382b]/80 border-teal-500/20" : "bg-white border-teal-200 shadow-sm"
                                }`}>
                                    <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                        <Radio className={`h-3 w-3 ${isDark ? "text-teal-400" : "text-teal-600"}`} />
                                        <span>Scattered</span>
                                    </div>
                                    <span className={`text-xl font-black tracking-tight leading-none ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                                        {noiseCount}
                                    </span>
                                    <span className={`text-[9px] font-medium mt-1 px-1.5 py-0.2 rounded-full ${
                                        isDark ? "bg-teal-500/20 text-teal-300" : "bg-teal-100 text-teal-700"
                                    }`}>
                                        isolated
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Filter by Category */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h2 className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                {t.adminFilterCategory}
                            </h2>
                            <button
                                type="button"
                                onClick={() => {
                                    if (activeCategories.size === ALL_CATEGORIES.length) {
                                        setActiveCategories(new Set());
                                    } else {
                                        setActiveCategories(new Set(ALL_CATEGORIES));
                                    }
                                }}
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded transition-colors ${
                                    isDark ? "text-emerald-400 hover:bg-emerald-500/10" : "text-[#059669] hover:bg-emerald-50"
                                }`}
                            >
                                {activeCategories.size === ALL_CATEGORIES.length ? "Clear all" : "Select all"}
                            </button>
                        </div>

                        <div className="mb-2">
                            <button
                                type="button"
                                onClick={() => setFilterInView((prev) => !prev)}
                                className={`inline-flex items-center justify-center gap-1.5 w-full min-h-8 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                                    filterInView
                                        ? isDark
                                            ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                                            : "bg-[#e6f4ea] text-[#047857] border border-emerald-200"
                                        : isDark
                                            ? "bg-white/[0.03] text-white/60 border-white/10 hover:bg-white/[0.06]"
                                            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                                }`}
                            >
                                <MapPin className="h-3.5 w-3.5" />
                                {filterInView ? "Showing visible map area only" : "Filter by current map view"}
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                            {ALL_CATEGORIES.map((cat) => {
                                const isActive = activeCategories.has(cat);
                                return (
                                    <button
                                        key={cat}
                                        onClick={() => toggleCategory(cat)}
                                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-all capitalize truncate border ${
                                            isActive
                                                ? isDark
                                                    ? "bg-emerald-500/20 text-emerald-200 border-emerald-500/40 shadow-sm"
                                                    : "bg-[#e6f4ea] text-[#047857] border border-emerald-300 shadow-sm"
                                                : isDark
                                                    ? "bg-white/[0.03] text-white/45 hover:bg-white/[0.06] border-transparent"
                                                    : "bg-white text-gray-600 border-emerald-100 hover:bg-[#e6f4ea]"
                                        }`}
                                    >
                                        {CATEGORY_ICONS[cat]}
                                        <span className="truncate">{translateCategory(cat, t)}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Compact Density Legend */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h2 className={`text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1.5 ${isDark ? "text-emerald-300/70" : "text-[#047857]"}`}>
                                <span className={`w-2 h-2 rounded-full ${showHeatmap ? "bg-emerald-400 animate-pulse" : "bg-gray-400"}`} />
                                {t.adminDensityLegend}
                            </h2>
                            {showHeatmap && <span className="text-[10px] text-emerald-400 font-semibold">(Active)</span>}
                        </div>
                        <div className={`grid grid-cols-4 gap-1 p-2 rounded-xl border ${
                            isDark ? "bg-black/20 border-white/5" : "bg-white border-emerald-100 shadow-sm"
                        }`}>
                            {[
                                { color: "bg-emerald-500", label: "Low", range: "<5" },
                                { color: "bg-amber-500", label: "Med", range: "5-9" },
                                { color: "bg-orange-500", label: "High", range: "10-14" },
                                { color: "bg-red-500", label: "Crit", range: "15+" },
                            ].map((item) => (
                                <div key={item.label} className="flex flex-col items-center text-center p-1">
                                    <span className={`w-2.5 h-2.5 rounded-full ${item.color} mb-1`} />
                                    <span className={`text-[11px] font-bold ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                                        {item.label}
                                    </span>
                                    <span className={`text-[9px] ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                        {item.range}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Hotspot Clusters List */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <h2 className={`text-[11px] font-semibold uppercase tracking-wider ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Hotspots ({clusters.length})
                            </h2>
                            {clusters.length > 0 && (
                                <button
                                    onClick={exportCSV}
                                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded border transition-colors ${
                                        isDark
                                            ? "border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                                            : "border-emerald-200 text-[#047857] hover:bg-emerald-50"
                                    }`}
                                    title="Export hotspots to CSV"
                                >
                                    <Download className="h-3 w-3" />
                                    <span>Export</span>
                                </button>
                            )}
                        </div>

                        {clusters.length === 0 && !loading && (
                            <div className={`p-4 rounded-xl border border-dashed text-center ${
                                isDark ? "border-white/10 text-white/40" : "border-gray-200 text-gray-500"
                            }`}>
                                <p className="text-xs">No clusters match your filters.</p>
                                <button
                                    onClick={() => setActiveCategories(new Set(ALL_CATEGORIES))}
                                    className={`mt-2 text-[11px] font-medium underline underline-offset-2 ${
                                        isDark ? "text-emerald-400" : "text-[#059669]"
                                    }`}
                                >
                                    Reset category filters
                                </button>
                            </div>
                        )}

                        <div className="flex flex-col gap-2">
                            {clusters.map((cluster, i) => {
                                const density = getDensityLabel(cluster.count, t);
                                const isSelected = selectedCluster === i;
                                const topCategory = Object.entries(cluster.category_breakdown).sort((a, b) => b[1] - a[1])[0];
                                return (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedCluster(isSelected ? null : i)}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left border transition-all ${
                                            isSelected
                                                ? isDark
                                                    ? "bg-emerald-500/20 border-emerald-500/40 ring-1 ring-emerald-500/30"
                                                    : "bg-[#e6f4ea] border-emerald-300 ring-1 ring-emerald-300 shadow-sm"
                                                : isDark
                                                    ? "bg-white/[0.03] border-white/[0.06] hover:bg-emerald-500/10"
                                                    : "bg-white border-emerald-100 hover:bg-[#e6f4ea]"
                                        }`}
                                    >
                                        <div className="flex flex-col items-center gap-0.5 min-w-[36px]">
                                            <span className={`text-base font-extrabold ${isDark ? "text-white" : "text-[#064e3b]"}`}>
                                                {cluster.count}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <span className={`w-1.5 h-1.5 rounded-full ${density.color}`} />
                                                <span className={`text-[9px] font-medium ${isDark ? "text-emerald-200/60" : "text-[#047857]"}`}>
                                                    {density.text}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                {topCategory && (CATEGORY_ICONS[normalizeCategory(topCategory[0])] || CATEGORY_ICONS[topCategory[0]] || <CircleHelp className="h-3.5 w-3.5 text-gray-400" />)}
                                                <span className={`text-xs font-semibold truncate ${isDark ? "text-white/90" : "text-[#064e3b]"}`}>
                                                    {topCategory ? translateCategory(topCategory[0], t) : (t.catOther || "Mixed")}
                                                </span>
                                            </div>
                                            <span className={`block text-[10px] font-mono truncate ${isDark ? "text-emerald-300/60" : "text-[#059669]"}`}>
                                                {cluster.latitude.toFixed(5)}, {cluster.longitude.toFixed(5)}
                                            </span>
                                        </div>
                                        <Badge variant="outline" className={`text-[10px] shrink-0 ${isDark ? "border-emerald-500/30 text-emerald-300" : "border-emerald-300 text-[#047857]"}`}>
                                            {Object.keys(cluster.category_breakdown).length} type{Object.keys(cluster.category_breakdown).length > 1 ? "s" : ""}
                                        </Badge>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selected Cluster Drilldown */}
                    {selectedCluster !== null && clusters[selectedCluster] && (
                        <div>
                            <h2 className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${isDark ? "text-white/45" : "text-gray-500"}`}>
                                Cluster Drilldown
                            </h2>
                            <div className={`rounded-xl border p-3 space-y-2 ${isDark ? "border-white/[0.06] bg-white/[0.03]" : "border-black/[0.06] bg-black/[0.01]"}`}>
                                <div className="flex items-center justify-between">
                                    <p className={`text-xs font-semibold ${isDark ? "text-white/80" : "text-gray-800"}`}>
                                        {clusters[selectedCluster].count} Reports · Score {Math.round(clusters[selectedCluster].weighted_score ?? clusters[selectedCluster].count)}
                                    </p>
                                    <div className="flex items-center gap-1">
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${clusters[selectedCluster].latitude},${clusters[selectedCluster].longitude}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] ${isDark ? "bg-white/[0.05] text-white/70 hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                        >
                                            <Navigation className="h-3 w-3" /> Google
                                        </a>
                                        <a
                                            href={`https://waze.com/ul?ll=${clusters[selectedCluster].latitude}%2C${clusters[selectedCluster].longitude}&navigate=yes`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] ${isDark ? "bg-white/[0.05] text-white/70 hover:bg-white/10" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}
                                        >
                                            <Navigation className="h-3 w-3" /> Waze
                                        </a>
                                    </div>
                                </div>
                                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                                    {(clusters[selectedCluster].reports ?? []).slice(0, 20).map((report) => (
                                        <div key={report.id} className={`rounded-lg border px-2.5 py-2 ${isDark ? "border-white/[0.06] bg-white/[0.02]" : "border-black/[0.06] bg-black/[0.01]"}`}>
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-xs font-medium ${isDark ? "text-white/80" : "text-gray-800"}`}>
                                                    {translateCategory(report.category, t)} · Severity {report.severity}
                                                </p>
                                                <span className={`text-[10px] ${isDark ? "text-white/35" : "text-gray-500"}`}>
                                                    {new Date(report.created_at).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                                </span>
                                            </div>
                                            {report.receipt_id && (
                                                <p className={`text-[10px] font-mono mt-0.5 ${isDark ? "text-white/40" : "text-gray-500"}`}>
                                                    {report.receipt_id}
                                                </p>
                                            )}
                                            {report.description && (
                                                <p className={`text-[10px] mt-1 line-clamp-2 ${isDark ? "text-white/60" : "text-gray-600"}`}>
                                                    {report.description}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                /* Verification Queue Dedicated View */
                <div className="space-y-3">
                    <VerificationPanel role={isAdmin ? "admin" : "staff"} />
                </div>
            )}
        </div>
    );
}
